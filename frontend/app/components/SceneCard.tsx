"use client";

import { useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Scene, MediaPlan, MediaType, MoodType, TTSSettings, SubtitleCue, RenderSettings } from "../types";
import { estimateDuration } from "../utils/sceneOps";
import MediaPlanEditor from "./MediaPlanEditor";
import StockSearchModal from "./StockSearchModal";
import SubtitleEditor from "./SubtitleEditor";
import SceneRender from "./SceneRender";
import {
  GripVertical, Pencil, Check, X, Scissors,
  Trash2, Plus, Sparkles, Image, Video,
  ChevronUp, ChevronDown, Mic2, Loader2, Play, RotateCcw, Trash, Upload, Copy, Search as SearchIcon, ClipboardPaste,
} from "lucide-react";

const API_BASE = "http://localhost:8000";

interface Props {
  scene: Scene;
  index: number;
  total: number;
  projectId: string;
  ttsSettings: TTSSettings;
  batchMode: "all" | "missing" | null;
  batchSceneId?: number | null;
  audioVersion?: number;
  imageStyle: string;
  renderSettings: RenderSettings;
  onUpdate: (text: string, topicSummary: string, media: MediaPlan) => void;
  onAudioUpdate: (sceneId: number, audioPath: string | null, duration: number) => void;
  onVisualUpdate: (sceneId: number, visualPath: string | null) => void;
  onSubtitleUpdate: (sceneId: number, cues: SubtitleCue[] | null) => void;
  onVideoUpdate: (sceneId: number, videoPath: string | null) => void;
  videoVersion?: number;
  onSplit: () => void;
  onMerge: (dir: "up" | "down") => void;
  onDelete: () => void;
  onAddAfter: () => void;
}

const MEDIA_CONFIG: Record<MediaType, { label: string; color: string; Icon: React.ElementType }> = {
  ai_image:    { label: "AI 이미지", color: "text-violet-700 bg-violet-50 border-violet-200", Icon: Sparkles },
  stock_photo: { label: "스톡 사진",  color: "text-sky-700 bg-sky-50 border-sky-200",         Icon: Image },
  stock_video: { label: "스톡 영상",  color: "text-teal-700 bg-teal-50 border-teal-200",      Icon: Video },
};

const MOOD_LABEL: Record<MoodType, string> = {
  bright: "밝음", calm: "차분", serious: "진지",
  energetic: "활기", dark: "어두움", emotional: "감성",
};

function durationColor(sec: number) {
  if (sec < 12) return "text-red-500 bg-red-50 border-red-100";
  if (sec > 20) return "text-orange-500 bg-orange-50 border-orange-100";
  return "text-emerald-600 bg-emerald-50 border-emerald-100";
}

