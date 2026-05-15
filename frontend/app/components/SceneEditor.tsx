"use client";

import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { Scene } from "../types";
import { renumber, estimateDuration, DEFAULT_MEDIA } from "../utils/sceneOps";
import SceneCard from "./SceneCard";
import SplitSceneModal from "./SplitSceneModal";
import AddSceneModal from "./AddSceneModal";
import { Film, Clock, AlertTriangle, CheckCircle, Plus } from "lucide-react";

interface Props {
  scenes: Scene[];
  onChange: (scenes: Scene[]) => void;
  warnings: string[];
  aiProvider: string;
  modelUsed: string;
}

export default function SceneEditor({ scenes, onChange, warnings, aiProvider, modelUsed }: Props) {
  const [splitTarget, setSplitTarget] = useState<number | null>(null);   // scene index
  const [addAfterIndex, setAddAfterIndex] = useState<number | null>(null); // -1 = 맨 앞

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalDuration = scenes.reduce((s, sc) => s + sc.estimated_duration, 0);
  const totalMin = Math.floor(totalDuration / 60);
  const totalSec = Math.round(totalDuration % 60);

  // ─── 드래그앤드롭 ────────────────────────────────────────────────────────
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = scenes.findIndex(s => s.scene_id === active.id);
    const newIdx = scenes.findIndex(s => s.scene_id === over.id);
    onChange(renumber(arrayMove(scenes, oldIdx, newIdx)));
  }

  // ─── 텍스트 편집 ─────────────────────────────────────────────────────────
  function handleUpdate(index: number, text: string, topicSummary: string) {
    onChange(scenes.map((s, i) =>
      i === index ? { ...s, text, topic_summary: topicSummary, estimated_duration: estimateDuration(text) } : s
    ));
  }

  // ─── 나누기 ──────────────────────────────────────────────────────────────
  function handleSplit(index: number, text1: string, text2: string) {
    const base = scenes[index];
    const s1: Scene = { ...base, text: text1, estimated_duration: estimateDuration(text1) };
    const s2: Scene = { ...base, text: text2, topic_summary: "새 장면", estimated_duration: estimateDuration(text2) };
    onChange(renumber([...scenes.slice(0, index), s1, s2, ...scenes.slice(index + 1)]));
    setSplitTarget(null);
  }

  // ─── 합치기 ──────────────────────────────────────────────────────────────
  function handleMerge(index: number, dir: "up" | "down") {
    const other = dir === "up" ? index - 1 : index + 1;
    if (other < 0 || other >= scenes.length) return;
    const [first, second] = dir === "up" ? [other, index] : [index, other];
    const merged: Scene = {
      ...scenes[first],
      text: scenes[first].text + " " + scenes[second].text,
      estimated_duration: estimateDuration(scenes[first].text + " " + scenes[second].text),
    };
    onChange(renumber([...scenes.slice(0, first), merged, ...scenes.slice(second + 1)]));
  }

  // ─── 삭제 ────────────────────────────────────────────────────────────────
  function handleDelete(index: number) {
    if (!confirm(`장면 ${scenes[index].scene_id}을 삭제하시겠습니까?`)) return;
    onChange(renumber(scenes.filter((_, i) => i !== index)));
  }

  // ─── 추가 ────────────────────────────────────────────────────────────────
  function handleAdd(text: string) {
    if (addAfterIndex === null) return;
    const insertAt = addAfterIndex + 1; // -1 → 0(맨앞), N → N+1
    const newScene: Scene = {
      scene_id: 0,
      text,
      topic_summary: "새 장면",
      estimated_duration: estimateDuration(text),
      media: { ...DEFAULT_MEDIA },
    };
    onChange(renumber([...scenes.slice(0, insertAt), newScene, ...scenes.slice(insertAt)]));
    setAddAfterIndex(null);
  }

  return (
    <>
      {/* 요약 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-4">
        <div className="flex items-center gap-2 text-indigo-700">
          <Film size={16} />
          <span className="font-semibold text-sm">{scenes.length}개 장면</span>
        </div>
        <div className="flex items-center gap-2 text-indigo-600 text-sm">
          <Clock size={14} />
          <span>총 {totalMin > 0 ? `${totalMin}분 ` : ""}{totalSec}초</span>
        </div>
        <span className="text-xs text-indigo-400">
          {aiProvider === "claude" ? "Claude" : "Gemini"} · {modelUsed}
        </span>
      </div>

      {/* 원본 텍스트 검증 */}
      {warnings.length === 0 ? (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-sm mb-4">
          <CheckCircle size={15} /> 원본 텍스트가 100% 보존되었습니다.
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1.5 mb-4">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle size={15} /> 원본 텍스트 커버리지 경고
          </div>
          {warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 pl-5">{w}</p>)}
        </div>
      )}

      {/* 맨 앞에 추가 버튼 */}
      <button
        onClick={() => setAddAfterIndex(-1)}
        className="w-full flex items-center justify-center gap-1 py-1 mb-1 text-gray-300 hover:text-indigo-500 transition-colors group"
      >
        <div className="h-px flex-1 bg-gray-100 group-hover:bg-indigo-200 transition-colors" />
        <span className="flex items-center gap-0.5 text-xs px-2 shrink-0"><Plus size={11} /> 맨 앞에 추가</span>
        <div className="h-px flex-1 bg-gray-100 group-hover:bg-indigo-200 transition-colors" />
      </button>

      {/* 드래그앤드롭 리스트 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={scenes.map(s => s.scene_id)} strategy={verticalListSortingStrategy}>
          {scenes.map((scene, index) => (
            <SceneCard
              key={scene.scene_id}
              scene={scene}
              index={index}
              total={scenes.length}
              onUpdate={(text, topic) => handleUpdate(index, text, topic)}
              onSplit={() => setSplitTarget(index)}
              onMerge={(dir) => handleMerge(index, dir)}
              onDelete={() => handleDelete(index)}
              onAddAfter={() => setAddAfterIndex(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* 나누기 모달 */}
      {splitTarget !== null && (
        <SplitSceneModal
          scene={scenes[splitTarget]}
          onConfirm={(t1, t2) => handleSplit(splitTarget, t1, t2)}
          onClose={() => setSplitTarget(null)}
        />
      )}

      {/* 추가 모달 */}
      {addAfterIndex !== null && (
        <AddSceneModal
          afterSceneId={addAfterIndex === -1 ? null : scenes[addAfterIndex]?.scene_id ?? null}
          totalScenes={scenes.length}
          onConfirm={handleAdd}
          onClose={() => setAddAfterIndex(null)}
        />
      )}
    </>
  );
}
