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

from models.schemas import SubtitleCue
from services.subtitle_service import cues_to_srt

logger = logging.getLogger(__name__)

OUTPUT_WIDTH = 1920
OUTPUT_HEIGHT = 1080


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
) -> Path:
    """장면 하나를 렌더링해 output_path 에 mp4로 저장한다."""
    ffmpeg = check_ffmpeg()

    audio_duration = _get_audio_duration(audio_path)
    visual_is_video = visual_path and _is_video(visual_path)

    # SRT 임시 파일 (자막이 있을 때만)
    srt_tmp: tempfile.NamedTemporaryFile | None = None
    srt_path: Path | None = None
    if cues:
        srt_tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".srt", delete=False,
            encoding="utf-8", dir=output_path.parent,
        )
        srt_tmp.write(cues_to_srt(cues, start_index=1))
        srt_tmp.flush()
        srt_tmp.close()
        srt_path = Path(srt_tmp.name)

    try:
        cmd = _build_cmd(ffmpeg, audio_path, visual_path, visual_is_video, srt_path, output_path, audio_duration)
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
) -> list[str]:
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
        vf += f",subtitles='{_escape_path(srt_path)}':force_style='{_subtitle_style()}'"

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


def _subtitle_style() -> str:
    """ASS 스타일 — 한국어 폰트 우선, 흰색 자막, 테두리."""
    if platform.system() == "Windows":
        font = "Malgun Gothic"
    elif platform.system() == "Darwin":
        font = "Apple SD Gothic Neo"
    else:
        font = "Noto Sans CJK KR"
    return (
        f"FontName={font},"
        "FontSize=22,"
        "PrimaryColour=&H00FFFFFF,"   # 흰색
        "OutlineColour=&H00000000,"   # 검은 테두리
        "Outline=2,"
        "Alignment=2"                  # 하단 중앙
    )


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
