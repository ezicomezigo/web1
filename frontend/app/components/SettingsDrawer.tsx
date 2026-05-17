"use client";

import { useState } from "react";
import { Settings, X, ChevronDown } from "lucide-react";
import { AIProvider, GeminiModel, GEMINI_MODELS, TTSSettings, GEMINI_TTS_MODELS, RenderSettings, MediaRatio } from "../types";
import AISelector from "./AISelector";
import MediaRatioSlider from "./MediaRatioSlider";
import TTSSettingsPanel from "./TTSSettings";
import ImageStylePanel from "./ImageStylePanel";
import RenderSettingsPanel from "./RenderSettingsPanel";
import { Scene } from "../types";

interface Props {
  scenes: Scene[];
  disabled?: boolean;
  provider: AIProvider;
  onProviderChange: (v: AIProvider) => void;
  geminiModel: GeminiModel;
  onGeminiModelChange: (v: GeminiModel) => void;
  mediaRatio: MediaRatio;
  onMediaRatioChange: (v: MediaRatio) => void;
  ttsSettings: TTSSettings;
  onTtsChange: (v: TTSSettings) => void;
  imageStyle: string;
  onImageStyleChange: (v: string) => void;
  renderSettings: RenderSettings;
  onRenderSettingsChange: (v: RenderSettings) => void;
}

function Section({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="text-sm font-semibold text-gray-700 shrink-0">{title}</span>
        {!open && summary && (
          <span className="text-xs text-gray-400 truncate flex-1">— {summary}</span>
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function SettingsDrawer({
  scenes, disabled,
  provider, onProviderChange,
  geminiModel, onGeminiModelChange,
  mediaRatio, onMediaRatioChange,
  ttsSettings, onTtsChange,
  imageStyle, onImageStyleChange,
  renderSettings, onRenderSettingsChange,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 고정 설정 버튼 */}
      <button
        onClick={() => setOpen(true)}
        title="설정"
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <Settings size={20} />
      </button>

      {/* 드로어 오버레이 */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* 배경 클릭으로 닫기 */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />

          {/* 드로어 패널 */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-indigo-600" />
                <span className="font-semibold text-gray-800">설정</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 설정 목록 (스크롤 가능) */}
            <div className="flex-1 overflow-y-auto">
              <Section
                title="AI 모델 설정"
                summary={provider === "claude" ? "Claude" : `Gemini · ${geminiModel}`}
              >
                <AISelector
                  provider={provider}
                  geminiModel={geminiModel}
                  disabled={!!disabled}
                  onProviderChange={onProviderChange}
                  onGeminiModelChange={onGeminiModelChange}
                />
              </Section>

              <Section
                title="미디어 비율 설정"
                summary={`AI ${mediaRatio.ai_image}% · 사진 ${mediaRatio.stock_photo}% · 영상 ${mediaRatio.stock_video}%`}
              >
                <MediaRatioSlider value={mediaRatio} onChange={onMediaRatioChange} disabled={!!disabled} />
              </Section>

              <Section
                title="TTS 설정"
                summary={`${ttsSettings.provider === "gemini" ? "Gemini" : "MiniMax"} · ${ttsSettings.model} · ${ttsSettings.voice}`}
              >
                <TTSSettingsPanel value={ttsSettings} onChange={onTtsChange} disabled={!!disabled} />
              </Section>

              <Section
                title="AI 이미지 스타일"
                summary={imageStyle.trim() ? imageStyle.slice(0, 40) + (imageStyle.length > 40 ? "..." : "") : "미설정"}
              >
                <ImageStylePanel style={imageStyle} onStyleChange={onImageStyleChange} scenes={scenes} />
              </Section>

              <Section
                title="렌더 · 자막 설정"
                summary={`자막 ${renderSettings.subtitle_font_size}px · ${renderSettings.subtitle_font_name ?? "기본 폰트"}`}
              >
                <RenderSettingsPanel value={renderSettings} onChange={onRenderSettingsChange} />
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
