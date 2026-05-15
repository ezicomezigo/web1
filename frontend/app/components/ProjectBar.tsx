"use client";

import { useState } from "react";
import { FolderOpen, Save, Loader2, Circle, CheckCircle2, ChevronDown } from "lucide-react";

interface Props {
  projectName: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  isAnalyzing?: boolean;
  onOpenList: () => void;
  onSave: () => void;
  onRenameInline: (name: string) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ProjectBar({
  projectName, isDirty, isSaving, lastSavedAt, isAnalyzing = false, onOpenList, onSave, onRenameInline,
}: Props) {
  const blocked = isAnalyzing || isSaving;
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName ?? "");

  function commitRename() {
    if (nameValue.trim() && nameValue.trim() !== projectName) {
      onRenameInline(nameValue.trim());
    }
    setEditingName(false);
  }

  return (
    <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-6">
      {/* 프로젝트 이름 */}
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onOpenList} disabled={blocked}
          className="flex items-center gap-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors">
          <FolderOpen size={16} />
        </button>

        {editingName && projectName !== null ? (
          <input
            autoFocus
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingName(false); }}
            className="text-sm font-semibold text-gray-800 border-b border-indigo-400 focus:outline-none bg-transparent"
          />
        ) : (
          <button
            onClick={() => { if (blocked) return; if (projectName) { setNameValue(projectName); setEditingName(true); } else onOpenList(); }}
            className="flex items-center gap-1 text-sm font-semibold text-gray-800 hover:text-indigo-700 truncate max-w-xs transition-colors"
          >
            {projectName ?? <span className="text-gray-400 font-normal">프로젝트 없음</span>}
            {projectName && <ChevronDown size={13} className="text-gray-400 shrink-0" />}
          </button>
        )}

        {isDirty && <Circle size={7} className="fill-amber-400 text-amber-400 shrink-0" />}
      </div>

      {/* 저장 상태 + 버튼 */}
      <div className="flex items-center gap-3 shrink-0">
        {lastSavedAt && !isDirty && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <CheckCircle2 size={11} className="text-emerald-500" />
            {formatTime(lastSavedAt)}
          </span>
        )}
        {isDirty && !isSaving && (
          <span className="text-xs text-amber-500">저장되지 않은 변경사항</span>
        )}

        {projectName && (
          <button
            onClick={onSave}
            disabled={blocked || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {isSaving
              ? <><Loader2 size={12} className="animate-spin" /> 저장 중...</>
              : <><Save size={12} /> 저장</>
            }
          </button>
        )}

        <button onClick={onOpenList} disabled={blocked}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <FolderOpen size={12} /> 프로젝트
        </button>
      </div>
    </div>
  );
}
