"use client";

import { useState, useEffect } from "react";
import { Scene } from "../types";
import { Download, Clipboard, Plus, Trash2, Check } from "lucide-react";

const PRESET_STORAGE_KEY = "yt-image-style-presets";
const BUILTIN_PRESETS = [
  { name: "사실적 (Photorealistic)", prompt: "photorealistic, 8K, ultra detailed, professional photography, natural lighting" },
  { name: "애니메이션", prompt: "anime style, vibrant colors, detailed illustration, Studio Ghibli inspired" },
  { name: "수채화", prompt: "watercolor painting style, soft pastel colors, artistic, hand-painted" },
  { name: "시네마틱", prompt: "cinematic, dramatic lighting, wide angle, film grain, anamorphic lens" },
  { name: "미니멀", prompt: "minimalist style, clean composition, flat design, simple background" },
];

interface UserPreset { name: string; prompt: string; }

interface Props {
  style: string;
  onStyleChange: (s: string) => void;
  scenes: Scene[];
}

export default function ImageStylePanel({ style, onStyleChange, scenes }: Props) {
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      if (raw) setUserPresets(JSON.parse(raw));
    } catch {}
  }, []);

  function saveUserPresets(list: UserPreset[]) {
    setUserPresets(list);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(list));
  }

  function saveCurrentAsPreset() {
    const name = newPresetName.trim();
    if (!name || !style.trim()) return;
    const updated = [...userPresets, { name, prompt: style.trim() }];
    saveUserPresets(updated);
    setNewPresetName("");
    setShowSaveForm(false);
  }

  function deleteUserPreset(idx: number) {
    saveUserPresets(userPresets.filter((_, i) => i !== idx));
  }

  // ai_image 장면만 추출하고 스타일 결합
  function buildPrompts(): string {
    const aiScenes = scenes.filter(s => s.media.media_type === "ai_image" && s.media.ai_image_prompt);
    if (aiScenes.length === 0) return "";
    return aiScenes
      .map(s => {
        const base = s.media.ai_image_prompt!.trim();
        return style.trim() ? `${base}, ${style.trim()}` : base;
      })
      .join("\n");
  }

  function copyToClipboard() {
    const text = buildPrompts();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadTxt() {
    const text = buildPrompts();
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "image_prompts.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const aiSceneCount = scenes.filter(s => s.media.media_type === "ai_image").length;

  return (
    <div className="flex flex-col gap-4">
      {/* 프리셋 선택 */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">기본 프리셋</label>
        <div className="flex flex-wrap gap-1.5">
          {BUILTIN_PRESETS.map(p => (
            <button
              key={p.name}
              onClick={() => onStyleChange(p.prompt)}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${
                style === p.prompt
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 사용자 프리셋 */}
      {userPresets.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">내 프리셋</label>
          <div className="flex flex-wrap gap-1.5">
            {userPresets.map((p, i) => (
              <div key={i} className={`flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-xs border transition-all ${
                style === p.prompt
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200"
              }`}>
                <button onClick={() => onStyleChange(p.prompt)}>{p.name}</button>
                <button
                  onClick={() => deleteUserPreset(i)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 스타일 직접 입력 */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">스타일 프롬프트 (전체 장면 공통 적용)</label>
        <textarea
          value={style}
          onChange={e => onStyleChange(e.target.value)}
          rows={2}
          placeholder="예: photorealistic, 8K, cinematic lighting, ..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      {/* 프리셋으로 저장 */}
      {showSaveForm ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newPresetName}
            onChange={e => setNewPresetName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveCurrentAsPreset(); if (e.key === "Escape") setShowSaveForm(false); }}
            placeholder="프리셋 이름"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button onClick={saveCurrentAsPreset} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">저장</button>
          <button onClick={() => setShowSaveForm(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500">취소</button>
        </div>
      ) : (
        style.trim() && (
          <button
            onClick={() => setShowSaveForm(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 w-fit"
          >
            <Plus size={12} /> 현재 스타일을 프리셋으로 저장
          </button>
        )
      )}

      {/* 프롬프트 추출 */}
      <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            AI 이미지 장면 {aiSceneCount}개
            {aiSceneCount === 0 && " — 추출할 프롬프트가 없습니다"}
          </span>
          <div className="flex-1" />
          <button
            onClick={copyToClipboard}
            disabled={aiSceneCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            {copied ? <><Check size={12} className="text-emerald-500" /> 복사됨</> : <><Clipboard size={12} /> 클립보드 복사</>}
          </button>
          <button
            onClick={downloadTxt}
            disabled={aiSceneCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download size={12} /> TXT 저장
          </button>
        </div>
        {aiSceneCount > 0 && (
          <p className="text-xs text-gray-400">
            형식: 장면 프롬프트{style.trim() ? " + 스타일" : ""} · 장면별 줄바꿈 구분
          </p>
        )}
      </div>
    </div>
  );
}
