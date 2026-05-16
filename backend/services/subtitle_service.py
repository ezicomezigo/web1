"""faster-whisper 기반 자막 생성 서비스.

워드 단위 타임스탬프를 받아서 길이/시간 제약에 맞게 큐(SubtitleCue)로 묶는다.
모델은 최초 호출 시 1회 로드되어 프로세스 동안 캐시된다.
"""
from __future__ import annotations

import logging
import os
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

# WHISPER_MODEL_SIZE 환경변수로 덮어쓸 수 있음 (tiny/base/small/medium/large-v3)
_model_size = os.environ.get("WHISPER_MODEL_SIZE", "medium")
# 모델을 심링크 없이 프로젝트 로컬 디렉터리에 저장 (Windows 권한 문제 회피)
_model_cache_dir = Path(__file__).parent.parent / "models_cache"

_model = None
_model_lock = Lock()


def _ensure_model_downloaded(model_size: str) -> Path:
    """모델을 local_dir에 심링크 없이 다운로드하고 경로를 반환한다."""
    from huggingface_hub import snapshot_download

    model_dir = _model_cache_dir / f"faster-whisper-{model_size}"
    if model_dir.exists() and any(model_dir.iterdir()):
        return model_dir

    model_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading faster-whisper-%s (this may take a while)...", model_size)

    kwargs: dict = dict(
        repo_id=f"Systran/faster-whisper-{model_size}",
        local_dir=str(model_dir),
    )
    # local_dir_use_symlinks=False 는 huggingface_hub >= 0.16 에서 지원
    # 이 옵션이 있으면 심링크 대신 파일 복사 → Windows 권한 불필요
    import inspect
    if "local_dir_use_symlinks" in inspect.signature(snapshot_download).parameters:
        kwargs["local_dir_use_symlinks"] = False

    snapshot_download(**kwargs)
    return model_dir


def _get_model():
    global _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel
            try:
                model_path = _ensure_model_downloaded(_model_size)
                logger.info("Loading faster-whisper from %s", model_path)
                _model = WhisperModel(str(model_path), device="cpu", compute_type="int8")
            except Exception as e:
                # 로컬 다운로드 실패 시 기본 HF 캐시로 폴백
                logger.warning("Local download failed (%s), falling back to HF cache", e)
                _model = WhisperModel(_model_size, device="cpu", compute_type="int8")
            logger.info("faster-whisper model ready")
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

    # 너무 짧은 큐는 끝 시간을 살짝 연장
    for i, cue in enumerate(cues):
        if cue.end - cue.start < MIN_DURATION_PER_CUE:
            target = cue.start + MIN_DURATION_PER_CUE
            next_start = cues[i + 1].start if i + 1 < len(cues) else target
            cue.end = min(target, next_start)

    return cues


def correct_cues_with_script(cues: list[SubtitleCue], script_text: str) -> list[SubtitleCue]:
    """Whisper 인식 오류를 원본 스크립트 텍스트로 교정한다.

    타임스탬프는 Whisper 것을 그대로 유지하고, 텍스트만 스크립트로 교체한다.
    difflib.SequenceMatcher로 단어 단위 정렬 후 스크립트 단어를 해당 큐에 배분.
    """
    from difflib import SequenceMatcher

    # 스크립트 단어 목록 (문장부호 포함 그대로)
    script_words = script_text.split()
    if not script_words:
        return cues

    # Whisper 단어 목록 + 각 단어가 속한 큐 인덱스
    ww_to_cue: list[tuple[str, int]] = []
    for ci, cue in enumerate(cues):
        for w in cue.text.strip().split():
            ww_to_cue.append((w, ci))

    if not ww_to_cue:
        return cues

    whisper_words = [w for w, _ in ww_to_cue]

    # 단어 단위 정렬
    sm = SequenceMatcher(None, whisper_words, script_words, autojunk=False)
    opcodes = sm.get_opcodes()

    # 큐별 교정 단어 버킷
    corrected: dict[int, list[str]] = {i: [] for i in range(len(cues))}

    def _ci(ww_idx: int) -> int:
        """whisper 단어 인덱스 → 큐 인덱스 (범위 초과 시 마지막 큐)."""
        if ww_idx < len(ww_to_cue):
            return ww_to_cue[ww_idx][1]
        return len(cues) - 1

    for tag, a1, a2, b1, b2 in opcodes:
        n_w = a2 - a1   # whisper 쪽 단어 수
        n_s = b2 - b1   # script 쪽 단어 수

        if tag == "equal":
            # 동일한 단어 → 스크립트 단어로 덮어쓰기 (대소문자·문장부호 정규화)
            for k in range(n_w):
                corrected[_ci(a1 + k)].append(script_words[b1 + k])

        elif tag == "replace":
            # Whisper N개 단어 ↔ Script M개 단어: 비율로 큐에 배분
            for k in range(n_w):
                ci = _ci(a1 + k)
                s_start = b1 + int(k * n_s / n_w)
                s_end = b1 + int((k + 1) * n_s / n_w)
                corrected[ci].extend(script_words[s_start:s_end])
            # 나머지 스크립트 단어가 있으면 마지막 Whisper 큐에 붙이기
            assigned = int(n_w * n_s / n_w)
            for j in range(b1 + assigned, b2):
                corrected[_ci(a2 - 1)].append(script_words[j])

        elif tag == "delete":
            # Whisper에만 있는 단어 → 버림 (스크립트에 없는 환각)
            pass

        elif tag == "insert":
            # Script에만 있는 단어 → Whisper 인접 큐에 붙이기
            ci = _ci(a1 - 1) if a1 > 0 else 0
            corrected[ci].extend(script_words[b1:b2])

    # 빈 큐 처리: 교정 단어가 없으면 원본 Whisper 텍스트 유지
    result: list[SubtitleCue] = []
    for i, cue in enumerate(cues):
        words = corrected[i]
        text = " ".join(words) if words else cue.text
        result.append(SubtitleCue(start=cue.start, end=cue.end, text=text.strip()))
    return result



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
