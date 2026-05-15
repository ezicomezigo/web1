from pydantic import BaseModel
from typing import Literal

GEMINI_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-3.1-pro-preview"]

class AnalyzeRequest(BaseModel):
    script: str
    ai_provider: Literal["claude", "gemini"]
    gemini_model: str | None = None  # gemini 선택 시 사용

class Scene(BaseModel):
    scene_id: int
    text: str
    topic_summary: str
    estimated_duration: float

class AnalyzeResponse(BaseModel):
    scenes: list[Scene]
    total_duration: float
    total_scenes: int
    ai_provider: str
    model_used: str
