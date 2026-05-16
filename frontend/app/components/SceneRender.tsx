"use client";

import { useState } from "react";
import { Clapperboard, Loader2, RotateCcw, Trash, Play } from "lucide-react";

const API_BASE = "http://localhost:8000";

interface Props {
  projectId: string;
  sceneId: number;
  hasAudio: boolean;
  videoPath: string | null | undefined;
  onChange: (sceneId: number, videoPath: string | null) => void;
}

export default function SceneRender({ projectId, sceneId, hasAudio, videoPath, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoUrl = videoPath
    ? `${API_BASE}/api/projects/${projectId}/${videoPath}`
    : null;

  async function render() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/render`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data: { video_path: string } = await res.json();
      onChange(sceneId, data.video_path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "렌더링 실패");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRender() {
    await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/render`, { method: "DELETE" });
    onChange(sceneId, null);
  }

  if (!hasAudio) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clapperboard size={12} />
          <span>오디오 생성 후 장면 영상을 렌더링할 수 있습니다</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Clapperboard size={12} className={videoUrl ? "text-emerald-600" : "text-gray-400"} />
          <span className={`text-xs font-medium flex-1 ${videoUrl ? "text-emerald-700" : "text-gray-400"}`}>
            {videoUrl ? "장면 영상 렌더 완료" : "장면 영상 없음"}
          </span>
          {videoUrl && (
            <>
              <button onClick={render} disabled={loading}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 disabled:opacity-40">
                {loading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} 재렌더
              </button>
              <button onClick={deleteRender}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
                <Trash size={11} />
              </button>
            </>
          )}
          {!videoUrl && (
            <button
              onClick={render}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading
                ? <><Loader2 size={11} className="animate-spin" /> 렌더링 중...</>
                : <><Clapperboard size={11} /> 장면 렌더</>
              }
            </button>
          )}
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2 leading-relaxed break-words">
            {error}
          </div>
        )}
        {videoUrl && (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            className="w-full max-h-48 rounded-lg bg-black"
          />
        )}
      </div>
    </div>
  );
}
