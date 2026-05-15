import shutil
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException

from models.project import Project, ProjectMeta, ProjectCreateRequest, ProjectSaveRequest

router = APIRouter(prefix="/api/projects", tags=["projects"])

PROJECTS_DIR = Path(__file__).parent.parent / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


def project_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id


def project_file(project_id: str) -> Path:
    return project_path(project_id) / "project.json"


def load_project(project_id: str) -> Project:
    pf = project_file(project_id)
    if not pf.exists():
        raise HTTPException(status_code=404, detail=f"프로젝트를 찾을 수 없습니다: {project_id}")
    return Project.model_validate_json(pf.read_text(encoding="utf-8"))


def save_project(project: Project) -> None:
    path = project_path(project.id)
    path.mkdir(exist_ok=True)
    (path / "media").mkdir(exist_ok=True)
    project_file(project.id).write_text(
        project.model_dump_json(indent=2), encoding="utf-8"
    )


@router.get("", response_model=list[ProjectMeta])
def list_projects():
    metas = []
    for d in sorted(PROJECTS_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        pf = d / "project.json"
        if not pf.exists():
            continue
        try:
            p = Project.model_validate_json(pf.read_text(encoding="utf-8"))
            metas.append(ProjectMeta(
                id=p.id, name=p.name,
                created_at=p.created_at, updated_at=p.updated_at,
                scene_count=len(p.scenes),
            ))
        except Exception:
            continue
    return metas


@router.post("", response_model=Project, status_code=201)
def create_project(req: ProjectCreateRequest):
    project = Project(name=req.name.strip() or "새 프로젝트")
    save_project(project)
    return project


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str):
    return load_project(project_id)


@router.put("/{project_id}", response_model=Project)
def update_project(project_id: str, req: ProjectSaveRequest):
    project = load_project(project_id)
    if req.name is not None:
        project.name = req.name.strip() or project.name
    if req.script is not None:
        project.script = req.script
    if req.analysis_info is not None:
        project.analysis_info = req.analysis_info
    if req.scenes is not None:
        project.scenes = req.scenes
    project.updated_at = datetime.now().isoformat()
    save_project(project)
    return project


@router.patch("/{project_id}/rename", response_model=ProjectMeta)
def rename_project(project_id: str, req: ProjectCreateRequest):
    project = load_project(project_id)
    project.name = req.name.strip() or project.name
    project.updated_at = datetime.now().isoformat()
    save_project(project)
    return ProjectMeta(
        id=project.id, name=project.name,
        created_at=project.created_at, updated_at=project.updated_at,
        scene_count=len(project.scenes),
    )


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str):
    path = project_path(project_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    shutil.rmtree(path)
