"use client";

import {
  TTSSettings, TTSProvider,
  GEMINI_TTS_MODELS, GEMINI_TTS_VOICES,
  MINIMAX_TTS_MODELS, MINIMAX_PRESET_VOICES,
} from "../types";
import { Mic2 } from "lucide-react";

interface Props {
  value: TTSSettings;
  onChange: (s: TTSSettings) => void;
  disabled?: boolean;
}

const PROVIDER_LABELS: Record<TTSProvider, string> = {
  gemini: "Gemini TTS",
  minimax: "MiniMax TTS",
};

export default function TTSSettings({ value, onChange, disabled = false }: Props) {
  function set(patch: Partial<TTSSettings>) {
    onChange({ ...value, ...patch });
  }

  function handleProviderChange(p: TTSProvider) {
    if (p === "gemini") {
      set({ provider: p, model: GEMINI_TTS_MODELS[0], voice: "Kore", speed: 1.0 });
    } else {
      set({ provider: p, model: MINIMAX_TTS_MODELS[0], voice: MINIMAX_PRESET_VOICES[0].id, speed: 1.0 });
    }
  }

  const isGemini = value.provider === "gemini";

  // 현재 저장된 값이 프리셋 목록에 없으면 커스텀 입력 상태로 판단
  const isCustomModel = !isGemini && !MINIMAX_TTS_MODELS.includes(value.model as typeof MINIMAX_TTS_MODELS[number]);
  const isCustomVoice = !isGemini && !MINIMAX_PRESET_VOICES.some(v => v.id === value.voice);

  return (
    <div className={`flex flex-col gap-4 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-2">
        <Mic2 size={15} className="text-gray-500" />
        <label className="text-sm font-semibold text-gray-700">TTS 설정</label>
      </div>

      {/* 제공자 */}
      <div className="flex gap-2">
        {(["gemini", "minimax"] as TTSProvider[]).map(p => (
          <button
            key={p}
            onClick={() => handleProviderChange(p)}
            className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
              value.provider === p
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            }`}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 모델 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">모델</label>
          <select
            value={isCustomModel ? "__custom__" : value.model}
            onChange={e => {
              if (e.target.value === "__custom__") {
                set({ model: "" });
              } else {
                set({ model: e.target.value });
              }
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {(isGemini ? GEMINI_TTS_MODELS : MINIMAX_TTS_MODELS).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
            {!isGemini && <option value="__custom__">직접 입력...</option>}
          </select>
          {isCustomModel && (
            <input
              autoFocus
              value={value.model}
              onChange={e => set({ model: e.target.value })}
              placeholder="모델 ID 직접 입력 (예: speech-02-hd)"
              className="border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          )}
        </div>

        {/* 속도 (MiniMax만) */}
        {!isGemini && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">속도 {value.speed.toFixed(1)}x</label>
            <input
              type="range" min={0.5} max={2.0} step={0.1}
              value={value.speed}
              onChange={e => set({ speed: Number(e.target.value) })}
              className="mt-1 accent-indigo-500"
            />
          </div>
        )}
        {isGemini && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">속도</label>
            <span className="text-xs text-gray-400 mt-2">Gemini TTS는 속도 조절 미지원</span>
          </div>
        )}
      </div>

      {/* 목소리 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">목소리</label>
        {isGemini ? (
          <select
            value={value.voice}
            onChange={e => set({ voice: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {GEMINI_TTS_VOICES.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ) : (
          <div className="flex flex-col gap-2">
            <select
              value={isCustomVoice ? "__custom__" : value.voice}
              onChange={e => {
                if (e.target.value === "__custom__") {
                  set({ voice: "" });
                } else {
                  set({ voice: e.target.value });
                }
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {MINIMAX_PRESET_VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.label} ({v.id})</option>
              ))}
              <option value="__custom__">직접 입력...</option>
            </select>
            {isCustomVoice && (
              <input
                value={value.voice}
                onChange={e => set({ voice: e.target.value })}
                placeholder="voice_id 직접 입력 (예: Calm_Woman)"
                className="border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