export default function SceneCard({
  scene, index, total, projectId, ttsSettings, batchMode, batchSceneId = null, audioVersion: externalAudioVersion = 0, imageStyle, renderSettings, videoVersion = 0,
  onUpdate, onAudioUpdate, onVisualUpdate, onSubtitleUpdate, onVideoUpdate, onSplit, onMerge, onDelete, onAddAfter,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(scene.text);
  const [draftTopic, setDraftTopic] = useState(scene.topic_summary);
  const [draftMedia, setDraftMedia] = useState<MediaPlan>(scene.media);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioVersion, setAudioVersion] = useState(0);
  const [visualUploading, setVisualUploading] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [visualVersion, setVisualVersion] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.scene_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const media = MEDIA_CONFIG[scene.media.media_type];
  const MediaIcon = media.Icon;

  function startEdit() {
    setDraftText(scene.text);
    setDraftTopic(scene.topic_summary);
    setDraftMedia(scene.media);
    setEditing(true);
  }

  function saveEdit() {
    if (draftText.trim()) {
      onUpdate(draftText.trim(), draftTopic.trim() || scene.topic_summary, draftMedia);
    }
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function generateAudio() {
    setAudioLoading(true);
    setAudioError(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${scene.scene_id}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ttsSettings),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data: { audio_path: string; duration: number } = await res.json();
      setAudioVersion(v => v + 1);
      onAudioUpdate(scene.scene_id, data.audio_path, data.duration);
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "오디오 생성 실패");
    } finally {
      setAudioLoading(false);
    }
  }

  async function deleteAudio() {
    await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${scene.scene_id}/audio`, { method: "DELETE" });
    onAudioUpdate(scene.scene_id, null, estimateDuration(scene.text));
  }

  async function uploadVisual(file: File) {
    setVisualUploading(true);
    setVisualError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${scene.scene_id}/visual/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data: { visual_path: string } = await res.json();
      setVisualVersion(v => v + 1);
      onVisualUpdate(scene.scene_id, data.visual_path);
    } catch (e) {
      setVisualError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setVisualUploading(false);
    }
  }

  async function deleteVisual() {
    await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${scene.scene_id}/visual`, { method: "DELETE" });
    onVisualUpdate(scene.scene_id, null);
  }

  function copyImagePrompt() {
    const base = scene.media.ai_image_prompt?.trim() ?? "";
    if (!base) return;
    const tag = `PT${String(scene.scene_id).padStart(3, "0")}`;
    const full = imageStyle.trim() ? `${tag} ${base}, ${imageStyle.trim()}` : `${tag} ${base}`;
    navigator.clipboard.writeText(full).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1800);
    });
  }

  async function pasteVisualFromClipboard() {
    setVisualError(null);
    try {
      if (!navigator.clipboard?.read) {
        throw new Error("이 브라우저는 클립보드 읽기를 지원하지 않습니다.");
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1].replace("jpeg", "jpg");
          const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: imageType });
          await uploadVisual(file);
          return;
        }
      }
      throw new Error("클립보드에 이미지가 없습니다.");
    } catch (e) {
      setVisualError(e instanceof Error ? e.message : "붙여넣기 실패");
    }
  }

  const totalAudioVersion = audioVersion + externalAudioVersion;
  const audioUrl = scene.assets?.audio
    ? `${API_BASE}/api/projects/${projectId}/${scene.assets.audio}${totalAudioVersion ? `?v=${totalAudioVersion}` : ""}`
    : null;
  const visualUrl = scene.assets?.visual
    ? `${API_BASE}/api/projects/${projectId}/${scene.assets.visual}${visualVersion ? `?v=${visualVersion}` : ""}`
    : null;
  const visualIsVideo = scene.assets?.visual
    ? /\.(mp4|mov|webm)$/i.test(scene.assets.visual)
    : false;

  // 배치 중 버튼 비활성화: all → 생성/재생성 모두, missing → 생성 버튼만
  const batchDisableGenerate = batchMode !== null;
  const batchDisableRegenerate = batchMode === "all";
  // 현재 이 장면이 배치 작업 중인 장면인지
  const isProcessing = batchSceneId === scene.scene_id;

  const liveDuration = editing ? estimateDuration(draftText) : scene.estimated_duration;

  return (
    <div ref={setNodeRef} style={style} id={`scene-${scene.scene_id}`} className="group relative scroll-mt-4">
      <div className={`relative border rounded-xl bg-white shadow-sm transition-shadow ${isDragging ? "shadow-lg border-indigo-300" : isProcessing ? "border-indigo-300 shadow-md" : "border-gray-100 hover:shadow-md"}`}>
        {/* 배치 작업 중 오버레이 */}
        {isProcessing && (
          <div className="absolute inset-0 bg-indigo-50/70 backdrop-blur-[1px] rounded-xl z-10 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Loader2 size={13} className="animate-spin text-indigo-500 shrink-0" />
              <span className="text-xs font-medium text-indigo-700">작업 중...</span>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <button
            {...attributes}
            {...listeners}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          >
            <GripVertical size={16} />
          </button>
          <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold shrink-0">
            {scene.scene_id}
          </span>
          <div className="flex items-center gap-1 shrink-0" title="진행 상태: 오디오 · 비주얼 · 자막 · 영상">
            <span className={`w-2 h-2 rounded-full ${audioUrl ? "bg-emerald-500" : "bg-gray-200"}`} title="오디오" />
            <span className={`w-2 h-2 rounded-full ${visualUrl ? "bg-emerald-500" : "bg-gray-200"}`} title="비주얼" />
            <span className={`w-2 h-2 rounded-full ${scene.assets?.subtitle?.length ? "bg-emerald-500" : "bg-gray-200"}`} title="자막" />
            <span className={`w-2 h-2 rounded-full ${scene.assets?.video ? "bg-emerald-500" : "bg-gray-200"}`} title="장면 영상" />
          </div>
          {editing ? (
            <input
              value={draftTopic}
              onChange={e => setDraftTopic(e.target.value)}
              className="flex-1 text-sm border-b border-indigo-300 focus:outline-none text-gray-700 bg-transparent"
              placeholder="장면 주제"
            />
          ) : (
            <p className="flex-1 text-sm font-medium text-gray-700 truncate">{scene.topic_summary}</p>
          )}
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">
            {MOOD_LABEL[scene.media.mood]}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${durationColor(liveDuration)}`}>
            {liveDuration.toFixed(1)}초
          </span>
        </div>

        {/* 2열 본문 */}
        <div className="flex gap-0 px-3 pb-3">

          {/* ── 왼쪽: 대본 · 미디어 · 오디오 · 자막 ── */}
          <div className="flex-1 flex flex-col gap-2 min-w-0 pr-3">

            {/* 대본 텍스트 */}
            {editing ? (
              <textarea
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                rows={4}
                autoFocus
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2.5">
                {scene.text}
              </p>
            )}

            {/* 미디어 기획 */}
            {editing ? (
              <div className="border border-gray-100 rounded-xl p-3">
                <MediaPlanEditor value={draftMedia} onChange={setDraftMedia} />
              </div>
            ) : (
              <div className={`rounded-lg border px-3 py-2 ${media.color}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MediaIcon size={12} />
                  <span className="text-xs font-semibold">{media.label}</span>
                </div>
                {scene.media.media_type === "ai_image" && scene.media.ai_image_prompt && (
                  <div className="flex items-start gap-1.5">
                    <p className="text-xs font-mono opacity-75 leading-relaxed flex-1">{scene.media.ai_image_prompt}</p>
                    <button onClick={copyImagePrompt} title={`PT${String(scene.scene_id).padStart(3,"0")} 포함 복사`}
                      className={`shrink-0 p-1 rounded transition-colors ${promptCopied ? "text-emerald-600" : "opacity-60 hover:opacity-100"}`}>
                      {promptCopied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}
                {scene.media.stock_keywords && (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1 flex-1">
                      {scene.media.stock_keywords.map(kw => (
                        <span key={kw} className="text-xs bg-white/60 rounded px-1.5 py-0.5 border border-current/20">{kw}</span>
                      ))}
                    </div>
                    {(scene.media.media_type === "stock_photo" || scene.media.media_type === "stock_video") && (
                      <button onClick={() => setShowStockSearch(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 text-xs font-medium hover:bg-white shrink-0 border border-current/20">
                        <SearchIcon size={11} /> 스톡 검색
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 오디오 */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
              {audioUrl ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Play size={12} className="text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-emerald-700">오디오 · {scene.estimated_duration.toFixed(1)}초</span>
                    <div className="flex-1" />
                    <button onClick={generateAudio} disabled={audioLoading || batchDisableRegenerate}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-600 disabled:opacity-40 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition-colors">
                      {audioLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} 재생성
                    </button>
                    <button onClick={deleteAudio} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors">
                      <Trash size={11} />
                    </button>
                  </div>
                  <audio ref={audioRef} src={audioUrl} controls
                    className="w-full h-8 [&::-webkit-media-controls-panel]:bg-white" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Mic2 size={12} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-400 flex-1">오디오 없음</span>
                    <button onClick={generateAudio} disabled={audioLoading || batchDisableGenerate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                      {audioLoading ? <><Loader2 size={11} className="animate-spin" /> 생성 중...</> : <><Mic2 size={11} /> 오디오 생성</>}
                    </button>
                  </div>
                  {audioError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2 break-words">{audioError}</div>}
                </div>
              )}
            </div>

            {/* 자막 */}
            <SubtitleEditor
              projectId={projectId}
              sceneId={scene.scene_id}
              hasAudio={!!audioUrl}
              cues={scene.assets?.subtitle ?? null}
              onChange={onSubtitleUpdate}
            />
          </div>

          {/* ── 오른쪽: 비주얼 · 렌더 영상 ── */}
          <div className="w-80 shrink-0 flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) uploadVisual(f);
                e.target.value = "";
              }}
            />

            {/* 비주얼 */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2">
              {/* 비주얼 헤더 버튼들 */}
              <div className="flex items-center gap-1.5 mb-1.5">
                {visualUrl
                  ? (visualIsVideo ? <Video size={13} className="text-emerald-600" /> : <Image size={13} className="text-emerald-600" />)
                  : (scene.media.media_type === "ai_image" ? <Sparkles size={13} className="text-gray-400" />
                    : scene.media.media_type === "stock_video" ? <Video size={13} className="text-gray-400" />
                    : <Image size={13} className="text-gray-400" />)
                }
                <span className={`text-xs font-medium flex-1 truncate ${visualUrl ? "text-emerald-700" : "text-gray-400"}`}>
                  {visualUrl ? (visualIsVideo ? "영상" : "이미지") : "비주얼 없음"}
                </span>
                {visualUrl ? (
                  <>
                    <button onClick={pasteVisualFromClipboard} disabled={visualUploading} title="클립보드 교체"
                      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors">
                      {visualUploading ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />}
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={visualUploading} title="파일 교체"
                      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors">
                      <RotateCcw size={14} />
                    </button>
                    <button onClick={deleteVisual} className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {scene.media.media_type === "ai_image" && scene.media.ai_image_prompt && (
                      <button onClick={copyImagePrompt} title="프롬프트 복사"
                        className={`p-1 rounded transition-colors ${promptCopied ? "text-emerald-500" : "text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"}`}>
                        {promptCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    )}
                    <button onClick={pasteVisualFromClipboard} disabled={visualUploading} title="클립보드 붙여넣기"
                      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors">
                      <ClipboardPaste size={14} />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={visualUploading} title="업로드"
                      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors">
                      <Upload size={14} />
                    </button>
                  </>
                )}
              </div>
              {visualError && <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-1.5 break-words">{visualError}</div>}
              {visualUrl ? (
                visualIsVideo
                  ? <video src={visualUrl} controls className="w-full rounded-lg bg-black aspect-video object-contain" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={visualUrl} alt="비주얼" className="w-full rounded-lg bg-white aspect-video object-contain" />
              ) : (
                <div className="w-full aspect-video rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} className="text-gray-300" />
                  <span className="text-[10px] text-gray-300">클릭하여 업로드</span>
                </div>
              )}
            </div>

            {/* 렌더 영상 */}
            <SceneRender
              projectId={projectId}
              sceneId={scene.scene_id}
              hasAudio={!!audioUrl}
              videoPath={scene.assets?.video}
              onChange={onVideoUpdate}
              settings={renderSettings}
              externalVersion={videoVersion}
              compact
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 px-4 pb-3 border-t border-gray-50 pt-2">
          {editing ? (
            <>
              <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
                <Check size={12} /> 저장
              </button>
              <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs hover:bg-gray-50">
                <X size={12} /> 취소
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100" title="편집">
                <Pencil size={12} /> 편집
              </button>
              <button onClick={onSplit} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100" title="나누기">
                <Scissors size={12} /> 나누기
              </button>
              <button onClick={() => onMerge("up")} disabled={index === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronUp size={12} /> 위와 합치기
              </button>
              <button onClick={() => onMerge("down")} disabled={index === total - 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronDown size={12} /> 아래와 합치기
              </button>
              <div className="flex-1" />
              <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-50">
                <Trash2 size={12} /> 삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* 아래에 장면 추가 */}
      <button
        onClick={onAddAfter}
        className="w-full flex items-center justify-center gap-1 py-1 text-gray-300 hover:text-indigo-500 transition-colors group/add"
      >
        <div className="h-px flex-1 bg-gray-100 group-hover/add:bg-indigo-200 transition-colors" />
        <span className="flex items-center gap-0.5 text-xs px-2 shrink-0"><Plus size={11} /> 장면 추가</span>
        <div className="h-px flex-1 bg-gray-100 group-hover/add:bg-indigo-200 transition-colors" />
      </button>

      {showStockSearch && (
        <StockSearchModal
          projectId={projectId}
          sceneId={scene.scene_id}
          keywords={scene.media.stock_keywords ?? []}
          defaultMediaType={scene.media.media_type === "stock_video" ? "video" : "photo"}
          onSelect={path => { setVisualVersion(v => v + 1); onVisualUpdate(scene.scene_id, path); setShowStockSearch(false); }}
          onClose={() => setShowStockSearch(false)}
        />
      )}
    </div>
  );
}
