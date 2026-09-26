// 判断层：低温保温测算规则（纯函数，不碰页面和存储）
import type {
  DeliveryOrder,
  Selection,
  Vehicle,
} from "../types";

/** 冬季夜间发车时段：分仓在同一日期的同一时段只能锁一个单 */
export const SLOTS = [
  { id: "slot-18", label: "夜一班 18:00–22:00" },
  { id: "slot-22", label: "夜二班 22:00–02:00" },
  { id: "slot-02", label: "凌晨班 02:00–06:00" },
] as const;

export type SlotId = (typeof SLOTS)[number]["id"];

export const STATUS_LABEL: Record<string, string> = {
  pending: "待排",
  inTransit: "在途",
  done: "已卸",
  open: "待处置",
  handling: "处置中",
  closed: "已闭环",
};

export function slotLabel(id: string): string {
  return SLOTS.find((s) => s.id === id)?.label ?? id;
}

export function lockKey(item: {
  vehicleId: string;
  bayId: string;
  date: string;
  slotId: string;
}): string {
  return `${item.vehicleId}|${item.bayId}|${item.date}|${item.slotId}`;
}

/** 当前已生效的分仓+时段锁定（在途单） */
export function activeLocks(orders: DeliveryOrder[]): Set<string> {
  const set = new Set<string>();
  for (const order of orders) {
    if (order.status === "inTransit" && order.assignment) {
      set.add(lockKey(order.assignment));
    }
  }
  return set;
}

export interface ThermalResult {
  estHours: number;
  estTemp: number;
  short: number;
  locked: boolean;
  tooSmall: boolean;
  vehicleMissing: boolean;
  ok: boolean;
  /** 不能直接排的原因（供页面禁用） */
  reason: string;
}

export interface EvaluateInput extends Selection {
  orders: DeliveryOrder[];
  vehicles: Vehicle[];
  /** 改派时排除自身占用：当前单的 id */
  selfOrderId?: string;
  loadTemp: number;
  mileage: number;
  tons: number;
  /** 站点最低接收温度 */
  minTemp: number;
  speed: number;
}

/**
 * 到站油温 = 装车温度 − 降温速度 × 行驶小时
 * 行驶小时 = 里程 / 夜间均速
 * 缺几度 = 站点最低接收温度 − 到站油温（≤0 视为 0）
 */
export function evaluate(input: EvaluateInput): ThermalResult {
  const vehicle = input.vehicles.find((v) => v.id === input.vehicleId);
  const bay = vehicle?.bays.find((b) => b.id === input.bayId);
  const estHours = input.speed > 0 ? input.mileage / input.speed : 0;
  const estTemp = bay ? input.loadTemp - bay.coolRate * estHours : NaN;
  const short = bay ? Math.max(0, input.minTemp - estTemp) : NaN;

  const vehicleMissing = !vehicle || !bay;
  const tooSmall = !!bay && bay.capacity < input.tons;
  const heldByOther =
    input.orders.some(
      (o) =>
        o.status === "inTransit" &&
        o.id !== input.selfOrderId &&
        o.assignment &&
        lockKey(o.assignment) === lockKey(input)
    );

  const reasons: string[] = [];
  if (vehicleMissing) reasons.push("未选择分仓");
  if (heldByOther) reasons.push("该分仓此时段已锁定");
  if (tooSmall && bay) reasons.push(`仓容不足（${bay.capacity}吨）`);

  return {
    estHours,
    estTemp,
    short,
    locked: heldByOther,
    tooSmall,
    vehicleMissing,
    ok: !vehicleMissing && !heldByOther && !tooSmall && short <= 0,
    reason: reasons.join("，"),
  };
}
