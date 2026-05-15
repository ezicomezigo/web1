"use client";

import { useState } from "react";
import { MediaPlan } from "../types";
import { estimateDuration, DEFAULT_MEDIA } from "../utils/sceneOps";
import MediaPlanEditor from "./MediaPlanEditor";
import { Plus, X } from "lucide-react";

interface Props {
  afterSceneId: number | null;
  totalScenes: number;
  onConfirm: (text: string, media: MediaPlan) => void;
  onClose: () => void;
}

export default function AddSceneModal({ afterSceneId, totalScenes, onConfirm, onClose }: Props) {
  const [text, setText] = useState("");
  const [media, setMedia] = useState<MediaPlan>({ ...DEFAULT_MEDIA });

  const positionLabel = afterSceneId === null
    ? "맨 앞"
    : afterSceneId >= totalScenes
      ? "맨 뒤"
      : `장면 ${afterSceneId}과 ${afterSceneId + 1} 사이`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <Plus size={16} />
            장면 추가 — <span className="text-indigo-600">{positionLabel}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">대본 텍스트</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="이 장면의 대본을 입력하세요..."
              rows={4}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {text && (
              <p className="text-xs text-gray-400 mt-1">예상 낭독 시간: {estimateDuration(text)}초</p>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <MediaPlanEditor value={media} onChange={setMedia} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              취소
            </button>
            <button
              onClick={() => text.trim() && onConfirm(text.trim(), media)}
              disabled={!text.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
