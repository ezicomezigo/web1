"use client";

import { RenderSettings } from "../types";

interface Props {
  value: RenderSettings;
  onChange: (next: RenderSettings) => void;
}

export default function RenderSettingsPanel({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">자막 폰트 크기 (px)</span>
          <input
            type="number"
            min={10}
            max={120}
            step={1}
            value={value.subtitle_font_size}
            onChange={e => onChange({ ...value, subtitle_font_size: Number(e.target.value) || 22 })}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="range"
            min={14}
            max={80}
            step={1}
            value={value.subtitle_font_size}
            onChange={e => onChange({ ...value, subtitle_font_size: Number(e.target.value) })}
            className="accent-indigo-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">자막 폰트 (선택)</span>
          <input
            type="text"
            placeholder="기본: 플랫폼 한글 폰트"
            value={value.subtitle_font_name ?? ""}
            onChange={e => onChange({
              ...value,
              subtitle_font_name: e.target.value.trim() ? e.target.value : null,
            })}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <span className="text-[10px] text-gray-400 leading-tight">
            예: Malgun Gothic, Apple SD Gothic Neo, Noto Sans CJK KR
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">외곽선 두께</span>
          <input
            type="number"
            min={0}
            max={6}
            step={1}
            value={value.subtitle_outline}
            onChange={e => onChange({ ...value, subtitle_outline: Math.max(0, Number(e.target.value) || 0) })}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
        폰트 크기를 키우면 자동으로 한 줄에 맞춰 자막이 분할됩니다.
        분할된 조각들은 원래 큐의 시간 구간 안에서 글자수에 비례해 순차적으로 표시됩니다.
      </p>
    </div>
  );
}
