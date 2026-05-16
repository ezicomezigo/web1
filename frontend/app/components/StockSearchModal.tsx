"use client";

import { useState } from "react";
import { X, Search, Loader2, Download, Check } from "lucide-react";

const API_BASE = "http://localhost:8000";

type Source = "pixabay" | "pexels" | "unsplash";
type MediaType = "photo" | "video";

interface StockItem {
  id: string;
  source: Source;
  thumb_url: string;
  preview_url: string;
  download_url: string;
  width: number;
  height: number;
  media_type: MediaType;
  duration: number | null;
  attribution: string;
}

interface Props {
  projectId: string;
  sceneId: number;
  keywords: string[];
  defaultMediaType: MediaType;
  onSelect: (visualPath: string) => void;
  onClose: () => void;
}

const SOURCE_LABELS: Record<Source, string> = {
  pixabay: "Pixabay",
  pexels: "Pexels",
  unsplash: "Unsplash",
};

export default function StockSearchModal({
  projectId, sceneId, keywords, defaultMediaType, onSelect, onClose,
}: Props) {
  const [source, setSource] = useState<Source>("pexels");
  const [mediaType, setMediaType] = useState<MediaType>(defaultMediaType);
  const [editedKeywords, setEditedKeywords] = useState(keywords.join(", "));
  const [results, setResults] = useState<StockItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const sources: Source[] = mediaType === "video"
    ? ["pixabay", "pexels"]
    : ["pixabay", "pexels", "unsplash"];

  async function doSearch(p = 1) {
    const kws = editedKeywords.split(",").map(k => k.trim()).filter(Boolean);
    if (!kws.length) return;
    setLoading(true);
    setError(null);
    if (p === 1) setResults([]);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/visual/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, media_type: mediaType, keywords: kws, page: p, per_page: 15 }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data: StockItem[] = await res.json();
      setResults(prev => p === 1 ? data : [...prev, ...data]);
      setPage(p);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색 실패");
    } finally {
      setLoading(false);
    }
  }

  async function doSelect(item: StockItem) {
    setSelecting(item.id);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/visual/select`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            download_url: item.download_url,
            source: item.source,
            media_type: item.media_type,
            attribution: item.attribution,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data: { visual_path: string } = await res.json();
      onSelect(data.visual_path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "선택 실패");
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex-1">스톡 미디어 검색</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* 검색 설정 */}
        <div className="px-5 py-3 border-b border-gray-100 flex flex-col gap-2.5">
          {/* 소스 + 미디어 타입 */}
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              {sources.map(s => (
                <button key={s}
                  onClick={() => { setSource(s); setResults([]); setSearched(false); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    source === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  {SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 ml-auto">
              {(["photo", "video"] as MediaType[]).map(t => (
                <button key={t}
                  onClick={() => {
                    setMediaType(t);
                    if (t === "video" && source === "unsplash") setSource("pexels");
                    setResults([]); setSearched(false);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    mediaType === t ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {t === "photo" ? "사진" : "영상"}
                </button>
              ))}
            </div>
          </div>

          {/* 키워드 + 검색 버튼 */}
          <div className="flex gap-2">
            <input
              value={editedKeywords}
              onChange={e => setEditedKeywords(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch(1)}
              placeholder="키워드 (쉼표로 구분)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={() => doSearch(1)}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              검색
            </button>
          </div>
        </div>

        {/* 결과 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 mb-3 break-words">
              {error}
            </div>
          )}

          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Search size={32} className="mb-2 opacity-30" />
              <p className="text-sm">키워드를 입력하고 검색하세요</p>
              <p className="text-xs mt-1 opacity-60">장면 키워드: {keywords.join(", ")}</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {results.map(item => (
                <div key={`${item.source}-${item.id}`} className="relative group rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumb_url || item.preview_url}
                    alt={item.attribution}
                    className="w-full aspect-video object-cover"
                    loading="lazy"
                  />
                  {item.media_type === "video" && item.duration && (
                    <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {Math.floor(item.duration)}초
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <button
                      onClick={() => doSelect(item)}
                      disabled={selecting !== null}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-semibold shadow-lg hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {selecting === item.id
                        ? <><Loader2 size={11} className="animate-spin" /> 다운로드 중...</>
                        : <><Download size={11} /> 선택</>
                      }
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 px-2 py-1 truncate">{item.attribution}</p>
                </div>
              ))}
            </div>
          )}

          {searched && results.length === 0 && !loading && (
            <div className="text-center text-gray-400 text-sm py-10">검색 결과가 없습니다.</div>
          )}

          {/* 더 보기 */}
          {results.length > 0 && results.length % 15 === 0 && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => doSearch(page + 1)}
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                더 보기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
