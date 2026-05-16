import os
import httpx
from .base import StockItem, StockSource


async def search_pexels(keywords: list[str], media_type: str, page: int = 1, per_page: int = 12) -> list[StockItem]:
    key = os.environ.get("PEXELS_API_KEY", "")
    if not key:
        raise ValueError("PEXELS_API_KEY가 설정되지 않았습니다.")

    q = " ".join(keywords)
    headers = {"Authorization": key}

    if media_type == "video":
        url = "https://api.pexels.com/videos/search"
    else:
        url = "https://api.pexels.com/v1/search"

    params = {"query": q, "page": page, "per_page": per_page, "orientation": "landscape"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    results = []
    if media_type == "video":
        for v in data.get("videos", []):
            files = v.get("video_files", [])
            # HD 파일 우선
            hd = next((f for f in files if f.get("quality") == "hd"), None)
            sd = next((f for f in files if f.get("quality") == "sd"), None)
            dl = hd or sd or (files[0] if files else {})
            results.append(StockItem(
                id=str(v["id"]),
                source=StockSource.pexels,
                thumb_url=v.get("image", ""),
                preview_url=v.get("image", ""),
                download_url=dl.get("link", ""),
                width=v.get("width", 0),
                height=v.get("height", 0),
                media_type="video",
                duration=float(v.get("duration", 0)),
                attribution=f"Pexels · {v.get('user', {}).get('name', '')}",
            ))
    else:
        for p in data.get("photos", []):
            src = p.get("src", {})
            results.append(StockItem(
                id=str(p["id"]),
                source=StockSource.pexels,
                thumb_url=src.get("small", ""),
                preview_url=src.get("medium", ""),
                download_url=src.get("large2x", src.get("large", "")),
                width=p.get("width", 0),
                height=p.get("height", 0),
                media_type="photo",
                duration=None,
                attribution=f"Pexels · {p.get('photographer', '')}",
            ))
    return results
