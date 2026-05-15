"use client";

import { useState, useEffect } from "react";
import { ProjectMeta } from "../types";
import { FolderOpen, Plus, Trash2, Pencil, X, Check, Film } from "lucide-react";

interface Props {
  currentProjectId: string | null;
  onOpen: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onClose: () => void;
  listProjects: () => Promise<ProjectMeta[]>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ProjectListModal({
  currentProjectId, onOpen, onCreate, onDelete, onRename, onClose, listProjects,
}: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    listProjects().then(p => { setProjects(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    onClose();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    await onDelete(id);
    setProjects(p => p.filter(x => x.id !== id));
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    await onRename(id, renameValue.trim());
    setProjects(p => p.map(x => x.id === id ? { ...x, name: renameValue.trim() } : x));
    setRenamingId(null);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <FolderOpen size={17} /> 내 프로젝트
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* 새 프로젝트 */}
        <div className="px-6 py-4 border-b border-gray-100">
          {creatingNew ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreatingNew(false); }}
                placeholder="프로젝트 이름"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button onClick={handleCreate} disabled={!newName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40">
                만들기
              </button>
              <button onClick={() => setCreatingNew(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
                취소
              </button>
            </div>
          ) : (
            <button onClick={() => setCreatingNew(true)}
              className="flex items-center gap-2 w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm">
              <Plus size={15} /> 새 프로젝트 만들기
            </button>
          )}
        </div>

        {/* 프로젝트 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {loading && <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>}
          {!loading && projects.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">저장된 프로젝트가 없습니다.</p>
          )}
          {projects.map(p => (
            <div key={p.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                p.id === currentProjectId ? "border-indigo-200 bg-indigo-50" : "border-gray-100 hover:border-gray-200 bg-white"
              }`}
            >
              {renamingId === p.id ? (
                <div className="flex flex-1 gap-2">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleRename(p.id); if (e.key === "Escape") setRenamingId(null); }}
                    className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
                  />
                  <button onClick={() => handleRename(p.id)} className="text-indigo-600 hover:text-indigo-800"><Check size={15} /></button>
                  <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                      <Film size={10} /> {p.scene_count}장면
                      <span>· {formatDate(p.updated_at)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.id !== currentProjectId && (
                      <button onClick={() => { onOpen(p.id); onClose(); }}
                        className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        열기
                      </button>
                    )}
                    {p.id === currentProjectId && (
                      <span className="px-3 py-1.5 text-xs text-indigo-600 bg-indigo-100 rounded-lg">현재</span>
                    )}
                    <button onClick={() => { setRenamingId(p.id); setRenameValue(p.name); }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(p.id, p.name)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
