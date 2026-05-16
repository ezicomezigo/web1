import logging
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.schemas import SceneAssets
from routers.projects import load_project, save_project, project_path
from services.stock.base import StockItem, StockSource

router = APIRouter(prefix="/api/projects", tags=["stock"])
logger = logging.getLogger(__name__)


class StockSearchRequest(BaseModel):
    source: StockSource
    media_type: Literal["photo", "video"]
    keywords: list[str]
    page: int = 1
    per_page: int = 15


class StockSelectRequest(BaseModel):
    download_url: str
    source: StockSource
    media_type: Literal["photo", "video"]
    attribution: str = ""


@router.post("/{project_id}/scenes/{scene_id}/visual/search", response_model=list[StockItem])
async def search_stock(project_id: str, scene_id: int, req: StockSearchRequest):
    if not keywords_ok(req.keywords):
        raise HTTPException(400, "키워드가 없습니다.")
    try:
        if req.source == StockSource.pixabay:
            from services.stock.pixabay import search_pixabay
            return await search_pixabay(req.keywords, req.media_type, req.page, req.per_page)
        elif req.source == StockSource.pexels:
            from services.stock.pexels import search_pexels
            return await search_pexels(req.keywords, req.media_type, req.page, req.per_page)
        elif req.source == StockSource.unsplash:
            if req.media_type == "video":
                raise HTTPException(400, "Unsplash는 사진만 지원합니다.")
            from services.stock.unsplash import search_unsplash
            return await search_unsplash(req.keywords, req.page, req.per_page)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("Stock search failed: %s", e)
        raise HTTPException(500, f"검색 실패: {e}")


@router.post("/{project_id}/scenes/{scene_id}/visual/select")
async def select_stock(project_id: str, scene_id: int, req: StockSelectRequest):
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    ext = ".mp4" if req.media_type == "video" else ".jpg"
    kind = "video" if req.media_type == "video" else "image"
    filename = f"scene_{scene_id}_{kind}{ext}"

    media_dir = project_path(project_id) / "media"
    media_dir.mkdir(exist_ok=True)

    # 기존 파일 삭제
    old_rel = project.scenes[idx].assets.visual
    if old_rel:
        old_path = project_path(project_id) / old_rel
        if old_path.exists():
            old_path.unlink()

    # 다운로드
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(req.download_url)
            resp.raise_for_status()
            content = resp.content

        # 실제 확장자를 Content-Type에서 추출
        ct = resp.headers.get("content-type", "")
        if "jpeg" in ct or "jpg" in ct:
            ext = ".jpg"
        elif "png" in ct:
            ext = ".png"
        elif "webp" in ct:
            ext = ".webp"
        elif "mp4" in ct:
            ext = ".mp4"
        elif "webm" in ct:
            ext = ".webm"
        filename = f"scene_{scene_id}_{kind}{ext}"
        (media_dir / filename).write_bytes(content)
    except Exception as e:
        logger.error("Stock download failed: %s", e)
        raise HTTPException(500, f"파일 다운로드 실패: {e}")

    rel_path = f"media/{filename}"
    project.scenes[idx].assets = SceneAssets(
        audio=project.scenes[idx].assets.audio,
        visual=rel_path,
    )
    save_project(project)
    return {"visual_path": rel_path, "attribution": req.attribution}


def keywords_ok(keywords: list[str]) -> bool:
    return bool(keywords) and any(k.strip() for k in keywords)
