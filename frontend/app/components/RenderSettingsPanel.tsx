"use client";

import { RenderSettings } from "../types";

interface Props {
  value: RenderSettings;
  onChange: (next: RenderSettings) => void;
}

const FONT_PRESETS = [
  { label: "기본 (플랫폼 한글)", value: null },
  { label: "주아체", value: "Jua" },
  { label: "나눔고딕", value: "NanumGothic" },
  { label: "나눔바른고딕", value: "NanumBarunGothic" },
  { label: "Malgun Gothic (Windows)", value: "Malgun Gothic" },
  { label: "Apple SD Gothic Neo (macOS)", value: "Apple SD Gothic Neo" },
  { label: "Noto Sans CJK KR (Linux)", value: "Noto Sans CJK KR" },
];

export default function RenderSettingsPanel({ value, onChange }: Props) {
  const color = value.subtitle_color ?? "#FFFFFF";
  const bold = value.subtitle_bold ?? false;
  const currentPreset = FONT_PRESETS.find(p => p.value === value.subtitle_font_name);
  const isCustom = !currentPreset;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* 폰트 크기 */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">자막 폰트 크기 (px)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={120}
              step={1}
              value={value.subtitle_font_size}
              onChange={e => onChange({ ...value, subtitle_font_size: Number(e.target.value) || 22 })}
              className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <span className="text-xs text-gray-400">px</span>
          </div>
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

        {/* 폰트 선택 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">자막 폰트</span>
          <select
            value={isCustom ? "__custom__" : (value.subtitle_font_name ?? "__default__")}
            onChange={e => {
              const v = e.target.value;
              if (v === "__default__") onChange({ ...value, subtitle_font_name: null });
              else if (v === "__custom__") onChange({ ...value, subtitle_font_name: value.subtitle_font_name ?? "" });
              else onChange({ ...value, subtitle_font_name: v });
            }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {FONT_PRESETS.map(p => (
              <option key={p.value ?? "__default__"} value={p.value ?? "__default__"}>
                {p.label}
              </option>
            ))}
            <option value="__custom__">직접 입력...</option>
          </select>
          {isCustom && (
            <input
              type="text"
              placeholder="폰트명 직접 입력"
              value={value.subtitle_font_name ?? ""}
              onChange={e => onChange({ ...value, subtitle_font_name: e.target.value.trim() || null })}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1"
              autoFocus
            />
          )}
        </div>

        {/* 외곽선 */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">외곽선 두께</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={6}
              step={1}
              value={value.subtitle_outline}
              onChange={e => onChange({ ...value, subtitle_outline: Math.max(0, Number(e.target.value) || 0) })}
              className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </label>

      </div>

      {/* 볼드 + 폰트 색상 */}
      <div className="flex items-center gap-5">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={bold}
            onChange={e => onChange({ ...value, subtitle_bold: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-xs font-medium text-gray-600">볼드체</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600 shrink-0">폰트 색상</span>
          <input
            type="color"
            value={color}
            onChange={e => onChange({ ...value, subtitle_color: e.target.value })}
            className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
          />
          <span className="text-xs text-gray-400 font-mono">{color.toUpperCase()}</span>
          {color.toUpperCase() !== "#FFFFFF" && (
            <button
              onClick={() => onChange({ ...value, subtitle_color: "#FFFFFF" })}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              초기화
            </button>
          )}
        </label>
      </div>

      {/* 한 줄 글자수 강제 지정 */}
      <label className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-600 shrink-0">한 줄 최대 글자수</span>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          placeholder="자동"
          value={value.subtitle_max_chars ?? ""}
          onChange={e => {
            const n = Number(e.target.value);
            onChange({ ...value, subtitle_max_chars: e.target.value === "" || n <= 0 ? null : n });
          }}
          className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <span className="text-[11px] text-gray-400">
          비워두면 폰트 크기에 따라 자동 계산. 화면 밖으로 글자가 넘치면 이 값을 줄이세요.
        </span>
      </label>

      <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
        폰트 크기를 키우면 자동으로 한 줄에 맞춰 자막이 분할됩니다.
        각 조각은 원래 큐의 시간 구간 안에서 글자수에 비례해 순차 표시됩니다.
        <strong className="text-gray-600"> 주아체 사용 시 PC에 해당 폰트가 설치되어 있어야 합니다.</strong>
      </p>
    </div>
  );
}
