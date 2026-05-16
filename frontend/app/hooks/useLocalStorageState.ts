"use client";

import { useEffect, useState } from "react";

/**
 * useState + localStorage 영속화.
 * SSR-안전 (초기 렌더는 기본값 → 마운트 직후 storage 값으로 교체).
 */
export function useLocalStorageState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // 손상된 JSON 무시
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 용량 초과 무시
    }
  }, [key, value, hydrated]);

  return [value, setValue];
}
