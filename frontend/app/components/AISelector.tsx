"use client";

import { AIProvider, GeminiModel, GEMINI_MODELS } from "../types";

interface Props {
  provider: AIProvider;
  geminiModel: GeminiModel;
  onProviderChange: (p: AIProvider) => void;
  onGeminiModelChange: (m: GeminiModel) => void;
}

export default function AISelector({
  provider,
  geminiModel,
  onProviderChange,
  onGeminiModelChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-semibold text-gray-700">AI 모델 선택</label>

      <div className="flex gap-3">
        {(["claude", "gemini"] as AIProvider[]).map((p) => (
          <button
            key={p}
            onClick={() => onProviderChange(p)}
            className={`px-5 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
              provider === p
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            }`}
          >
            {p === "claude" ? "Claude" : "Gemini"}
          </button>
        ))}
      </div>

      {provider === "gemini" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500">Gemini 모델</label>
          <select
            value={geminiModel}
            onChange={(e) => onGeminiModelChange(e.target.value as GeminiModel)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m === "gemini-2.5-flash" ? `${m} (권장)` : m}
              </option>
            ))}
          </select>
          {geminiModel !== "gemini-2.5-flash" && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
              preview 모델은 출력 한도가 낮아 긴 대본에서 오류가 발생할 수 있습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
