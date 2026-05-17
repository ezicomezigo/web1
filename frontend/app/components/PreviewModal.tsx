"use client";

import { useEffect, useRef, useState } from "react";
import { Scene } from "../types";
import { X, SkipBack, SkipForward, Play, Pause } from "lucide-react";

const API_BASE = "http://localhost:8000";

interface Props {
  projectId: string;
  scenes: Scene[];
  onClose: () => void;
}

export default function PreviewModal({ projectId, scenes, onClose }: Props) {
  const videoScenes = scenes.filter(s => s.assets?.video);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = videoScenes[currentIdx];
  const videoUrl = current
    ? `${API_BASE}/api/projects/${projectId}/${current.assets!.video}`
    : null;

  // 새 장면 로드 시 자동 재생
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    if (isPlaying) v.play().catch(() => {});
  }, [currentIdx, isPlaying]);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setCurrentIdx(i => Math.min(i + 1, videoScenes.length - 1));
      else if (e.key === "ArrowLeft") setCurrentIdx(i => Math.max(i - 1, 0));
      else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, videoScenes.length]);

  function handleEnded() {
    if (currentIdx < videoScenes.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      setIsPlaying(false);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  }

  if (videoScenes.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md text-center">
          <p className="text-gray-700 mb-4">미리볼 렌더링된 장면이 없습니다.</p>
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col p-4" onClick={onClose}>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3 text-white" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold flex-1">
          전체 미리보기 — 장면 {current?.scene_id} ({currentIdx + 1}/{videoScenes.length})
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10"
          title="닫기 (ESC)"
        >
          <X size={20} />
        </button>
      </div>

      {/* 비디오 */}
      <div className="flex-1 flex items-center justify-center min-h-0" onClick={e => e.stopPropagation()}>
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          controls
          autoPlay
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="max-w-full max-h-full rounded-lg bg-black"
        />
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center justify-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setCurrentIdx(i => Math.max(i - 1, 0))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-30"
          title="이전 장면 (←)"
        >
          <SkipBack size={14} /> 이전
        </button>
        <button
          onClick={togglePlay}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-gray-900 text-sm font-medium hover:bg-gray-100"
        >
          {isPlaying ? <><Pause size={14} /> 일시정지</> : <><Play size={14} /> 재생</>}
        </button>
        <button
          onClick={() => setCurrentIdx(i => Math.min(i + 1, videoScenes.length - 1))}
          disabled={currentIdx >= videoScenes.length - 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-30"
          title="다음 장면 (→)"
        >
          다음 <SkipForward size={14} />
        </button>
      </div>

      {/* 진행률 + 장면 점프 */}
      <div className="mt-3 max-w-4xl w-full mx-auto" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap gap-1 justify-center">
          {videoScenes.map((s, i) => (
            <button
              key={s.scene_id}
              onClick={() => setCurrentIdx(i)}
              className={`min-w-[28px] px-2 py-1 rounded text-xs font-mono transition-colors ${
                i === currentIdx
                  ? "bg-indigo-500 text-white"
                  : i < currentIdx
                  ? "bg-white/30 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
              title={`장면 ${s.scene_id}`}
            >
              {s.scene_id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
