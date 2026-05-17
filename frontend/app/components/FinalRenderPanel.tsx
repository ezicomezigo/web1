"use client";

import { useState, useEffect, useCallback } from "react";
import { Scene } from "../types";
import { Download, Film, Loader2, CheckCircle, AlertTriangle, Trash2, PlayCircle, Eye } from "lucide-react";
import PreviewModal from "./PreviewModal";

const API_BASE = "http://localhost:8000";

interface Props {
  projectId: string;
  scenes: Scene[];
}

interface ExportStatus {
  status: "idle" | "running" | "done" | "error";
  progress: number;
  message: string;
  scene_count: number;
}

export default function FinalRenderPanel({ projectId, scenes }: Props) {
  const [jobStatus, setJobStatus] = useState<ExportStatus>({
    status: "idle",
    progress: 0,
    message: "",
    scene_count: 0,
  });
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const videoSceneCount = scenes.filter(s => s.assets?.video).length;

  // ─── 상태 폴링 ──────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/export/status`);
      if (!res.ok) return;
      const data: ExportStatus = await res.json();
      setJobStatus(data);
    } catch {
      // 네트워크 오류는 조용히 무시
    }
  }, [projectId]);

  // 컴포넌트 마운트 시 현재 상태 조회
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // running 상태일 때만 2초 간격으로 폴링
  useEffect(() => {
    if (jobStatus.status !== "running") return;
    const id = setInterval(fetchStatus, 2000);
    return () => clearInterval(id);
  }, [jobStatus.status, fetchStatus]);

  // ─── 내보내기 시작 ──────────────────────────────────────────────────────
  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/export`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b.detail ?? `오류: HTTP ${res.status}`);
        return;
      }
      setJobStatus({ status: "running", progress: 0, message: "내보내기 시작 중...", scene_count: videoSceneCount });
    } catch (e) {
      alert(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  // ─── 출력 파일 삭제 ─────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm("완성된 영상 파일(output.mp4)을 삭제하시겠습니까?")) return;
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/export`, { method: "DELETE" });
      setJobStatus({ status: "idle", progress: 0, message: "", scene_count: 0 });
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  }

  const isRunning = jobStatus.status === "running";
  const isDone = jobStatus.status === "done";
  const isError = jobStatus.status === "error";

  return (
    <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 flex flex-col gap-2">
      {/* 헤더 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-sm shrink-0">
          <Film size={14} />
          최종 영상 내보내기
        </div>
        <span className="text-xs text-rose-500 flex-1">
          렌더링 완료 장면 {videoSceneCount} / 전체 {scenes.length}개
        </span>
      </div>

      {/* 진행률 바 */}
      {isRunning && (
        <div>
          <div className="h-1.5 bg-rose-100 rounded-full overflow-hidden">
            {jobStatus.progress > 0 ? (
              <div
                className="h-full bg-rose-500 transition-all duration-300"
                style={{ width: `${jobStatus.progress * 100}%` }}
              />
            ) : (
              // indeterminate 애니메이션
              <div className="h-full w-1/3 bg-rose-400 animate-[slide_1.4s_ease-in-out_infinite]"
                style={{ animation: "indeterminate 1.4s ease-in-out infinite" }}
              />
            )}
          </div>
          <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
            <Loader2 size={11} className="animate-spin shrink-0" />
            {jobStatus.message || "처리 중..."}
            {jobStatus.scene_count > 0 && ` (${jobStatus.scene_count}개 장면)`}
          </p>
        </div>
      )}

      {/* 완료 메시지 */}
      {isDone && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs">
          <CheckCircle size={13} className="shrink-0" />
          <span className="flex-1">{jobStatus.message}</span>
        </div>
      )}

      {/* 오류 메시지 */}
      {isError && (
        <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span className="flex-1 break-words">{jobStatus.message}</span>
        </div>
      )}

      {/* 버튼 영역 */}
      <div className="flex gap-2 flex-wrap">
        {/* 전체 미리보기 (장면 영상 이어 재생) */}
        {videoSceneCount > 0 && (
          <button
            onClick={() => setShowPreview(true)}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40"
            title="장면 영상들을 순서대로 이어 재생 (내보내기 없이)"
          >
            <Eye size={11} /> 전체 미리보기
          </button>
        )}
        {/* 내보내기 시작 / 다시 내보내기 */}
        {!isRunning && (
          <button
            onClick={handleExport}
            disabled={loading || videoSceneCount < 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-40"
          >
            {loading
              ? <><Loader2 size={11} className="animate-spin" /> 시작 중...</>
              : isDone
              ? <><PlayCircle size={11} /> 다시 내보내기</>
              : isError
              ? <><PlayCircle size={11} /> 다시 시도</>
              : <><Film size={11} /> 내보내기 시작</>
            }
          </button>
        )}

        {/* 다운로드 링크 (완료 시) */}
        {isDone && (
          <a
            href={`${API_BASE}/api/projects/${projectId}/export/download`}
            download="output.mp4"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
          >
            <Download size={11} /> output.mp4 다운로드
          </a>
        )}

        {/* 삭제 (완료/오류 시) */}
        {(isDone || isError) && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-100"
          >
            <Trash2 size={11} /> 파일 삭제
          </button>
        )}
      </div>

      <style>{`
        @keyframes indeterminate {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>

      {showPreview && (
        <PreviewModal
          projectId={projectId}
          scenes={scenes}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
