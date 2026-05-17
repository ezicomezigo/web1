"use client";

import { useState } from "react";
import { Loader2, Captions, Trash, RotateCcw, Plus, X, Wand2 } from "lucide-react";
import { SubtitleCue } from "../types";

const API_BASE = "http://localhost:8000";

interface Props {
  projectId: string;
  sceneId: number;
  hasAudio: boolean;
  cues: SubtitleCue[] | null | undefined;
  onChange: (sceneId: number, cues: SubtitleCue[] | null) => void;
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

export default function SubtitleEditor({
  projectId, sceneId, hasAudio, cues, onChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/subtitle`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data: SubtitleCue[] = await res.json();
      onChange(sceneId, data);
      setExpanded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자막 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  async function persistCues(next: SubtitleCue[]) {
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/subtitle`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cues: next }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      onChange(sceneId, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function correctWithScript() {
    setCorrecting(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/subtitle/correct`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data: SubtitleCue[] = await res.json();
      onChange(sceneId, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자막 보정 실패");
    } finally {
      setCorrecting(false);
    }
  }

  async function deleteSubtitle() {
    await fetch(`${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/subtitle`, { method: "DELETE" });
    onChange(sceneId, null);
    setExpanded(false);
  }

  function updateCue(i: number, patch: Partial<SubtitleCue>) {
    if (!cues) return;
    const next = cues.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    persistCues(next);
  }

  function deleteCue(i: number) {
    if (!cues) return;
    persistCues(cues.filter((_, idx) => idx !== i));
  }

  function addCue(i: number) {
    if (!cues) return;
    const prev = cues[i];
    const next = cues[i + 1];
    const start = prev ? prev.end : 0;
    const end = next ? Math.min(start + 2, next.start) : start + 2;
    const inserted: SubtitleCue = { start, end, text: "" };
    persistCues([...cues.slice(0, i + 1), inserted, ...cues.slice(i + 1)]);
  }

  if (!hasAudio) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Captions size={12} />
          <span>오디오 생성 후 자막을 만들 수 있습니다</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Captions size={12} className={cues ? "text-emerald-600" : "text-gray-400"} />
          <button
            onClick={() => cues && setExpanded(e => !e)}
            disabled={!cues}
            className={`text-xs font-medium flex-1 text-left ${cues ? "text-emerald-700 hover:text-emerald-800" : "text-gray-400 cursor-default"}`}
          >
            {cues
              ? `자막 ${cues.length}개 ${expanded ? "▲" : "▼"}`
              : "자막 없음"}
          </button>
          {saving && <Loader2 size={11} className="animate-spin text-indigo-400" />}
          {cues ? (
            <>
              <button onClick={correctWithScript} disabled={correcting || loading}
                title="대본 텍스트로 인식 오류 교정 (타임스탬프 유지)"
                className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 px-1.5 py-0.5 rounded disabled:opacity-40 transition-colors">
                {correcting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />} 보정
              </button>
              <button onClick={generate} disabled={loading || correcting}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded disabled:opacity-40 transition-colors">
                {loading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} 재생성
              </button>
              <button onClick={deleteSubtitle} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors">
                <Trash size={11} />
              </button>
            </>
          ) : (
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading
                ? <><Loader2 size={11} className="animate-spin" /> Whisper 처리 중...</>
                : <><Captions size={11} /> 자막 생성</>
              }
            </button>
          )}
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2 leading-relaxed break-words">
            {error}
          </div>
        )}
        {cues && expanded && (
          <div className="flex flex-col gap-1.5 mt-1">
            {cues.map((cue, i) => (
              <div key={i} className="group/cue flex items-start gap-2 bg-white rounded-lg border border-gray-100 px-2 py-1.5">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <input
                    type="number" step={0.01} value={cue.start.toFixed(2)}
                    onChange={e => updateCue(i, { start: Number(e.target.value) })}
                    className="w-16 text-[10px] font-mono text-gray-500 border-b border-transparent focus:border-indigo-300 focus:outline-none"
                  />
                  <input
                    type="number" step={0.01} value={cue.end.toFixed(2)}
                    onChange={e => updateCue(i, { end: Number(e.target.value) })}
                    className="w-16 text-[10px] font-mono text-gray-500 border-b border-transparent focus:border-indigo-300 focus:outline-none"
                  />
                </div>
                <textarea
                  value={cue.text}
                  onChange={e => updateCue(i, { text: e.target.value })}
                  rows={1}
                  className="flex-1 text-xs text-gray-800 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-y"
                />
                <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover/cue:opacity-100 transition-opacity">
                  <button onClick={() => addCue(i)} className="text-gray-300 hover:text-indigo-600" title="아래 추가">
                    <Plus size={11} />
                  </button>
                  <button onClick={() => deleteCue(i)} className="text-gray-300 hover:text-red-500" title="삭제">
                    <X size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
