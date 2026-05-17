import logging
import random
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


class StockAutoSelectRequest(BaseModel):
    source: StockSource
    top_k: int = 10        # 검색 결과 상위 N개 중 랜덤 선택
    per_page: int = 15


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


async def _search_stock(source: StockSource, media_type: Literal["photo", "video"],
                        keywords: list[str], page: int, per_page: int) -> list[StockItem]:
    """검색 함수 통합 - 소스별 분기."""
    if source == StockSource.pixabay:
        from services.stock.pixabay import search_pixabay
        return await search_pixabay(keywords, media_type, page, per_page)
    elif source == StockSource.pexels:
        from services.stock.pexels import search_pexels
        return await search_pexels(keywords, media_type, page, per_page)
    elif source == StockSource.unsplash:
        if media_type == "video":
            raise HTTPException(400, "Unsplash는 사진만 지원합니다.")
        from services.stock.unsplash import search_unsplash
        return await search_unsplash(keywords, page, per_page)
    raise HTTPException(400, f"지원하지 않는 소스: {source}")


async def _download_and_save(project_id: str, scene_id: int, idx: int, project,
                              download_url: str, media_type: Literal["photo", "video"]) -> str:
    """선택된 스톡 미디어를 다운로드하고 장면에 적용한다. 반환: rel_path."""
    kind = "video" if media_type == "video" else "image"
    media_dir = project_path(project_id) / "media"
    media_dir.mkdir(exist_ok=True)

    # 기존 비주얼 삭제
    old_rel = project.scenes[idx].assets.visual
    if old_rel:
        old_path = project_path(project_id) / old_rel
        old_path.unlink(missing_ok=True)

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = await client.get(download_url)
        resp.raise_for_status()
        content = resp.content

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
    else:
        ext = ".mp4" if kind == "video" else ".jpg"

    filename = f"scene_{scene_id}_{kind}{ext}"
    (media_dir / filename).write_bytes(content)
    return f"media/{filename}"


@router.post("/{project_id}/scenes/{scene_id}/visual/auto-select")
async def auto_select_stock(project_id: str, scene_id: int, req: StockAutoSelectRequest):
    """장면의 stock_keywords로 자동 검색 후 상위 결과 중 랜덤 선택해 적용."""
    project = load_project(project_id)
    idx = next((i for i, s in enumerate(project.scenes) if s.scene_id == scene_id), None)
    if idx is None:
        raise HTTPException(404, f"장면 {scene_id}를 찾을 수 없습니다.")

    scene = project.scenes[idx]
    media_type_str = scene.media.media_type
    if media_type_str not in ("stock_photo", "stock_video"):
        raise HTTPException(400, f"장면 {scene_id}는 스톡 미디어 타입이 아닙니다.")
    api_media_type: Literal["photo", "video"] = "video" if media_type_str == "stock_video" else "photo"

    keywords = scene.media.stock_keywords or []
    if not keywords_ok(keywords):
        raise HTTPException(400, "장면에 검색 키워드가 없습니다.")

    # Unsplash는 영상 미지원 → 자동으로 pexels로 폴백
    source = req.source
    if source == StockSource.unsplash and api_media_type == "video":
        source = StockSource.pexels

    try:
        results = await _search_stock(source, api_media_type, keywords, 1, req.per_page)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Stock search failed (scene %d): %s", scene_id, e)
        raise HTTPException(500, f"검색 실패: {e}")

    if not results:
        raise HTTPException(404, "검색 결과가 없습니다.")

    # 상위 top_k 중에서 랜덤 선택 (관련도 순 검색 결과의 상위만 사용)
    top_k = max(1, min(req.top_k, len(results)))
    pick = random.choice(results[:top_k])

    try:
        rel_path = await _download_and_save(project_id, scene_id, idx, project, pick.download_url, api_media_type)
    except Exception as e:
        logger.error("Stock download failed (scene %d): %s", scene_id, e)
        raise HTTPException(500, f"파일 다운로드 실패: {e}")

    project.scenes[idx].assets = SceneAssets(
        audio=scene.assets.audio,
        visual=rel_path,
        subtitle=scene.assets.subtitle,
        video=scene.assets.video,
    )
    save_project(project)
    return {"visual_path": rel_path, "attribution": pick.attribution, "source": pick.source}
