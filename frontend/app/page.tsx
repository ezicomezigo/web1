"use client";

import { useState } from "react";
import { AIProvider, AnalyzeResponse, GeminiModel, GEMINI_MODELS, Scene } from "./types";
import { useProject } from "./hooks/useProject";
import AISelector from "./components/AISelector";
import ScriptInput from "./components/ScriptInput";
import SceneEditor from "./components/SceneEditor";
import MediaRatioSlider, { MediaRatio } from "./components/MediaRatioSlider";
import ProjectBar from "./components/ProjectBar";
import ProjectListModal from "./components/ProjectListModal";
import { Loader2, Scissors, FolderPlus } from "lucide-react";

const API_BASE = "http://localhost:8000";

export default function Home() {
  const {
    project, isDirty, isSaving, lastSavedAt, draft,
    createProject, createProjectWithData, loadProject, saveProject, deleteProject, renameProject, listProjects,
    setScript, setScenes, setAnalysisInfo, clearDraft,
  } = useProject();

  const [provider, setProvider] = useState<AIProvider>("claude");
  const [geminiModel, setGeminiModel] = useState<GeminiModel>(GEMINI_MODELS[0]);
  const [mediaRatio, setMediaRatio] = useState<MediaRatio>({ ai_image: 30, stock_photo: 30, stock_video: 40 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const script = project?.script ?? "";
  const scenes = project?.scenes ?? [];
  const analysisInfo = project?.analysis_info ?? null;

  // ─── 분석 ───────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!script.trim()) { setError("대본을 입력해주세요."); return; }
    if (!project) { setError("먼저 프로젝트를 만들거나 열어주세요."); return; }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          ai_provider: provider,
          gemini_model: provider === "gemini" ? geminiModel : undefined,
          media_ratio: mediaRatio,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "분석 중 오류가 발생했습니다.");
      }
      const data: AnalyzeResponse = await res.json();
      setScenes(data.scenes);
      setAnalysisInfo({ ai_provider: data.ai_provider, model_used: data.model_used, warnings: data.warnings });
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ─── 새 프로젝트 생성 ────────────────────────────────────────────────────
  async function handleCreate() {
    const name = newProjectName.trim() || "새 프로젝트";
    await createProject(name);
    setNewProjectName("");
    setShowNewProject(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">유튜브 영상 자동 생성기</h1>
          <p className="text-gray-500 text-sm mt-1">대본을 입력하면 AI가 장면을 자동으로 분할합니다</p>
        </div>

        {/* 프로젝트 바 */}
        <ProjectBar
          projectName={project?.name ?? null}
          isDirty={isDirty}
          isSaving={isSaving}
          lastSavedAt={lastSavedAt}
          isAnalyzing={loading}
          onOpenList={() => setShowProjects(true)}
          onSave={saveProject}
          onRenameInline={(name) => renameProject(project!.id, name)}
        />

        {/* draft 복원 배너 */}
        {draft && !project && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm text-blue-700">
              저장되지 않은 이전 작업이 있습니다.
            </p>
            <div className="flex gap-2 ml-4 shrink-0">
              <button
                onClick={async () => {
                  await createProjectWithData("복원된 프로젝트", {
                    script: draft.script,
                    scenes: draft.scenes.length ? draft.scenes : undefined,
                    analysis_info: draft.analysisInfo ?? undefined,
                  });
                  clearDraft();
                }}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                새 프로젝트로 복원
              </button>
              <button onClick={clearDraft} className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100">
                무시
              </button>
            </div>
          </div>
        )}

        {/* 프로젝트 없음 안내 */}
        {!project && !draft && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 flex flex-col items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
              <FolderPlus size={22} className="text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">프로젝트를 만들어 시작하세요</p>
              <p className="text-sm text-gray-400 mt-1">프로젝트 단위로 작업을 저장하고 관리할 수 있습니다</p>
            </div>
            {showNewProject ? (
              <div className="flex gap-2 w-full max-w-sm">
                <input
                  autoFocus
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewProject(false); }}
                  placeholder="프로젝트 이름"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">만들기</button>
                <button onClick={() => setShowNewProject(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">취소</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowNewProject(true)}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                  + 새 프로젝트
                </button>
                <button onClick={() => setShowProjects(true)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  기존 열기
                </button>
              </div>
            )}
          </div>
        )}

        {/* 입력 패널 (프로젝트 열린 경우만) */}
        {project && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-6 mb-6">
            <ScriptInput value={script} onChange={setScript} />
            <AISelector
              provider={provider}
              geminiModel={geminiModel}
              onProviderChange={setProvider}
              onGeminiModelChange={setGeminiModel}
            />
            <MediaRatioSlider value={mediaRatio} onChange={setMediaRatio} />

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading || !script.trim()}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> AI가 대본을 분석 중...</>
                : <><Scissors size={16} /> 장면 분할 시작</>
              }
            </button>
          </div>
        )}

        {/* 장면 편집 */}
        {project && analysisInfo && scenes.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">장면 편집</h2>
            <SceneEditor
              scenes={scenes}
              onChange={setScenes}
              warnings={analysisInfo.warnings}
              aiProvider={analysisInfo.ai_provider}
              modelUsed={analysisInfo.model_used}
            />
          </div>
        )}
      </div>

      {/* 프로젝트 목록 모달 */}
      {showProjects && (
        <ProjectListModal
          currentProjectId={project?.id ?? null}
          onOpen={loadProject}
          onCreate={async (name) => { await createProject(name); }}
          onDelete={deleteProject}
          onRename={renameProject}
          onClose={() => setShowProjects(false)}
          listProjects={listProjects}
        />
      )}
    </main>
  );
}
