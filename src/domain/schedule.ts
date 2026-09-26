// 判断层：到站油温估算、缺温计算、分仓时段锁定判断（纯函数，不依赖页面与存储）
import type { Assignment, DeliveryOrder, Station, Vehicle } from "../types";

/** 冬季夜间发车时段 */
export const TIME_SLOTS = ["18:00-20:00", "20:00-22:00", "22:00-24:00", "00:00-02:00"] as const;

/** 冬季夜间平均行驶速度 km/h，用于把里程换算成在途时长 */
export const AVG_SPEED_KMH = 45;

/** 行程时长（小时）= 里程 ÷ 平均车速 */
export function transitHours(mileage: number): number {
  return mileage / AVG_SPEED_KMH;
}

/** 估算到站油温 = 装车温度 − 分仓降温速度 × 行程时长，保留 1 位小数 */
export function estimateArrivalTemp(loadTemp: number, coolRate: number, mileage: number): number {
  return Math.round((loadTemp - coolRate * transitHours(mileage)) * 10) / 10;
}

/** 缺口温度：估算值低于站点最低接收温度时，还差几度（达标返回 0） */
export function gapDegrees(estimated: number, minTemp: number): number {
  return Math.max(0, Math.round((minTemp - estimated) * 10) / 10);
}

/** 分仓 + 时段是否已被在途订单锁定 */
export function isBayLocked(
  orders: DeliveryOrder[],
  vehicleId: string,
  bayId: string,
  slot: string,
  excludeOrderId?: string
): boolean {
  return orders.some(
    (order) =>
      order.id !== excludeOrderId &&
      order.status === "inTransit" &&
      order.assignment !== null &&
      order.assignment.vehicleId === vehicleId &&
      order.assignment.bayId === bayId &&
      order.assignment.slot === slot
  );
}

export interface BayChoice {
  vehicle: Vehicle;
  bayId: string;
  bayName: string;
  coolRate: number;
  estimated: number;
  gap: number;
  locked: boolean;
  ok: boolean;
}

/** 为待排订单计算全部可选分仓：估算到站油温、是否达标、是否被锁定 */
export function bayOptionsFor(
  order: DeliveryOrder,
  station: Station,
  vehicles: Vehicle[],
  orders: DeliveryOrder[],
  slot: string
): BayChoice[] {
  const choices: BayChoice[] = [];
  for (const vehicle of vehicles) {
    for (const bay of vehicle.bays) {
      const estimated = estimateArrivalTemp(order.loadTemp, bay.coolRate, order.mileage);
      const gap = gapDegrees(estimated, station.minTemp);
      const locked = isBayLocked(orders, vehicle.id, bay.id, slot, order.id);
      choices.push({
        vehicle,
        bayId: bay.id,
        bayName: bay.name,
        coolRate: bay.coolRate,
        estimated,
        gap,
        locked,
        ok: gap === 0 && !locked
      });
    }
  }
  return choices;
}

/** 发车前校验：返回错误文案，null 表示可以发车 */
export function canDispatch(
  order: DeliveryOrder,
  assignment: Assignment,
  station: Station,
  vehicles: Vehicle[],
  orders: DeliveryOrder[]
): string | null {
  if (order.status !== "pending") return "该订单不在待排状态";
  const vehicle = vehicles.find((item) => item.id === assignment.vehicleId);
  if (!vehicle) return "车辆不存在";
  const bay = vehicle.bays.find((item) => item.id === assignment.bayId);
  if (!bay) return "分仓不存在";
  if (isBayLocked(orders, assignment.vehicleId, assignment.bayId, assignment.slot, order.id)) {
    return `「${vehicle.plate} · ${bay.name} · ${assignment.slot}」已被在途订单锁定`;
  }
  const estimated = estimateArrivalTemp(order.loadTemp, bay.coolRate, order.mileage);
  const gap = gapDegrees(estimated, station.minTemp);
  if (gap > 0) {
    return `估算到站油温 ${estimated}℃，低于 ${station.name} 接收要求 ${station.minTemp}℃，缺 ${gap}℃`;
  }
  return null;
}
