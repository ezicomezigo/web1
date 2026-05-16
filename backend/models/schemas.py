from pydantic import BaseModel, Field
from typing import Literal

GEMINI_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-3.1-pro-preview"]

MediaType = Literal["ai_image", "stock_photo", "stock_video"]
MoodType = Literal["bright", "calm", "serious", "energetic", "dark", "emotional"]


class MediaRatio(BaseModel):
    ai_image: int = 30       # AI 이미지 비율 (%)
    stock_photo: int = 30    # 스톡 사진 비율 (%)
    stock_video: int = 40    # 스톡 영상 비율 (%)


class AnalyzeRequest(BaseModel):
    script: str
    ai_provider: Literal["claude", "gemini"]
    gemini_model: str | None = None
    media_ratio: MediaRatio = MediaRatio()


class MediaPlan(BaseModel):
    media_type: MediaType
    ai_image_prompt: str | None = None        # media_type == "ai_image" 일 때
    stock_keywords: list[str] | None = None   # media_type == "stock_photo" | "stock_video" 일 때 (영어)
    mood: MoodType = "calm"


class SubtitleCue(BaseModel):
    start: float    # 초 단위
    end: float
    text: str


class SceneAssets(BaseModel):
    audio: str | None = None    # 상대경로: media/scene_1_audio.mp3
    visual: str | None = None   # 상대경로: media/scene_1_image.png
    subtitle: list[SubtitleCue] | None = None
    video: str | None = None    # 상대경로: media/scene_1_render.mp4 (장면별 렌더 결과)


class Scene(BaseModel):
    scene_id: int
    text: str
    topic_summary: str
    estimated_duration: float
    media: MediaPlan
    assets: SceneAssets = Field(default_factory=SceneAssets)


class AnalyzeResponse(BaseModel):
    scenes: list[Scene]
    total_duration: float
    total_scenes: int
    ai_provider: str
    model_used: str
    warnings: list[str] = []


# AI가 반환하는 중간 데이터 (텍스트 없이 인덱스 + 미디어 기획)
class SceneRange(BaseModel):
    scene_id: int
    start_idx: int
    end_idx: int
    topic_summary: str
    estimated_duration: float
    media: MediaPlan


class RenderSettings(BaseModel):
    """장면 렌더링 시 자막 스타일 설정."""
    subtitle_font_size: int = 22         # 자막 폰트 크기 (px, 1920 기준)
    subtitle_font_name: str | None = None  # None → 플랫폼 기본 한글 폰트
    subtitle_outline: int = 2            # 자막 외곽선 두께
