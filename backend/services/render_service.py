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

# 가로 폭 대비 사용 가능한 자막 영역 비율
SUBTITLE_USABLE_WIDTH_RATIO = 0.72

# 한글 한 글자의 가로 폭 ÷ font_size 비율.
# 주아체 등 display 폰트는 1.0 보다 넓을 수 있어 보수적으로 1.1 사용.
SUBTITLE_CHAR_WIDTH_FACTOR = 1.1


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
        max_chars = settings.subtitle_max_chars or _max_chars_per_line(settings.subtitle_font_size)
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
        "-r", "30",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-ac", "2",
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


def _hex_to_ass_color(hex_color: str) -> str:
    """hex RGB (#RRGGBB) → ASS BGR color (&H00BBGGRR)."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return "&H00FFFFFF"
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H00{b}{g}{r}".upper()


def _subtitle_style(settings: RenderSettings) -> str:
    """ASS 스타일 — 한국어 폰트 우선, 테두리."""
    font = settings.subtitle_font_name or _default_font()
    color = _hex_to_ass_color(settings.subtitle_color)
    bold = "1" if settings.subtitle_bold else "0"
    return (
        f"FontName={font},"
        f"FontSize={settings.subtitle_font_size},"
        f"Bold={bold},"
        f"PrimaryColour={color},"
        "OutlineColour=&H00000000,"
        f"Outline={settings.subtitle_outline},"
        "Alignment=2,"
        "WrapStyle=2"   # 자동 줄바꿈 비활성화 — 한 큐가 한 줄로만 표시됨
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


def concat_scenes(video_paths: list[Path], output_path: Path) -> Path:
    """FFmpeg concat filter로 여러 장면 mp4를 하나로 합친다.

    재인코딩이 발생하므로 다소 느리지만, 입력 영상들의 framerate/timebase/pixfmt가
    달라도 항상 정상 출력된다. (concat demuxer + -c copy는 파라미터 불일치 시
    오디오만 계속되고 비디오가 멈추는 문제가 발생함)

    Args:
        video_paths: 합칠 mp4 파일들의 절대 경로 목록 (순서대로 이어붙임)
        output_path: 최종 출력 파일 경로

    Returns:
        output_path
    """
    ffmpeg = check_ffmpeg()

    if not video_paths:
        raise RuntimeError("합칠 영상이 없습니다.")

    n = len(video_paths)
    cmd: list[str] = [ffmpeg, "-y"]

    # 각 입력을 -i로 추가
    for p in video_paths:
        cmd += ["-i", str(p)]

    # concat filter: [0:v:0][0:a:0][1:v:0][1:a:0]...concat=n=N:v=1:a=1[outv][outa]
    # 각 입력의 비디오/오디오를 동일 파라미터로 정규화한 뒤 이어붙임
    fps = 30
    inputs_video = "".join(
        f"[{i}:v:0]scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,"
        f"setsar=1,fps={fps}[v{i}];"
        for i in range(n)
    )
    inputs_audio = "".join(f"[{i}:a:0]aresample=async=1[a{i}];" for i in range(n))
    concat_inputs = "".join(f"[v{i}][a{i}]" for i in range(n))
    filter_complex = (
        f"{inputs_video}{inputs_audio}"
        f"{concat_inputs}concat=n={n}:v=1:a=1[outv][outa]"
    )

    cmd += [
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-r", str(fps),
        "-c:a", "aac",
        "-ac", "2",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ]

    logger.info("Concatenating %d scenes → %s", n, output_path)
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        logger.error("ffmpeg concat stderr:\n%s", result.stderr[-3000:])
        raise RuntimeError(_extract_ffmpeg_error(result.stderr))

    return output_path
