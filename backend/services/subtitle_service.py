"""faster-whisper 기반 자막 생성 서비스.

워드 단위 타임스탬프를 받아서 길이/시간 제약에 맞게 큐(SubtitleCue)로 묶는다.
모델은 최초 호출 시 1회 로드되어 프로세스 동안 캐시된다.
"""
from __future__ import annotations

import logging
from pathlib import Path
from threading import Lock

from models.schemas import SubtitleCue

logger = logging.getLogger(__name__)

# 큐 분할 규칙 (한국어 기준)
MAX_CHARS_PER_CUE = 32
MAX_DURATION_PER_CUE = 5.0
MIN_DURATION_PER_CUE = 0.8
SENTENCE_BREAK_CHARS = set(".!?。！？")
SOFT_BREAK_CHARS = set(",;:、，;")

_model = None
_model_lock = Lock()
_model_size = "large-v3"


def _get_model():
    global _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel
            logger.info("Loading faster-whisper model: %s (first call may download ~1.5GB)", _model_size)
            # CPU + int8 양자화: 메모리 절약, 충분히 빠름. GPU 있으면 device="cuda", compute_type="float16"으로 교체.
            _model = WhisperModel(_model_size, device="cpu", compute_type="int8")
            logger.info("faster-whisper model loaded")
    return _model


def transcribe_to_cues(audio_path: Path, language: str = "ko") -> list[SubtitleCue]:
    """오디오 파일을 받아 SubtitleCue 배열로 반환한다."""
    if not audio_path.exists():
        raise FileNotFoundError(f"오디오 파일이 없습니다: {audio_path}")

    model = _get_model()
    segments, _info = model.transcribe(
        str(audio_path),
        language=language,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
    )

    # 모든 단어를 평탄화
    words: list[tuple[float, float, str]] = []
    for seg in segments:
        if not seg.words:
            # 단어 정보가 없는 세그먼트는 통째로
            words.append((seg.start, seg.end, seg.text.strip()))
            continue
        for w in seg.words:
            if w.word and w.word.strip():
                words.append((w.start, w.end, w.word.strip()))

    return _group_words_to_cues(words)


def _group_words_to_cues(words: list[tuple[float, float, str]]) -> list[SubtitleCue]:
    """단어 타임스탬프를 큐 단위로 그룹화."""
    if not words:
        return []

    cues: list[SubtitleCue] = []
    cur_start = words[0][0]
    cur_end = words[0][1]
    cur_text = words[0][2]

    for start, end, text in words[1:]:
        candidate = (cur_text + " " + text).strip()
        cur_chars = len(cur_text)
        prev_last = cur_text[-1:] if cur_text else ""
        duration = end - cur_start

        sentence_break = prev_last in SENTENCE_BREAK_CHARS
        soft_break = prev_last in SOFT_BREAK_CHARS and cur_chars >= MAX_CHARS_PER_CUE // 2
        too_long = len(candidate) > MAX_CHARS_PER_CUE
        too_durational = duration > MAX_DURATION_PER_CUE

        if sentence_break or soft_break or too_long or too_durational:
            cues.append(SubtitleCue(start=cur_start, end=cur_end, text=cur_text))
            cur_start, cur_end, cur_text = start, end, text
        else:
            cur_end = end
            cur_text = candidate

    cues.append(SubtitleCue(start=cur_start, end=cur_end, text=cur_text))

    # 너무 짧은 큐는 끝 시간을 살짝 연장 (다음 큐와 겹치지 않는 한)
    for i, cue in enumerate(cues):
        if cue.end - cue.start < MIN_DURATION_PER_CUE:
            target = cue.start + MIN_DURATION_PER_CUE
            next_start = cues[i + 1].start if i + 1 < len(cues) else target
            cue.end = min(target, next_start)

    return cues


def cues_to_srt(cues: list[SubtitleCue], start_index: int = 1) -> str:
    """SubtitleCue 배열을 SRT 문자열로 변환."""
    lines: list[str] = []
    for i, cue in enumerate(cues, start=start_index):
        lines.append(str(i))
        lines.append(f"{_fmt_srt_time(cue.start)} --> {_fmt_srt_time(cue.end)}")
        lines.append(cue.text)
        lines.append("")
    return "\n".join(lines)


def _fmt_srt_time(sec: float) -> str:
    if sec < 0:
        sec = 0
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    if ms == 1000:
        ms = 0
        s += 1
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
