// 保存层：localStorage 读写，失败回退到种子数据
import type { PersistShape } from "../types";
import { STORAGE_KEY, buildSeed } from "../data/seed";

export function loadState(): PersistShape {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return buildSeed();
  try {
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.vehicles)) {
      return buildSeed();
    }
    const seed = buildSeed();
    return {
      version: seed.version,
      vehicles: parsed.vehicles ?? [],
      sites: parsed.sites ?? [],
      orders: parsed.orders ?? [],
      dispositions: parsed.dispositions ?? [],
      settings: { ...seed.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return buildSeed();
  }
}

export function saveState(state: PersistShape): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
