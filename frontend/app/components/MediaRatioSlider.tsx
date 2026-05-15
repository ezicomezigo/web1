"use client";

import { useState } from "react";

export interface MediaRatio {
  ai_image: number;
  stock_photo: number;
  stock_video: number;
}

interface Props {
  value: MediaRatio;
  onChange: (r: MediaRatio) => void;
  disabled?: boolean;
}

const KEYS: { key: keyof MediaRatio; label: string; color: string }[] = [
  { key: "ai_image",    label: "AI 이미지",  color: "bg-violet-500" },
  { key: "stock_photo", label: "스톡 사진",  color: "bg-sky-500" },
  { key: "stock_video", label: "스톡 영상",  color: "bg-teal-500" },
];

export default function MediaRatioSlider({ value, onChange, disabled = false }: Props) {
  // 하나를 바꾸면 나머지 둘을 비례로 조정해서 합계 100 유지
  function handleChange(key: keyof MediaRatio, next: number) {
    const others = KEYS.filter((k) => k.key !== key);
    const remaining = 100 - next;
    const currentOtherSum = others.reduce((s, k) => s + value[k.key], 0);

    const updated = { ...value, [key]: next };
    if (currentOtherSum === 0) {
      const each = Math.floor(remaining / 2);
      updated[others[0].key] = each;
      updated[others[1].key] = remaining - each;
    } else {
      for (const k of others) {
        updated[k.key] = Math.round((value[k.key] / currentOtherSum) * remaining);
      }
      // 반올림 오차 보정
      const diff = 100 - Object.values(updated).reduce((s, v) => s + v, 0);
      updated[others[0].key] += diff;
    }
    onChange(updated);
  }

  const total = value.ai_image + value.stock_photo + value.stock_video;

  return (
    <div className={`flex flex-col gap-3 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700">미디어 비율 설정</label>
        {total !== 100 && (
          <span className="text-xs text-red-500">합계: {total}% (100%여야 합니다)</span>
        )}
      </div>

      {/* 비율 바 */}
      <div className="flex h-3 rounded-full overflow-hidden w-full">
        <div className="bg-violet-500 transition-all" style={{ width: `${value.ai_image}%` }} />
        <div className="bg-sky-500 transition-all"    style={{ width: `${value.stock_photo}%` }} />
        <div className="bg-teal-500 transition-all"   style={{ width: `${value.stock_video}%` }} />
      </div>

      {/* 슬라이더 */}
      {KEYS.map(({ key, label, color }) => (
        <div key={key} className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
          <span className="text-xs text-gray-600 w-20 shrink-0">{label}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={value[key]}
            onChange={(e) => handleChange(key, Number(e.target.value))}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-xs font-medium text-gray-700 w-8 text-right">{value[key]}%</span>
        </div>
      ))}
    </div>
  );
}
