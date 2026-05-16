import os
import httpx
from .base import StockItem, StockSource


async def search_pixabay(keywords: list[str], media_type: str, page: int = 1, per_page: int = 12) -> list[StockItem]:
    key = os.environ.get("PIXABAY_API_KEY", "")
    if not key:
        raise ValueError("PIXABAY_API_KEY가 설정되지 않았습니다.")

    q = " ".join(keywords)
    if media_type == "video":
        url = "https://pixabay.com/api/videos/"
    else:
        url = "https://pixabay.com/api/"

    params = {
        "key": key,
        "q": q,
        "page": page,
        "per_page": per_page,
        "safesearch": "true",
        "lang": "ko",
    }
    if media_type == "photo":
        params["image_type"] = "photo"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for hit in data.get("hits", []):
        if media_type == "video":
            medium = hit.get("videos", {}).get("medium", {})
            small = hit.get("videos", {}).get("small", {})
            results.append(StockItem(
                id=str(hit["id"]),
                source=StockSource.pixabay,
                thumb_url=hit.get("picture_id") and f"https://i.vimeocdn.com/video/{hit['picture_id']}_295x166.jpg" or "",
                preview_url=small.get("url", medium.get("url", "")),
                download_url=medium.get("url", small.get("url", "")),
                width=medium.get("width", 0),
                height=medium.get("height", 0),
                media_type="video",
                duration=float(hit.get("duration", 0)),
                attribution=f"Pixabay · {hit.get('user', '')}",
            ))
        else:
            results.append(StockItem(
                id=str(hit["id"]),
                source=StockSource.pixabay,
                thumb_url=hit.get("previewURL", ""),
                preview_url=hit.get("webformatURL", ""),
                download_url=hit.get("largeImageURL", hit.get("webformatURL", "")),
                width=hit.get("imageWidth", 0),
                height=hit.get("imageHeight", 0),
                media_type="photo",
                duration=None,
                attribution=f"Pixabay · {hit.get('user', '')}",
            ))
    return results
