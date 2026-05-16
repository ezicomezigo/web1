"use client";

import { ArrowUp } from "lucide-react";
import { Scene } from "../types";

interface Props {
  scenes: Scene[];
}

export default function SceneJumpNav({ scenes }: Props) {
  if (scenes.length === 0) return null;

  function jumpTo(id: number) {
    const el = document.getElementById(`scene-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function jumpTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <nav className="fixed right-4 top-1/2 -translate-y-1/2 z-20 hidden lg:flex flex-col items-center gap-1 max-h-[80vh]">
      <button
        onClick={jumpTop}
        title="맨 위로"
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors mb-1"
      >
        <ArrowUp size={14} />
      </button>
      <div className="flex flex-col gap-1 overflow-y-auto py-1 px-1 bg-white/80 backdrop-blur rounded-full border border-gray-100 shadow-sm">
        {scenes.map(s => (
          <button
            key={s.scene_id}
            onClick={() => jumpTo(s.scene_id)}
            title={s.topic_summary}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-semibold text-gray-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
          >
            {s.scene_id}
          </button>
        ))}
      </div>
    </nav>
  );
}
