"use client";

import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { Scene, MediaPlan, TTSSettings, SubtitleCue } from "../types";
import { renumber, estimateDuration, DEFAULT_MEDIA } from "../utils/sceneOps";
import SceneCard from "./SceneCard";
import SplitSceneModal from "./SplitSceneModal";
import AddSceneModal from "./AddSceneModal";
import { Film, Clock, AlertTriangle, CheckCircle, Plus, Mic2, Loader2, Download } from "lucide-react";

const API_BASE = "http://localhost:8000";

interface Props {
  scenes: Scene[];
  onChange: (scenes: Scene[] | ((prev: Scene[]) => Scene[])) => void;
  warnings: string[];
  aiProvider: string;
  modelUsed: string;
  disabled?: boolean;
  projectId: string;
  ttsSettings: TTSSettings;
  imageStyle: string;
}

export default function SceneEditor({
  scenes, onChange, warnings, aiProvider, modelUsed, disabled = false, projectId, ttsSettings, imageStyle,
}: Props) {
  const [splitTarget, setSplitTarget] = useState<number | null>(null);
  const [addAfterIndex, setAddAfterIndex] = useState<number | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMode, setBatchMode] = useState<"all" | "missing" | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; sceneId: number } | null>(null);
  const [batchErrors, setBatchErrors] = useState<{ sceneId: number; error: string }[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalDuration = scenes.reduce((s, sc) => s + sc.estimated_duration, 0);
  const totalMin = Math.floor(totalDuration / 60);
  const totalSec = Math.round(totalDuration % 60);

  // ─── 오디오 업데이트 ─────────────────────────────────────────────────────
  function handleAudioUpdate(sceneId: number, audioPath: string | null, duration: number) {
    onChange(prev => prev.map(s => s.scene_id === sceneId
      ? { ...s, assets: { ...(s.assets ?? { visual: null }), audio: audioPath }, estimated_duration: duration }
      : s
    ));
  }

  // ─── 비주얼 업데이트 ─────────────────────────────────────────────────────
  function handleVisualUpdate(sceneId: number, visualPath: string | null) {
    onChange(prev => prev.map(s => s.scene_id === sceneId
      ? { ...s, assets: { ...(s.assets ?? { audio: null }), visual: visualPath } }
      : s
    ));
  }

  // ─── 자막 업데이트 ──────────────────────────────────────────────────────
  function handleSubtitleUpdate(sceneId: number, cues: SubtitleCue[] | null) {
    onChange(prev => prev.map(s => s.scene_id === sceneId
      ? { ...s, assets: { ...(s.assets ?? { audio: null, visual: null }), subtitle: cues } }
      : s
    ));
  }

  // ─── 전체 오디오 일괄 생성 (순차 호출로 진행 상황 표시) ──────────────────
  async function handleBatchGenerate() {
    const existing = scenes.filter(s => s.assets?.audio).length;
    const missing = scenes.length - existing;
    let targets: typeof scenes;

    let mode: "all" | "missing";
    if (existing === 0) {
      if (!confirm(`${scenes.length}개 장면의 오디오를 생성합니다. 계속하시겠습니까?`)) return;
      mode = "all";
      targets = scenes;
    } else if (missing === 0) {
      if (!confirm(`모든 장면(${scenes.length}개)에 이미 오디오가 있습니다.\n전체 다시 생성하시겠습니까?`)) return;
      mode = "all";
      targets = scenes;
    } else {
      const choice = window.prompt(
        `기존 오디오: ${existing}개 / 미생성: ${missing}개\n\n` +
        `1: 전체 다시 생성 (${scenes.length}개)\n` +
        `2: 미생성 장면만 생성 (${missing}개)\n\n` +
        `숫자를 입력하세요 (1 또는 2):`,
        "2"
      );
      if (choice !== "1" && choice !== "2") return;
      mode = choice === "1" ? "all" : "missing";
      targets = mode === "all" ? scenes : scenes.filter(s => !s.assets?.audio);
    }

    setBatchLoading(true);
    setBatchMode(mode);
    setBatchErrors([]);
    const errors: { sceneId: number; error: string }[] = [];
    try {
      for (let i = 0; i < targets.length; i++) {
        const sc = targets[i];
        setBatchProgress({ current: i + 1, total: targets.length, sceneId: sc.scene_id });
        try {
          const res = await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${sc.scene_id}/audio`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ttsSettings),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail ?? `HTTP ${res.status}`);
          }
          const data: { audio_path: string; duration: number } = await res.json();
          handleAudioUpdate(sc.scene_id, data.audio_path, data.duration);
        } catch (e) {
          errors.push({ sceneId: sc.scene_id, error: e instanceof Error ? e.message : "알 수 없는 오류" });
        }
      }
    } finally {
      setBatchProgress(null);
      setBatchMode(null);
      setBatchErrors(errors);
      setBatchLoading(false);
    }
  }

  // ─── 드래그앤드롭 ────────────────────────────────────────────────────────
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = scenes.findIndex(s => s.scene_id === active.id);
    const newIdx = scenes.findIndex(s => s.scene_id === over.id);
    onChange(renumber(arrayMove(scenes, oldIdx, newIdx)));
  }

  // ─── 텍스트+미디어 편집 ──────────────────────────────────────────────────
  function handleUpdate(index: number, text: string, topicSummary: string, media: MediaPlan) {
    onChange(scenes.map((s, i) =>
      i === index ? { ...s, text, topic_summary: topicSummary, estimated_duration: estimateDuration(text), media } : s
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
  function handleAdd(text: string, media: MediaPlan) {
    if (addAfterIndex === null) return;
    const insertAt = addAfterIndex + 1;
    const newScene: Scene = {
      scene_id: 0,
      text,
      topic_summary: "새 장면",
      estimated_duration: estimateDuration(text),
      media,
    };
    onChange(renumber([...scenes.slice(0, insertAt), newScene, ...scenes.slice(insertAt)]));
    setAddAfterIndex(null);
  }

  return (
    <div className={`relative ${disabled ? "pointer-events-none" : ""}`}>
    {disabled && (
      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-xl z-10 flex items-center justify-center">
        <p className="text-sm text-indigo-600 font-medium bg-white/90 px-4 py-2 rounded-lg shadow-sm border border-indigo-100">
          AI 분석 중에는 장면을 편집할 수 없습니다
        </p>
      </div>
    )}
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
        {scenes.some(s => s.assets?.subtitle?.length) && (
          <a
            href={`${API_BASE}/api/projects/${projectId}/subtitle.srt`}
            download={`subtitles-${projectId}.srt`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-50"
          >
            <Download size={11} /> SRT 다운로드
          </a>
        )}
        <button
          onClick={handleBatchGenerate}
          disabled={batchLoading || disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          {batchLoading && batchProgress
            ? <><Loader2 size={11} className="animate-spin" /> 장면 {batchProgress.sceneId} ({batchProgress.current}/{batchProgress.total})</>
            : batchLoading
              ? <><Loader2 size={11} className="animate-spin" /> 생성 중...</>
              : <><Mic2 size={11} /> 전체 오디오 생성</>
          }
        </button>
      </div>

      {/* 진행률 바 */}
      {batchLoading && batchProgress && (
        <div className="mb-3">
          <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 배치 에러 요약 */}
      {batchErrors.length > 0 && !batchLoading && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-1.5">{batchErrors.length}개 장면 생성 실패</p>
          <div className="flex flex-col gap-1">
            {batchErrors.map(e => (
              <p key={e.sceneId} className="text-xs text-red-600 break-words">
                <span className="font-semibold">장면 {e.sceneId}:</span> {e.error}
              </p>
            ))}
          </div>
        </div>
      )}

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
              projectId={projectId}
              ttsSettings={ttsSettings}
              batchMode={batchLoading ? batchMode : null}
              imageStyle={imageStyle}
              onUpdate={(text, topic, media) => handleUpdate(index, text, topic, media)}
              onAudioUpdate={handleAudioUpdate}
              onVisualUpdate={handleVisualUpdate}
              onSubtitleUpdate={handleSubtitleUpdate}
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
    </div>
  );
}
