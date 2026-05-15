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
  loadProject: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  listProjects: () => Promise<ProjectMeta[]>;

  setScript: (s: string) => void;
  setScenes: (s: Scene[]) => void;
  setAnalysisInfo: (a: AnalysisInfo | null) => void;
  clearDraft: () => void;
  restoreFromDraft: (draft: Draft) => void;
  discardProject: () => void;
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
        try { setDraft(JSON.parse(raw)); } catch {}
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

  // 프로젝트 없을 때 draft 저장 (1초 디바운스)
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
      const res = await fetch(`${API}/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          script: project.script,
          analysis_info: project.analysis_info,
          scenes: project.scenes,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
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
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("프로젝트 생성 실패");
    const p: Project = await res.json();
    setProject(p);
    setIsDirty(false);
    setLastSavedAt(p.updated_at);
    localStorage.setItem(LAST_PROJECT_KEY, p.id);
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
    return p;
  }

  async function loadProject(id: string): Promise<void> {
    const res = await fetch(`${API}/${id}`);
    if (!res.ok) throw new Error("불러오기 실패");
    const p: Project = await res.json();
    setProject(p);
    setIsDirty(false);
    setLastSavedAt(p.updated_at);
    localStorage.setItem(LAST_PROJECT_KEY, id);
  }

  async function deleteProject(id: string): Promise<void> {
    const res = await fetch(`${API}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("삭제 실패");
    if (project?.id === id) {
      setProject(null);
      setIsDirty(false);
      localStorage.removeItem(LAST_PROJECT_KEY);
    }
  }

  async function renameProject(id: string, name: string): Promise<void> {
    const res = await fetch(`${API}/${id}/rename`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("이름 변경 실패");
    if (project?.id === id) setProject(p => p ? { ...p, name } : p);
  }

  async function listProjects(): Promise<ProjectMeta[]> {
    const res = await fetch(API);
    if (!res.ok) throw new Error("목록 불러오기 실패");
    return res.json();
  }

  function setScript(script: string) {
    setProject(p => p ? { ...p, script } : p);
    if (!project) setDraft(d => ({ ...(d ?? { scenes: [], analysisInfo: null, savedAt: "" }), script, savedAt: new Date().toISOString() }));
    setIsDirty(true);
  }

  function setScenes(scenes: Scene[]) {
    setProject(p => p ? { ...p, scenes } : p);
    if (!project) setDraft(d => ({ ...(d ?? { script: "", analysisInfo: null, savedAt: "" }), scenes, savedAt: new Date().toISOString() }));
    setIsDirty(true);
  }

  function setAnalysisInfo(analysis_info: AnalysisInfo | null) {
    setProject(p => p ? { ...p, analysis_info } : p);
    if (!project) setDraft(d => ({ ...(d ?? { script: "", scenes: [], savedAt: "" }), analysisInfo: analysis_info, savedAt: new Date().toISOString() }));
    setIsDirty(true);
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
  }

  function restoreFromDraft(d: Draft) {
    setProject(null);
    setDraft(d);
  }

  function discardProject() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setProject(null);
    setIsDirty(false);
    localStorage.removeItem(LAST_PROJECT_KEY);
  }

  return {
    project, isDirty, isSaving, lastSavedAt, draft,
    createProject, loadProject, saveProject, deleteProject, renameProject, listProjects,
    setScript, setScenes, setAnalysisInfo,
    clearDraft, restoreFromDraft, discardProject,
  };
}
