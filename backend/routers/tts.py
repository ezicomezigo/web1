import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from models.schemas import SceneAssets
from routers.projects import load_project, save_project, project_path

router = APIRouter(prefix="/api/projects", tags=["tts"])
logger = logging.getLogger(__name__)


class TTSRequest(BaseModel):
    provider: Literal["gemini", "minimax"]
    model: str
    voice: str
    speed: float = 1.0


class TTSResult(BaseModel):
    audio_path: str
    duration: float


def _make_tts(provider: str, model: str):
    if provider == "gemini":
        from services.tts.gemini_tts import GeminiTTS
        return GeminiTTS(model)
    if provider == "minimax":
        from services.tts.minimax_tts import MinimaxTTS
        return MinimaxTTS(model)
    raise HTTPException(400, f"지원하지 않는 TTS 제공자: {provider}")


@router.post("/{project_id}/scenes/{scene_id}/audio", response_model=TTSResult)
async def generate_scene_audio(project_id: str, scene_id: int, req: TTSRequest):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    tts = _make_tts(req.provider, req.model)
    try:
        audio_bytes, ext, duration = await tts.generate(
            project.scenes[idx].text, req.voice, req.speed
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("TTS generation failed: %s", e)
        raise HTTPException(500, f"오디오 생성 실패: {e}")

    media_dir = project_path(project_id) / "media"
    media_dir.mkdir(exist_ok=True)
    filename = f"scene_{scene_id}_audio.{ext}"
    (media_dir / filename).write_bytes(audio_bytes)

    rel_path = f"media/{filename}"
    project.scenes[idx].assets = SceneAssets(audio=rel_path, visual=project.scenes[idx].assets.visual)
    project.scenes[idx].estimated_duration = duration
    save_project(project)

    return TTSResult(audio_path=rel_path, duration=duration)


@router.delete("/{project_id}/scenes/{scene_id}/audio", status_code=204)
async def delete_scene_audio(project_id: str, scene_id: int):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    audio_rel = project.scenes[idx].assets.audio
    if audio_rel:
        f = project_path(project_id) / audio_rel
        if f.exists():
            f.unlink()
        project.scenes[idx].assets = SceneAssets(audio=None, visual=project.scenes[idx].assets.visual)
        project.scenes[idx].estimated_duration = _estimate_from_text(project.scenes[idx].text)
        save_project(project)


@router.post("/{project_id}/audio/batch")
async def generate_all_audio(project_id: str, req: TTSRequest):
    project = load_project(project_id)
    if not project.scenes:
        raise HTTPException(400, "장면이 없습니다.")

    media_dir = project_path(project_id) / "media"
    media_dir.mkdir(exist_ok=True)

    results = []
    for scene in project.scenes:
        tts = _make_tts(req.provider, req.model)
        try:
            audio_bytes, ext, duration = await tts.generate(scene.text, req.voice, req.speed)
            filename = f"scene_{scene.scene_id}_audio.{ext}"
            (media_dir / filename).write_bytes(audio_bytes)
            rel_path = f"media/{filename}"
            scene.assets = SceneAssets(audio=rel_path, visual=scene.assets.visual)
            scene.estimated_duration = duration
            results.append({"scene_id": scene.scene_id, "audio_path": rel_path, "duration": duration, "ok": True})
        except Exception as e:
            logger.error("Batch TTS scene %d failed: %s", scene.scene_id, e)
            results.append({"scene_id": scene.scene_id, "error": str(e), "ok": False})

    save_project(project)
    return results


@router.get("/{project_id}/media/{filename}")
async def get_media_file(project_id: str, filename: str):
    # Basic path traversal guard
    if ".." in filename or "/" in filename:
        raise HTTPException(400, "잘못된 파일명입니다.")
    file_path = project_path(project_id) / "media" / filename
    if not file_path.exists():
        raise HTTPException(404, "파일을 찾을 수 없습니다.")
    return FileResponse(str(file_path))


def _estimate_from_text(text: str) -> float:
    return round(len(text) / 5.5, 1)
