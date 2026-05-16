import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from models.schemas import SceneAssets, SubtitleCue
from routers.projects import load_project, save_project, project_path
from services.subtitle_service import transcribe_to_cues, cues_to_srt, correct_cues_with_script

router = APIRouter(prefix="/api/projects", tags=["subtitle"])
logger = logging.getLogger(__name__)


class SubtitleSaveRequest(BaseModel):
    cues: list[SubtitleCue]


@router.post("/{project_id}/scenes/{scene_id}/subtitle", response_model=list[SubtitleCue])
def generate_subtitle(project_id: str, scene_id: int):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    scene = project.scenes[idx]
    if not scene.assets.audio:
        raise HTTPException(400, "오디오가 먼저 생성되어야 합니다.")

    audio_path = project_path(project_id) / scene.assets.audio
    if not audio_path.exists():
        raise HTTPException(404, f"오디오 파일이 없습니다: {scene.assets.audio}")

    try:
        cues = transcribe_to_cues(audio_path)
    except Exception as e:
        logger.exception("Subtitle generation failed")
        raise HTTPException(500, f"자막 생성 실패: {e}")

    # 인식된 자막을 원본 스크립트로 자동 보정 (타임스탬프 유지)
    if cues and scene.text.strip():
        try:
            cues = correct_cues_with_script(cues, scene.text)
        except Exception as e:
            logger.warning("자동 보정 실패, 원본 Whisper 결과 사용: %s", e)

    project.scenes[idx].assets = SceneAssets(
        audio=scene.assets.audio,
        visual=scene.assets.visual,
        subtitle=cues,
        video=scene.assets.video,
    )
    save_project(project)
    return cues


@router.put("/{project_id}/scenes/{scene_id}/subtitle", response_model=list[SubtitleCue])
def save_subtitle(project_id: str, scene_id: int, req: SubtitleSaveRequest):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    scene = project.scenes[idx]
    project.scenes[idx].assets = SceneAssets(
        audio=scene.assets.audio,
        visual=scene.assets.visual,
        subtitle=req.cues,
        video=scene.assets.video,
    )
    save_project(project)
    return req.cues


@router.post("/{project_id}/scenes/{scene_id}/subtitle/correct", response_model=list[SubtitleCue])
def correct_subtitle(project_id: str, scene_id: int):
    """자막 텍스트를 원본 장면 스크립트로 교정한다 (타임스탬프는 유지)."""
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    scene = project.scenes[idx]
    if not scene.assets.subtitle:
        raise HTTPException(400, "먼저 자막을 생성하세요.")

    corrected = correct_cues_with_script(scene.assets.subtitle, scene.text)

    project.scenes[idx].assets = SceneAssets(
        audio=scene.assets.audio,
        visual=scene.assets.visual,
        subtitle=corrected,
        video=scene.assets.video,
    )
    save_project(project)
    return corrected


@router.delete("/{project_id}/scenes/{scene_id}/subtitle")
def delete_subtitle(project_id: str, scene_id: int):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    scene = project.scenes[idx]
    project.scenes[idx].assets = SceneAssets(
        audio=scene.assets.audio,
        visual=scene.assets.visual,
        subtitle=None,
        video=scene.assets.video,
    )
    save_project(project)
    return {"ok": True}


@router.get("/{project_id}/subtitle.srt", response_class=PlainTextResponse)
def export_srt(project_id: str):
    """전체 장면의 자막을 누적된 타임라인으로 합쳐 SRT 문자열로 반환."""
    project = load_project(project_id)
    parts: list[str] = []
    offset = 0.0
    index = 1
    for scene in project.scenes:
        if scene.assets.subtitle:
            shifted = [
                SubtitleCue(start=c.start + offset, end=c.end + offset, text=c.text)
                for c in scene.assets.subtitle
            ]
            parts.append(cues_to_srt(shifted, start_index=index))
            index += len(shifted)
        offset += scene.estimated_duration
    return "\n".join(parts)
