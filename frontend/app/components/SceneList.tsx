"use client";

import { AnalyzeResponse } from "../types";
import { Clock, Film } from "lucide-react";

interface Props {
  result: AnalyzeResponse;
}

function durationColor(sec: number) {
  if (sec < 12) return "text-red-500 bg-red-50";
  if (sec > 20) return "text-orange-500 bg-orange-50";
  return "text-emerald-600 bg-emerald-50";
}

export default function SceneList({ result }: Props) {
  const totalMin = Math.floor(result.total_duration / 60);
  const totalSec = Math.round(result.total_duration % 60);

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
        <div className="flex items-center gap-2 text-indigo-700">
          <Film size={16} />
          <span className="font-semibold text-sm">{result.total_scenes}개 장면</span>
        </div>
        <div className="flex items-center gap-2 text-indigo-600 text-sm">
          <Clock size={14} />
          <span>총 {totalMin > 0 ? `${totalMin}분 ` : ""}{totalSec}초</span>
        </div>
        <span className="text-xs text-indigo-400">
          {result.ai_provider === "claude" ? "Claude" : "Gemini"} · {result.model_used}
        </span>
      </div>

      {/* 장면 목록 */}
      {result.scenes.map((scene) => (
        <div
          key={scene.scene_id}
          className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold shrink-0">
                {scene.scene_id}
              </span>
              <p className="text-sm font-medium text-gray-700">{scene.topic_summary}</p>
            </div>
            <span
              className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${durationColor(
                scene.estimated_duration
              )}`}
            >
              {scene.estimated_duration.toFixed(1)}초
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2.5">
            {scene.text}
          </p>
        </div>
      ))}
    </div>
  );
}
