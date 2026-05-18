"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Bookmark } from "lucide-react";
import { Scene } from "../types";

interface Props {
  scenes: Scene[];
  projectId?: string | null;
}

export default function SceneJumpNav({ scenes, projectId = null }: Props) {
  const [bookmarkedSceneId, setBookmarkedSceneId] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) { setBookmarkedSceneId(null); return; }
    const raw = localStorage.getItem(`yt-bookmark-${projectId}`);
    setBookmarkedSceneId(raw ? parseInt(raw, 10) : null);

    function onBookmarkChange(e: Event) {
      const id = (e as CustomEvent<number | null>).detail;
      setBookmarkedSceneId(id);
    }
    window.addEventListener("yt-bookmark-change", onBookmarkChange);
    return () => window.removeEventListener("yt-bookmark-change", onBookmarkChange);
  }, [projectId]);
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
      {bookmarkedSceneId !== null && (
        <button
          onClick={() => jumpTo(bookmarkedSceneId)}
          title={`북마크: 장면 ${bookmarkedSceneId}`}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-50 border border-amber-300 shadow-sm text-amber-500 hover:bg-amber-100 transition-colors mb-1"
        >
          <Bookmark size={14} fill="currentColor" />
        </button>
      )}
      <div className="flex flex-col gap-1 overflow-y-auto py-1 px-1 bg-white/80 backdrop-blur rounded-full border border-gray-100 shadow-sm">
        {scenes.map(s => (
          <button
            key={s.scene_id}
            onClick={() => jumpTo(s.scene_id)}
            title={s.topic_summary}
            className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
              bookmarkedSceneId === s.scene_id
                ? "bg-amber-100 text-amber-700 ring-1 ring-amber-400"
                : "text-gray-500 hover:bg-indigo-100 hover:text-indigo-700"
            }`}
          >
            {s.scene_id}
          </button>
        ))}
      </div>
    </nav>
  );
}
