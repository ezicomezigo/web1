"use client";

import { MediaPlan, MediaType, MoodType } from "../types";
import { Sparkles, Image, Video } from "lucide-react";

interface Props {
  value: MediaPlan;
  onChange: (m: MediaPlan) => void;
}

const MEDIA_OPTIONS: { type: MediaType; label: string; Icon: React.ElementType }[] = [
  { type: "ai_image",    label: "AI 이미지", Icon: Sparkles },
  { type: "stock_photo", label: "스톡 사진",  Icon: Image },
  { type: "stock_video", label: "스톡 영상",  Icon: Video },
];

const MOODS: { value: MoodType; label: string }[] = [
  { value: "bright",    label: "밝음" },
  { value: "calm",      label: "차분" },
  { value: "serious",   label: "진지" },
  { value: "energetic", label: "활기" },
  { value: "dark",      label: "어두움" },
  { value: "emotional", label: "감성" },
];

export default function MediaPlanEditor({ value, onChange }: Props) {
  function setType(type: MediaType) {
    onChange({ ...value, media_type: type, ai_image_prompt: null, stock_keywords: null });
  }

  function setPrompt(prompt: string) {
    onChange({ ...value, ai_image_prompt: prompt || null });
  }

  function setKeywords(raw: string) {
    const kws = raw.split(',').map(k => k.trim()).filter(Boolean);
    onChange({ ...value, stock_keywords: kws.length > 0 ? kws : null });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 미디어 유형 */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">미디어 유형</label>
        <div className="flex gap-2">
          {MEDIA_OPTIONS.map(({ type, label, Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => setType(type)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                value.media_type === type
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* AI 이미지 프롬프트 */}
      {value.media_type === "ai_image" && (
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">이미지 생성 프롬프트 (영어)</label>
          <textarea
            rows={2}
            value={value.ai_image_prompt ?? ""}
            onChange={e => setPrompt(e.target.value)}
            placeholder="A dramatic landscape at sunset, cinematic lighting, ultra-realistic..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      )}

      {/* 스톡 검색 키워드 */}
      {(value.media_type === "stock_photo" || value.media_type === "stock_video") && (
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">검색 키워드 (영어, 쉼표 구분)</label>
          <input
            type="text"
            value={(value.stock_keywords ?? []).join(', ')}
            onChange={e => setKeywords(e.target.value)}
            placeholder="business meeting, office, teamwork"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      )}

      {/* 무드 */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">분위기 (mood)</label>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map(({ value: v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ ...value, mood: v })}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                value.mood === v
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
