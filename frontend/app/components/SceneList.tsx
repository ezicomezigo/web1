"use client";

import { AnalyzeResponse, MediaType, MoodType } from "../types";
import { Clock, Film, AlertTriangle, CheckCircle, Sparkles, Image, Video, Search } from "lucide-react";

interface Props {
  result: AnalyzeResponse;
}

function durationColor(sec: number) {
  if (sec < 12) return "text-red-500 bg-red-50 border-red-100";
  if (sec > 20) return "text-orange-500 bg-orange-50 border-orange-100";
  return "text-emerald-600 bg-emerald-50 border-emerald-100";
}

const MEDIA_CONFIG: Record<MediaType, { label: string; color: string; Icon: React.ElementType }> = {
  ai_image:    { label: "AI 이미지", color: "text-violet-700 bg-violet-50 border-violet-200", Icon: Sparkles },
  stock_photo: { label: "스톡 사진",  color: "text-sky-700 bg-sky-50 border-sky-200",         Icon: Image },
  stock_video: { label: "스톡 영상",  color: "text-teal-700 bg-teal-50 border-teal-200",      Icon: Video },
};

const MOOD_LABEL: Record<MoodType, string> = {
  bright:     "밝음",
  calm:       "차분",
  serious:    "진지",
  energetic:  "활기",
  dark:       "어두움",
  emotional:  "감성",
};

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

      {/* 원본 텍스트 검증 결과 */}
      {result.warnings.length === 0 ? (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-sm">
          <CheckCircle size={15} />
          원본 텍스트가 100% 보존되었습니다.
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle size={15} />
            원본 텍스트 커버리지 경고
          </div>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 pl-5">{w}</p>
          ))}
        </div>
      )}

      {/* 장면 목록 */}
      {result.scenes.map((scene) => {
        const media = MEDIA_CONFIG[scene.media.media_type];
        const MediaIcon = media.Icon;

        return (
          <div key={scene.scene_id} className="border border-gray-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">

            {/* 장면 헤더 */}
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold shrink-0">
                  {scene.scene_id}
                </span>
                <p className="text-sm font-medium text-gray-700 truncate">{scene.topic_summary}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {MOOD_LABEL[scene.media.mood]}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${durationColor(scene.estimated_duration)}`}>
                  {scene.estimated_duration.toFixed(1)}초
                </span>
              </div>
            </div>

            {/* 대본 텍스트 */}
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 mx-4 rounded-lg px-3 py-2.5 mb-3">
              {scene.text}
            </p>

            {/* 미디어 기획 */}
            <div className={`mx-4 mb-4 rounded-lg border px-3 py-2.5 ${media.color}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <MediaIcon size={13} />
                <span className="text-xs font-semibold">{media.label}</span>
              </div>

              {scene.media.media_type === "ai_image" && scene.media.ai_image_prompt && (
                <p className="text-xs leading-relaxed font-mono opacity-80">
                  {scene.media.ai_image_prompt}
                </p>
              )}

              {(scene.media.media_type === "stock_photo" || scene.media.media_type === "stock_video") &&
                scene.media.stock_keywords && (
                  <div className="flex flex-wrap gap-1.5">
                    <Search size={11} className="mt-0.5 opacity-60 shrink-0" />
                    {scene.media.stock_keywords.map((kw) => (
                      <span key={kw} className="text-xs bg-white/60 rounded px-1.5 py-0.5 border border-current/20">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
            </div>

          </div>
        );
      })}
    </div>
  );
}
