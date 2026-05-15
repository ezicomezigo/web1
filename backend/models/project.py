from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from models.schemas import Scene


class AnalysisInfo(BaseModel):
    ai_provider: str
    model_used: str
    warnings: list[str] = []


class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    script: str = ""
    analysis_info: AnalysisInfo | None = None
    scenes: list[Scene] = []


class ProjectMeta(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str
    scene_count: int


class ProjectCreateRequest(BaseModel):
    name: str


class ProjectSaveRequest(BaseModel):
    name: str | None = None
    script: str | None = None
    analysis_info: AnalysisInfo | None = None
    scenes: list[Scene] | None = None
