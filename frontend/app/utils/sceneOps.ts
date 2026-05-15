"use client";

import { Scene, MediaPlan } from "../types";

// 장면 목록 renumber (편집 후 항상 호출)
export function renumber(scenes: Scene[]): Scene[] {
  return scenes.map((s, i) => ({ ...s, scene_id: i + 1 }));
}

// 텍스트 길이 기반 낭독 시간 추정
export function estimateDuration(text: string): number {
  return Math.round((text.length / 5.5) * 10) / 10;
}

// 텍스트를 문장 단위로 분리 (분할 모달용)
export function splitIntoSentences(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: string[] = [];
  for (const line of lines) {
    const parts = line.split(/(?<=[.!?~])\s+/);
    result.push(...parts.map(p => p.trim()).filter(Boolean));
  }
  return result.length > 0 ? result : [text];
}

export const DEFAULT_MEDIA: MediaPlan = {
  media_type: "stock_video",
  ai_image_prompt: null,
  stock_keywords: null,
  mood: "calm",
};
