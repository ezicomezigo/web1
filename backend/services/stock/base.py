from enum import Enum
from pydantic import BaseModel


class StockSource(str, Enum):
    pixabay = "pixabay"
    pexels = "pexels"
    unsplash = "unsplash"


class StockItem(BaseModel):
    id: str
    source: StockSource
    thumb_url: str
    preview_url: str
    download_url: str
    width: int
    height: int
    media_type: str      # "photo" | "video"
    duration: float | None = None
    attribution: str = ""
