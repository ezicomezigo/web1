"use client";

import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { Scene, MediaPlan, TTSSettings, SubtitleCue, RenderSettings } from "../types";
import { renumber, estimateDuration, DEFAULT_MEDIA } from "../utils/sceneOps";
import SceneCard from "./SceneCard";
import SplitSceneModal from "./SplitSceneModal";
import AddSceneModal from "./AddSceneModal";
import { Film, Clock, AlertTriangle, CheckCircle, Plus, Mic2, Loader2, Download, Captions, Clapperboard } from "lucide-react";

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
  renderSettings: RenderSettings;
}

export default function SceneEditor({
  scenes, onChange, warnings, aiProvider, modelUsed, disabled = false, projectId, ttsSettings, imageStyle, renderSettings,
}: Props) {
  const [splitTarget, setSplitTarget] = useState<number | null>(null);
  const [addAfterIndex, setAddAfterIndex] = useState<number | null>(null);

  type BatchType = "audio" | "subtitle" | "render";
  const [batchType, setBatchType] = useState<BatchType | null>(null);
  const [batchMode, setBatchMode] = useState<"all" | "missing" | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; sceneId: number } | null>(null);
  const [batchErrors, setBatchErrors] = useState<{ sceneId: number; error: string }[]>([]);
  const batchLoading = batchType !== null;

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

  // ─── 장면 영상 업데이트 ──────────────────────────────────────────────────
  function handleVideoUpdate(sceneId: number, videoPath: string | null) {
    onChange(prev => prev.map(s => s.scene_id === sceneId
      ? { ...s, assets: { ...(s.assets ?? { audio: null, visual: null }), video: videoPath } }
      : s
    ));
  }

  // ─── 배치 작업 공통 헬퍼 ─────────────────────────────────────────────────
  function pickBatchTargets(
    hasItem: (s: typeof scenes[0]) => boolean,
    label: string,
    candidateFilter?: (s: typeof scenes[0]) => boolean,
  ): { targets: typeof scenes; mode: "all" | "missing" } | null {
    const eligible = candidateFilter ? scenes.filter(candidateFilter) : scenes;
    if (eligible.length === 0) { alert(`${label}을 생성할 수 있는 장면이 없습니다.`); return null; }
    const existing = eligible.filter(hasItem).length;
    const missing = eligible.length - existing;
    if (existing === 0) {
      if (!confirm(`${eligible.length}개 장면의 ${label}을 생성합니다.`)) return null;
      return { targets: eligible, mode: "missing" };
    }
    if (missing === 0) {
      if (!confirm(`모든 장면(${eligible.length}개)에 이미 ${label}이 있습니다.\n전체 다시 생성하시겠습니까?`)) return null;
      return { targets: eligible, mode: "all" };
    }
    const choice = window.prompt(
      `기존 ${label}: ${existing}개 / 미생성: ${missing}개\n\n` +
      `1: 전체 다시 생성 (${eligible.length}개)\n2: 미생성 장면만 (${missing}개)\n\n숫자 입력 (1 또는 2):`, "2"
    );
    if (choice !== "1" && choice !== "2") return null;
    const mode = choice === "1" ? "all" : "missing";
    return { targets: mode === "all" ? eligible : eligible.filter(s => !hasItem(s)), mode };
  }

  async function runBatch(
    type: BatchType,
    targets: typeof scenes,
    mode: "all" | "missing",
    action: (sc: typeof scenes[0]) => Promise<void>,
  ) {
    setBatchType(type);
    setBatchMode(mode);
    setBatchErrors([]);
    const errors: { sceneId: number; error: string }[] = [];
    try {
      for (let i = 0; i < targets.length; i++) {
        setBatchProgress({ current: i + 1, total: targets.length, sceneId: targets[i].scene_id });
        try { await action(targets[i]); }
        catch (e) { errors.push({ sceneId: targets[i].scene_id, error: e instanceof Error ? e.message : "오류" }); }
      }
    } finally {
      setBatchProgress(null);
      setBatchMode(null);
      setBatchErrors(errors);
      setBatchType(null);
    }
  }

  // ─── 전체 오디오 일괄 생성 ───────────────────────────────────────────────
  async function handleBatchAudio() {
    const pick = pickBatchTargets(s => !!s.assets?.audio, "오디오");
    if (!pick) return;
    await runBatch("audio", pick.targets, pick.mode, async (sc) => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${sc.scene_id}/audio`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ttsSettings),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.detail ?? `HTTP ${res.status}`); }
      const data: { audio_path: string; duration: number } = await res.json();
      handleAudioUpdate(sc.scene_id, data.audio_path, data.duration);
    });
  }

  // ─── 전체 자막 일괄 생성 (오디오 있는 장면만) ───────────────────────────
  async function handleBatchSubtitle() {
    const pick = pickBatchTargets(
      s => !!(s.assets?.subtitle?.length),
      "자막",
      s => !!s.assets?.audio,
    );
    if (!pick) return;
    await runBatch("subtitle", pick.targets, pick.mode, async (sc) => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${sc.scene_id}/subtitle`, { method: "POST" });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.detail ?? `HTTP ${res.status}`); }
      const data: SubtitleCue[] = await res.json();
      handleSubtitleUpdate(sc.scene_id, data);
    });
  }

  // ─── 전체 렌더링 일괄 생성 (오디오 있는 장면만, 비주얼/자막 옵션) ────────
  async function handleBatchRender() {
    const pick = pickBatchTargets(
      s => !!s.assets?.video,
      "렌더링",
      s => !!s.assets?.audio,
    );
    if (!pick) return;
    await runBatch("render", pick.targets, pick.mode, async (sc) => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${sc.scene_id}/render`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(renderSettings),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.detail ?? `HTTP ${res.status}`); }
      const data: { video_path: string } = await res.json();
      handleVideoUpdate(sc.scene_id, data.video_path);
    });
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
      <div className="flex flex-col gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-indigo-700 shrink-0">
            <Film size={16} />
            <span className="font-semibold text-sm">{scenes.length}개 장면</span>
          </div>
          <div className="flex items-center gap-2 text-indigo-600 text-sm shrink-0">
            <Clock size={14} />
            <span>총 {totalMin > 0 ? `${totalMin}분 ` : ""}{totalSec}초</span>
          </div>
          <span className="text-xs text-indigo-400 flex-1">{aiProvider === "claude" ? "Claude" : "Gemini"} · {modelUsed}</span>
          {scenes.some(s => s.assets?.subtitle?.length) && (
            <a href={`${API_BASE}/api/projects/${projectId}/subtitle.srt`}
              download={`subtitles-${projectId}.srt`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-white shrink-0">
              <Download size={11} /> SRT
            </a>
          )}
        </div>
        {/* 일괄 생성 버튼 3종 */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleBatchAudio} disabled={batchLoading || disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40">
            {batchType === "audio" && batchProgress
              ? <><Loader2 size={11} className="animate-spin" /> 오디오 {batchProgress.current}/{batchProgress.total}</>
              : <><Mic2 size={11} /> 전체 오디오 생성</>}
          </button>
          <button onClick={handleBatchSubtitle} disabled={batchLoading || disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-40">
            {batchType === "subtitle" && batchProgress
              ? <><Loader2 size={11} className="animate-spin" /> 자막 {batchProgress.current}/{batchProgress.total}</>
              : <><Captions size={11} /> 전체 자막 생성</>}
          </button>
          <button onClick={handleBatchRender} disabled={batchLoading || disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-40">
            {batchType === "render" && batchProgress
              ? <><Loader2 size={11} className="animate-spin" /> 렌더 {batchProgress.current}/{batchProgress.total}</>
              : <><Clapperboard size={11} /> 전체 렌더링</>}
          </button>
        </div>
      </div>

      {/* 진행률 바 */}
      {batchLoading && batchProgress && (
        <div className="mb-3">
          <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                batchType === "subtitle" ? "bg-emerald-500" : batchType === "render" ? "bg-violet-500" : "bg-indigo-500"
              }`}
              style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 배치 에러 요약 */}
      {batchErrors.length > 0 && !batchLoading && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-1.5">{batchErrors.length}개 장면 실패</p>
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
              renderSettings={renderSettings}
              onUpdate={(text, topic, media) => handleUpdate(index, text, topic, media)}
              onAudioUpdate={handleAudioUpdate}
              onVisualUpdate={handleVisualUpdate}
              onSubtitleUpdate={handleSubtitleUpdate}
              onVideoUpdate={handleVideoUpdate}
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
