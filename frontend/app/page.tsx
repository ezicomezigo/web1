"use client";

import { useState } from "react";
import { AIProvider, AnalyzeResponse, GeminiModel, GEMINI_MODELS, Scene } from "./types";
import AISelector from "./components/AISelector";
import ScriptInput from "./components/ScriptInput";
import SceneEditor from "./components/SceneEditor";
import MediaRatioSlider, { MediaRatio } from "./components/MediaRatioSlider";
import { Loader2, Scissors } from "lucide-react";

const API_BASE = "http://localhost:8000";

export default function Home() {
  const [script, setScript] = useState("");
  const [provider, setProvider] = useState<AIProvider>("claude");
  const [geminiModel, setGeminiModel] = useState<GeminiModel>(GEMINI_MODELS[0]);
  const [mediaRatio, setMediaRatio] = useState<MediaRatio>({ ai_image: 30, stock_photo: 30, stock_video: 40 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 분석 결과에서 장면 목록을 분리해서 편집 가능한 상태로 관리
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [analysisInfo, setAnalysisInfo] = useState<{
    aiProvider: string; modelUsed: string; warnings: string[];
  } | null>(null);

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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">유튜브 영상 자동 생성기</h1>
          <p className="text-gray-500 text-sm mt-1">대본을 입력하면 AI가 장면을 자동으로 분할합니다</p>
        </div>

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
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> AI가 대본을 분석 중...</>
            ) : (
              <><Scissors size={16} /> 장면 분할 시작</>
            )}
          </button>
        </div>

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
