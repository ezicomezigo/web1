import logging
import threading
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from models.schemas import SceneAssets, RenderSettings
from routers.projects import load_project, save_project, project_path
from services.render_service import render_scene, concat_scenes, check_ffmpeg

router = APIRouter(prefix="/api/projects", tags=["render"])
logger = logging.getLogger(__name__)

# ─── 내보내기 작업 상태 (in-memory, project_id → job dict) ──────────────────
_jobs: dict[str, dict] = {}


def _export_worker(project_id: str) -> None:
    """백그라운드 스레드: 장면 mp4들을 하나로 합쳐 output.mp4를 생성한다."""
    try:
        project = load_project(project_id)
        base = project_path(project_id)

        # video asset이 있는 장면만, scene_id 순으로
        video_scenes = sorted(
            [s for s in project.scenes if s.assets and s.assets.video],
            key=lambda s: s.scene_id,
        )

        if len(video_scenes) < 2:
            _jobs[project_id].update(
                status="error",
                message=f"영상이 있는 장면이 {len(video_scenes)}개뿐입니다. 최소 2개 이상 필요합니다.",
            )
            return

        video_paths = [base / s.assets.video for s in video_scenes]
        missing = [str(p) for p in video_paths if not p.exists()]
        if missing:
            _jobs[project_id].update(
                status="error",
                message=f"파일을 찾을 수 없습니다: {', '.join(missing)}",
            )
            return

        _jobs[project_id]["scene_count"] = len(video_paths)
        output_path = base / "output.mp4"

        concat_scenes(video_paths, output_path)

        _jobs[project_id].update(
            status="done",
            progress=1.0,
            message=f"{len(video_paths)}개 장면 합치기 완료",
        )
    except Exception as e:
        logger.exception("Export failed for project %s", project_id)
        _jobs[project_id].update(status="error", message=str(e))


@router.get("/ffmpeg-check")
def ffmpeg_check():
    try:
        path = check_ffmpeg()
        return {"ok": True, "path": path}
    except RuntimeError as e:
        return {"ok": False, "error": str(e)}


@router.post("/{project_id}/scenes/{scene_id}/render")
def render_scene_endpoint(project_id: str, scene_id: int, settings: RenderSettings | None = None):
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
        render_scene(scene_id, audio_path, visual_path, cues, output_path, settings)
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


# ─── 최종 영상 내보내기 ──────────────────────────────────────────────────────

@router.post("/{project_id}/export")
def start_export(project_id: str):
    """장면 mp4들을 하나로 합치는 내보내기 작업을 시작한다."""
    # 프로젝트 존재 확인
    load_project(project_id)

    job = _jobs.get(project_id)
    if job and job.get("status") == "running":
        raise HTTPException(409, "이미 내보내기가 진행 중입니다.")

    _jobs[project_id] = {
        "status": "running",
        "progress": 0.0,
        "message": "내보내기 시작 중...",
        "scene_count": 0,
    }

    t = threading.Thread(target=_export_worker, args=(project_id,), daemon=True)
    t.start()

    return {"job_id": project_id, "status": "started"}


@router.get("/{project_id}/export/status")
def export_status(project_id: str):
    """내보내기 작업 상태를 반환한다."""
    job = _jobs.get(project_id)
    if not job:
        return {"status": "idle", "progress": 0.0, "message": "", "scene_count": 0}
    return {
        "status": job.get("status", "idle"),
        "progress": job.get("progress", 0.0),
        "message": job.get("message", ""),
        "scene_count": job.get("scene_count", 0),
    }


@router.get("/{project_id}/export/download")
def download_export(project_id: str):
    """완성된 output.mp4를 다운로드한다."""
    output_path = project_path(project_id) / "output.mp4"
    if not output_path.exists():
        raise HTTPException(404, "내보내기 파일이 없습니다. 먼저 내보내기를 실행하세요.")
    return FileResponse(
        path=str(output_path),
        media_type="video/mp4",
        filename="output.mp4",
    )


@router.delete("/{project_id}/export")
def delete_export(project_id: str):
    """output.mp4를 삭제하고 작업 상태를 초기화한다."""
    output_path = project_path(project_id) / "output.mp4"
    output_path.unlink(missing_ok=True)
    _jobs.pop(project_id, None)
    return {"ok": True}
