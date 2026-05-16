"""FFmpeg 기반 장면 렌더링 서비스.

비주얼(이미지 or 영상) + 오디오 + 자막(선택) → scene_N_render.mp4
"""
from __future__ import annotations

import logging
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

from models.schemas import SubtitleCue, RenderSettings
from services.subtitle_service import cues_to_srt

logger = logging.getLogger(__name__)

OUTPUT_WIDTH = 1920
OUTPUT_HEIGHT = 1080

# 가로 폭 대비 사용 가능한 자막 영역 비율 (양쪽 여백 약 7.5%씩)
SUBTITLE_USABLE_WIDTH_RATIO = 0.85

# CJK(전각) 문자 폭은 font_size 와 거의 동일하다고 가정.
# 라틴 문자/공백은 평균적으로 좁아서 약 0.55 배 정도.
# 한국어 위주 자막을 가정하고 1.0 을 기본 계수로 사용.
SUBTITLE_CHAR_WIDTH_FACTOR = 1.0


def check_ffmpeg() -> str:
    """ffmpeg 실행파일 경로를 반환. 없으면 RuntimeError."""
    path = shutil.which("ffmpeg")
    if not path:
        raise RuntimeError(
            "ffmpeg를 찾을 수 없습니다. https://ffmpeg.org/download.html 에서 설치 후 "
            "PATH에 추가하세요."
        )
    return path


def _get_audio_duration(audio_path: Path) -> float | None:
    """오디오 파일의 실제 재생 시간(초)을 반환. 실패하면 None."""
    try:
        suffix = audio_path.suffix.lower()
        if suffix == ".mp3":
            from mutagen.mp3 import MP3
            return MP3(str(audio_path)).info.length
        elif suffix in {".wav", ".wave"}:
            import wave
            with wave.open(str(audio_path)) as wf:
                return wf.getnframes() / wf.getframerate()
        else:
            from mutagen import File as MutagenFile
            f = MutagenFile(str(audio_path))
            if f and f.info:
                return f.info.length
    except Exception as e:
        logger.warning("오디오 길이 읽기 실패 (%s): %s", audio_path, e)
    return None


def render_scene(
    scene_id: int,
    audio_path: Path,
    visual_path: Path | None,
    cues: list[SubtitleCue] | None,
    output_path: Path,
    settings: RenderSettings | None = None,
) -> Path:
    """장면 하나를 렌더링해 output_path 에 mp4로 저장한다."""
    ffmpeg = check_ffmpeg()
    settings = settings or RenderSettings()

    audio_duration = _get_audio_duration(audio_path)
    visual_is_video = visual_path and _is_video(visual_path)

    # 폰트 크기에 맞춰 한 줄에 안 들어가는 큐를 시간 분배로 쪼개기
    display_cues: list[SubtitleCue] = []
    if cues:
        max_chars = _max_chars_per_line(settings.subtitle_font_size)
        for c in cues:
            display_cues.extend(_split_cue_for_line_fit(c, max_chars))

    # SRT 임시 파일 (자막이 있을 때만)
    srt_tmp: tempfile.NamedTemporaryFile | None = None
    srt_path: Path | None = None
    if display_cues:
        srt_tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".srt", delete=False,
            encoding="utf-8", dir=output_path.parent,
        )
        srt_tmp.write(cues_to_srt(display_cues, start_index=1))
        srt_tmp.flush()
        srt_tmp.close()
        srt_path = Path(srt_tmp.name)

    try:
        cmd = _build_cmd(ffmpeg, audio_path, visual_path, visual_is_video, srt_path, output_path, audio_duration, settings)
        logger.info("Rendering scene %d: %s", scene_id, " ".join(str(c) for c in cmd))
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            logger.error("ffmpeg stderr:\n%s", result.stderr[-3000:])
            raise RuntimeError(_extract_ffmpeg_error(result.stderr))
    finally:
        if srt_path and srt_path.exists():
            srt_path.unlink(missing_ok=True)

    return output_path


