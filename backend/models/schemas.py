from pydantic import BaseModel
from typing import Literal

GEMINI_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-3.1-pro-preview"]


class AnalyzeRequest(BaseModel):
    script: str
    ai_provider: Literal["claude", "gemini"]
    gemini_model: str | None = None


class Scene(BaseModel):
    scene_id: int
    text: str            # 원본에서 재구성된 텍스트
    topic_summary: str
    estimated_duration: float


class AnalyzeResponse(BaseModel):
    scenes: list[Scene]
    total_duration: float
    total_scenes: int
    ai_provider: str
    model_used: str
    warnings: list[str] = []  # 원본 커버리지 검증 경고


# AI가 반환하는 중간 데이터 (텍스트 없이 인덱스만)
class SceneRange(BaseModel):
    scene_id: int
    start_idx: int
    end_idx: int
    topic_summary: str
    estimated_duration: float
