"use client";

import { useState } from "react";
import { Scene } from "../types";
import { splitIntoSentences, estimateDuration } from "../utils/sceneOps";
import { Scissors, X } from "lucide-react";

interface Props {
  scene: Scene;
  onConfirm: (text1: string, text2: string) => void;
  onClose: () => void;
}

export default function SplitSceneModal({ scene, onConfirm, onClose }: Props) {
  const sentences = splitIntoSentences(scene.text);
  const canSplit = sentences.length >= 2;
  const [splitAfter, setSplitAfter] = useState(Math.floor(sentences.length / 2) - (sentences.length % 2 === 0 ? 0 : 0));

  const text1 = sentences.slice(0, splitAfter + 1).join(' ');
  const text2 = sentences.slice(splitAfter + 1).join(' ');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <Scissors size={16} />
            장면 {scene.scene_id} 나누기
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {!canSplit ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
              이 장면은 문장이 1개뿐이라 자동 분할할 수 없습니다.<br />
              텍스트를 직접 편집하여 두 장면으로 나눠주세요.
            </p>
          ) : (
            <>
              {/* 문장 선택 */}
              <div>
                <p className="text-xs text-gray-500 mb-3">분할 위치를 클릭하세요</p>
                <div className="flex flex-wrap gap-1 items-center">
                  {sentences.map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className={`text-sm px-2 py-1 rounded-lg border transition-colors ${
                        i <= splitAfter
                          ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                          : "bg-gray-50 border-gray-200 text-gray-600"
                      }`}>
                        {s}
                      </span>
                      {i < sentences.length - 1 && (
                        <button
                          onClick={() => setSplitAfter(i)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
                            splitAfter === i
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-200 text-gray-500 hover:bg-indigo-200"
                          }`}
                          title={`여기서 나누기`}
                        >
                          ✂
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 미리보기 */}
              <div className="grid grid-cols-2 gap-3">
                {[{ label: "앞 장면", text: text1 }, { label: "뒷 장면", text: text2 }].map(({ label, text }) => (
                  <div key={label} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">{label}</span>
                      <span className="text-xs text-gray-400">{estimateDuration(text)}초</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded p-2">
                      {text || <span className="text-gray-300">(비어있음)</span>}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              취소
            </button>
            {canSplit && text2 && (
              <button
                onClick={() => onConfirm(text1, text2)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
              >
                나누기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