def _build_cmd(
    ffmpeg: str,
    audio_path: Path,
    visual_path: Path | None,
    visual_is_video: bool,
    srt_path: Path | None,
    output_path: Path,
    duration: float | None = None,
    settings: RenderSettings | None = None,
) -> list[str]:
    settings = settings or RenderSettings()
    cmd: list[str] = [ffmpeg, "-y"]

    if visual_path:
        if visual_is_video:
            # 영상을 반복 재생해 오디오 길이에 맞춤
            cmd += ["-stream_loop", "-1", "-i", str(visual_path)]
        else:
            # 이미지를 정지 영상으로 루프
            cmd += ["-loop", "1", "-i", str(visual_path)]
    else:
        # 비주얼 없음 → 검은 화면 생성
        cmd += ["-f", "lavfi", "-i", f"color=c=black:s={OUTPUT_WIDTH}x{OUTPUT_HEIGHT}:r=25"]

    cmd += ["-i", str(audio_path)]

    # 비디오 필터 체인 구성
    vf = _scale_pad_filter()
    if srt_path:
        vf += f",subtitles='{_escape_path(srt_path)}':force_style='{_subtitle_style(settings)}'"

    if visual_path:
        if visual_is_video:
            cmd += ["-map", "0:v", "-map", "1:a"]
        else:
            cmd += ["-map", "0:v", "-map", "1:a"]
    else:
        cmd += ["-map", "0:v", "-map", "1:a"]

    cmd += [
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-pix_fmt", "yuv420p",
    ]
    if duration is not None:
        cmd += ["-t", f"{duration:.6f}"]
    cmd.append(str(output_path))
    return cmd


def _scale_pad_filter() -> str:
    """비율 유지 스케일 + 검은 레터박스 패딩 필터."""
    return (
        f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black"
    )


def _default_font() -> str:
    if platform.system() == "Windows":
        return "Malgun Gothic"
    elif platform.system() == "Darwin":
        return "Apple SD Gothic Neo"
    else:
        return "Noto Sans CJK KR"


def _subtitle_style(settings: RenderSettings) -> str:
    """ASS 스타일 — 한국어 폰트 우선, 흰색 자막, 테두리."""
    font = settings.subtitle_font_name or _default_font()
    return (
        f"FontName={font},"
        f"FontSize={settings.subtitle_font_size},"
        "PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,"
        f"Outline={settings.subtitle_outline},"
        "Alignment=2"
    )


def _max_chars_per_line(font_size: int) -> int:
    """1920px 화면에서 한 줄에 들어갈 수 있는 최대 글자수 (한글 기준 보수적 추정)."""
    usable = OUTPUT_WIDTH * SUBTITLE_USABLE_WIDTH_RATIO
    char_w = max(1, font_size * SUBTITLE_CHAR_WIDTH_FACTOR)
    return max(4, int(usable / char_w))


def _split_cue_for_line_fit(cue: SubtitleCue, max_chars: int) -> list[SubtitleCue]:
    """긴 자막 큐를 한 줄에 맞는 여러 큐로 쪼개고, 원래 구간 안에서 시간 비례 배분.

    원본 큐의 [start, end] 구간 내에서만 분배하므로 다른 장면 시간과 충돌하지 않는다.
    """
    text = cue.text.strip()
    if not text or len(text) <= max_chars:
        return [cue]

    chunks = _chunk_text(text, max_chars)
    if len(chunks) <= 1:
        return [cue]

    duration = max(0.0, cue.end - cue.start)
    total_len = sum(len(c) for c in chunks)
    if total_len == 0 or duration <= 0:
        return [cue]

    result: list[SubtitleCue] = []
    t = cue.start
    for i, c in enumerate(chunks):
        if i == len(chunks) - 1:
            end = cue.end
        else:
            end = t + duration * len(c) / total_len
        result.append(SubtitleCue(start=t, end=end, text=c))
        t = end
    return result


def _chunk_text(text: str, max_chars: int) -> list[str]:
    """공백 단위 우선, 필요하면 강제 분할로 max_chars 이하 청크 리스트 반환."""
    parts = text.split()
    chunks: list[str] = []
    current = ""
    for p in parts:
        candidate = (current + " " + p) if current else p
        if len(candidate) <= max_chars:
            current = candidate
            continue
        # 현재 청크 마무리
        if current:
            chunks.append(current)
            current = ""
        # 단어 자체가 한계를 초과하면 강제 분할
        while len(p) > max_chars:
            chunks.append(p[:max_chars])
            p = p[max_chars:]
        current = p
    if current:
        chunks.append(current)
    return chunks


def _escape_path(path: Path) -> str:
    """FFmpeg subtitles 필터용 경로 이스케이프 (Windows 드라이브 문자 콜론 처리)."""
    s = str(path).replace("\\", "/")
    # C:/path → C\:/path  (filtergraph에서 콜론은 구분자라 이스케이프 필요)
    if len(s) >= 2 and s[1] == ":":
        s = s[0] + "\\:" + s[2:]
    return s


def _is_video(path: Path) -> bool:
    return path.suffix.lower() in {".mp4", ".mov", ".webm", ".avi", ".mkv"}


def _extract_ffmpeg_error(stderr: str) -> str:
    lines = [l for l in stderr.splitlines() if l.strip()]
    # 마지막 에러 메시지만 추출
    for line in reversed(lines[-20:]):
        if any(k in line.lower() for k in ("error", "invalid", "no such", "failed", "unable")):
            return line.strip()
    return lines[-1].strip() if lines else "알 수 없는 ffmpeg 오류"
