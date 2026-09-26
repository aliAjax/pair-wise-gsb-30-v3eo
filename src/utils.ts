// 通用小工具

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 本地日期 YYYY-MM-DD */
export function dateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO 时间转 YYYY-MM-DD HH:mm */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 一位小数，异常值显示 — */
export function fmt1(n: number): string {
  return Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "—";
}
