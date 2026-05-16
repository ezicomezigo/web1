import logging
from fastapi import APIRouter, HTTPException

from models.schemas import SceneAssets
from routers.projects import load_project, save_project, project_path
from services.render_service import render_scene, check_ffmpeg

router = APIRouter(prefix="/api/projects", tags=["render"])
logger = logging.getLogger(__name__)


@router.get("/ffmpeg-check")
def ffmpeg_check():
    try:
        path = check_ffmpeg()
        return {"ok": True, "path": path}
    except RuntimeError as e:
        return {"ok": False, "error": str(e)}


@router.post("/{project_id}/scenes/{scene_id}/render")
def render_scene_endpoint(project_id: str, scene_id: int):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    scene = project.scenes[idx]
    if not scene.assets.audio:
        raise HTTPException(400, "오디오가 없습니다. 먼저 오디오를 생성하세요.")

    base = project_path(project_id)
    audio_path = base / scene.assets.audio
    visual_path = (base / scene.assets.visual) if scene.assets.visual else None
    cues = scene.assets.subtitle or None

    output_filename = f"scene_{scene_id}_render.mp4"
    output_path = base / "media" / output_filename

    try:
        render_scene(scene_id, audio_path, visual_path, cues, output_path)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        logger.exception("Render failed for scene %d", scene_id)
        raise HTTPException(500, f"렌더링 실패: {e}")

    rel_path = f"media/{output_filename}"
    project.scenes[idx].assets = SceneAssets(
        audio=scene.assets.audio,
        visual=scene.assets.visual,
        subtitle=scene.assets.subtitle,
        video=rel_path,
    )
    save_project(project)
    return {"video_path": rel_path}


@router.delete("/{project_id}/scenes/{scene_id}/render")
def delete_render(project_id: str, scene_id: int):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    scene = project.scenes[idx]
    if scene.assets.video:
        old = project_path(project_id) / scene.assets.video
        old.unlink(missing_ok=True)

    project.scenes[idx].assets = SceneAssets(
        audio=scene.assets.audio,
        visual=scene.assets.visual,
        subtitle=scene.assets.subtitle,
        video=None,
    )
    save_project(project)
    return {"ok": True}
