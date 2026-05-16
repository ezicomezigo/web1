import os
import httpx
from .base import StockItem, StockSource


async def search_unsplash(keywords: list[str], page: int = 1, per_page: int = 12) -> list[StockItem]:
    key = os.environ.get("UNSPLASH_API_KEY", "")
    if not key:
        raise ValueError("UNSPLASH_API_KEY가 설정되지 않았습니다.")

    q = " ".join(keywords)
    url = "https://api.unsplash.com/search/photos"
    params = {
        "query": q,
        "page": page,
        "per_page": per_page,
        "orientation": "landscape",
        "client_id": key,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for p in data.get("results", []):
        urls = p.get("urls", {})
        user = p.get("user", {})
        results.append(StockItem(
            id=p["id"],
            source=StockSource.unsplash,
            thumb_url=urls.get("thumb", ""),
            preview_url=urls.get("small", ""),
            download_url=urls.get("full", urls.get("regular", "")),
            width=p.get("width", 0),
            height=p.get("height", 0),
            media_type="photo",
            duration=None,
            attribution=f"Unsplash · {user.get('name', '')}",
        ))
    return results
