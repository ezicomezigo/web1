import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from models.schemas import SceneAssets
from routers.projects import load_project, save_project, project_path

router = APIRouter(prefix="/api/projects", tags=["visual"])
logger = logging.getLogger(__name__)

ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_VIDEO_EXT = {".mp4", ".mov", ".webm"}
ALLOWED_EXT = ALLOWED_IMAGE_EXT | ALLOWED_VIDEO_EXT


@router.post("/{project_id}/scenes/{scene_id}/visual/upload")
async def upload_scene_visual(project_id: str, scene_id: int, file: UploadFile = File(...)):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"지원하지 않는 파일 형식입니다: {ext}. 허용: {sorted(ALLOWED_EXT)}")

    media_dir = project_path(project_id) / "media"
    media_dir.mkdir(exist_ok=True)

    # 기존 visual 파일 삭제 (확장자 바뀔 수 있으므로)
    old_rel = project.scenes[idx].assets.visual
    if old_rel:
        old_path = project_path(project_id) / old_rel
        if old_path.exists():
            old_path.unlink()

    kind = "image" if ext in ALLOWED_IMAGE_EXT else "video"
    filename = f"scene_{scene_id}_{kind}{ext}"
    target = media_dir / filename
    content = await file.read()
    target.write_bytes(content)

    rel_path = f"media/{filename}"
    project.scenes[idx].assets = SceneAssets(
        audio=project.scenes[idx].assets.audio,
        visual=rel_path,
    )
    save_project(project)

    return {"visual_path": rel_path, "kind": kind}


@router.delete("/{project_id}/scenes/{scene_id}/visual", status_code=204)
async def delete_scene_visual(project_id: str, scene_id: int):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    visual_rel = project.scenes[idx].assets.visual
    if visual_rel:
        f = project_path(project_id) / visual_rel
        if f.exists():
            f.unlink()
        project.scenes[idx].assets = SceneAssets(
            audio=project.scenes[idx].assets.audio,
            visual=None,
        )
        save_project(project)
