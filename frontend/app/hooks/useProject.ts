"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Project, ProjectMeta, Scene, AnalysisInfo } from "../types";

const API = "http://localhost:8000/api/projects";
const LAST_PROJECT_KEY = "yt-last-project-id";
const DRAFT_KEY = "yt-generator-draft";

interface Draft {
  script: string;
  scenes: Scene[];
  analysisInfo: AnalysisInfo | null;
  savedAt: string;
}

export interface UseProjectReturn {
  project: Project | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  draft: Draft | null;

  createProject: (name: string) => Promise<Project>;
  createProjectWithData: (name: string, data: Partial<Pick<Project, "script" | "scenes" | "analysis_info">>) => Promise<Project>;
  loadProject: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  listProjects: () => Promise<ProjectMeta[]>;

  setScript: (s: string) => void;
  setScenes: (s: Scene[] | ((prev: Scene[]) => Scene[])) => void;
  setAnalysisInfo: (a: AnalysisInfo | null) => void;
  clearDraft: () => void;
  discardProject: () => void;
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((e: { loc?: string[]; msg?: string }) =>
            `${(e.loc ?? []).slice(1).join(".")}: ${e.msg ?? "오류"}`
          )
          .join("; ");
      } else {
        detail = JSON.stringify(body);
      }
    } catch {}
    throw new Error(detail);
  }
  return res;
}

export function useProject(): UseProjectReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 페이지 로드: 마지막 프로젝트 복원 또는 draft 확인
  useEffect(() => {
    const lastId = localStorage.getItem(LAST_PROJECT_KEY);
    if (lastId) {
      fetch(`${API}/${lastId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) { setProject(data); setLastSavedAt(data.updated_at); } })
        .catch(() => {});
    } else {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // 구버전 draft는 analysisInfo가 camelCase일 수 있음 → snake_case로 정규화
          if (parsed.analysisInfo && !parsed.analysisInfo.ai_provider) {
            parsed.analysisInfo = {
              ai_provider: parsed.analysisInfo.aiProvider ?? "",
              model_used: parsed.analysisInfo.modelUsed ?? "",
              warnings: parsed.analysisInfo.warnings ?? [],
            };
          }
          setDraft(parsed);
        } catch {}
      }
    }
  }, []);

  // Ctrl+S 저장
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (project && isDirty) saveProject();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // 자동저장 (30초, 변경 있을 때만)
  useEffect(() => {
    if (!isDirty || !project) return;
    autoSaveTimer.current = setTimeout(() => saveProject(), 30_000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [isDirty, project?.scenes, project?.script]);

  // 프로젝트 없을 때 draft를 localStorage에 보존 (1초 디바운스)
  useEffect(() => {
    if (project) return;
    const timer = setTimeout(() => {
      if (!draft) return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 1000);
    return () => clearTimeout(timer);
  }, [draft, project]);

  const saveProject = useCallback(async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      const res = await apiFetch(`${API}/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          script: project.script,
          analysis_info: project.analysis_info,
          scenes: project.scenes,
        }),
      });
      const saved: Project = await res.json();
      setProject(saved);
      setIsDirty(false);
      setLastSavedAt(saved.updated_at);
      localStorage.removeItem(DRAFT_KEY);
    } finally {
      setIsSaving(false);
    }
  }, [project]);

  async function createProject(name: string): Promise<Project> {
    const res = await apiFetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const p: Project = await res.json();
    setProject(p);
    setIsDirty(false);
    setLastSavedAt(p.updated_at);
    localStorage.setItem(LAST_PROJECT_KEY, p.id);
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
    return p;
  }

  // draft 복원용: 생성 + 데이터를 한 번에 저장 (stale closure 문제 방지)
  async function createProjectWithData(
    name: string,
    data: Partial<Pick<Project, "script" | "scenes" | "analysis_info">>
  ): Promise<Project> {
    // 1) 빈 프로젝트 생성
    const createRes = await apiFetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const newProject: Project = await createRes.json();

    // 2) 데이터를 바로 저장 (setState 비동기 문제 없이 직접 API 호출)
    const saveRes = await apiFetch(`${API}/${newProject.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newProject.name,
        script: data.script ?? "",
        analysis_info: data.analysis_info ?? null,
        scenes: data.scenes ?? [],
      }),
    });
    const saved: Project = await saveRes.json();

    setProject(saved);
    setIsDirty(false);
    setLastSavedAt(saved.updated_at);
    localStorage.setItem(LAST_PROJECT_KEY, saved.id);
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
    return saved;
  }

  async function loadProject(id: string): Promise<void> {
    const res = await apiFetch(`${API}/${id}`);
    const p: Project = await res.json();
    setProject(p);
    setIsDirty(false);
    setLastSavedAt(p.updated_at);
    localStorage.setItem(LAST_PROJECT_KEY, id);
  }

  async function deleteProject(id: string): Promise<void> {
    await apiFetch(`${API}/${id}`, { method: "DELETE" });
    if (project?.id === id) {
      setProject(null);
      setIsDirty(false);
      localStorage.removeItem(LAST_PROJECT_KEY);
    }
  }

  async function renameProject(id: string, name: string): Promise<void> {
    await apiFetch(`${API}/${id}/rename`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (project?.id === id) setProject(p => p ? { ...p, name } : p);
  }

  async function listProjects(): Promise<ProjectMeta[]> {
    const res = await apiFetch(API);
    return res.json();
  }

  function setScript(script: string) {
    setProject(p => p ? { ...p, script } : p);
    setDraft(d => d ? { ...d, script, savedAt: new Date().toISOString() } : null);
    setIsDirty(true);
  }

  function setScenes(scenes: Scene[] | ((prev: Scene[]) => Scene[])) {
    setProject(p => {
      if (!p) return p;
      const next = typeof scenes === "function" ? scenes(p.scenes) : scenes;
      return { ...p, scenes: next };
    });
    setDraft(d => {
      if (!d) return null;
      const next = typeof scenes === "function" ? scenes(d.scenes) : scenes;
      return { ...d, scenes: next, savedAt: new Date().toISOString() };
    });
    setIsDirty(true);
  }

  function setAnalysisInfo(analysis_info: AnalysisInfo | null) {
    setProject(p => p ? { ...p, analysis_info } : p);
    setDraft(d => d ? { ...d, analysisInfo: analysis_info, savedAt: new Date().toISOString() } : null);
    setIsDirty(true);
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
  }

  function discardProject() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setProject(null);
    setIsDirty(false);
    localStorage.removeItem(LAST_PROJECT_KEY);
  }

  return {
    project, isDirty, isSaving, lastSavedAt, draft,
    createProject, createProjectWithData,
    loadProject, saveProject, deleteProject, renameProject, listProjects,
    setScript, setScenes, setAnalysisInfo,
    clearDraft, discardProject,
  };
}
