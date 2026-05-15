"use client";

import { useState, useEffect, useCallback } from "react";
import { AIProvider, AnalyzeResponse, GeminiModel, GEMINI_MODELS, Scene } from "./types";
import AISelector from "./components/AISelector";
import ScriptInput from "./components/ScriptInput";
import SceneEditor from "./components/SceneEditor";
import MediaRatioSlider, { MediaRatio } from "./components/MediaRatioSlider";
import { Loader2, Scissors, RotateCcw, Save } from "lucide-react";

const API_BASE = "http://localhost:8000";
const DRAFT_KEY = "yt-generator-draft";

interface DraftData {
  script: string;
  scenes: Scene[];
  analysisInfo: { aiProvider: string; modelUsed: string; warnings: string[] } | null;
  savedAt: string;
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const [script, setScript] = useState("");
  const [provider, setProvider] = useState<AIProvider>("claude");
  const [geminiModel, setGeminiModel] = useState<GeminiModel>(GEMINI_MODELS[0]);
  const [mediaRatio, setMediaRatio] = useState<MediaRatio>({ ai_image: 30, stock_photo: 30, stock_video: 40 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [analysisInfo, setAnalysisInfo] = useState<{
    aiProvider: string; modelUsed: string; warnings: string[];
  } | null>(null);

  // 자동저장 관련
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [dismissedRestore, setDismissedRestore] = useState(false);

  // 페이지 로드 시 draft 복원
  useEffect(() => {
    const draft = loadDraft();
    if (draft?.scenes?.length) {
      setScript(draft.script ?? "");
      setScenes(draft.scenes);
      setAnalysisInfo(draft.analysisInfo ?? null);
      setRestoredAt(draft.savedAt);
      setLastSavedAt(draft.savedAt);
    }
  }, []);

  // 장면/대본 변경 시 자동저장 (1초 디바운스)
  useEffect(() => {
    if (!scenes.length && !script) return;
    const timer = setTimeout(() => {
      const now = new Date().toISOString();
      const draft: DraftData = { script, scenes, analysisInfo, savedAt: now };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setLastSavedAt(now);
      } catch (e) {
        console.warn("자동저장 실패:", e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [scenes, script, analysisInfo]);

  function clearDraft() {
    if (!confirm("저장된 작업을 모두 삭제하고 새로 시작하시겠습니까?")) return;
    localStorage.removeItem(DRAFT_KEY);
    setScript(""); setScenes([]); setAnalysisInfo(null);
    setRestoredAt(null); setLastSavedAt(null);
  }

  async function handleAnalyze() {
    if (!script.trim()) { setError("대본을 입력해주세요."); return; }
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
      setAnalysisInfo({ aiProvider: data.ai_provider, modelUsed: data.model_used, warnings: data.warnings });
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">유튜브 영상 자동 생성기</h1>
            <p className="text-gray-500 text-sm mt-1">대본을 입력하면 AI가 장면을 자동으로 분할합니다</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastSavedAt && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Save size={11} /> {formatTime(lastSavedAt)} 저장됨
              </span>
            )}
            {(scenes.length > 0 || script) && (
              <button onClick={clearDraft} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                <RotateCcw size={11} /> 초기화
              </button>
            )}
          </div>
        </div>

        {/* 자동복원 배너 */}
        {restoredAt && !dismissedRestore && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm text-blue-700">
              이전 작업이 복원되었습니다 — {formatTime(restoredAt)} 저장본
            </p>
            <button onClick={() => setDismissedRestore(true)} className="text-blue-400 hover:text-blue-600 text-xs ml-4 shrink-0">
              닫기
            </button>
          </div>
        )}

        {/* 입력 패널 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-6">
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

        {/* 장면 편집 */}
        {analysisInfo && scenes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4">장면 편집</h2>
            <SceneEditor
              scenes={scenes}
              onChange={setScenes}
              warnings={analysisInfo.warnings}
              aiProvider={analysisInfo.aiProvider}
              modelUsed={analysisInfo.modelUsed}
            />
          </div>
        )}
      </div>
    </main>
  );
}
