// 资料层：低温保温排程台的领域模型（车辆分仓 / 站点 / 配送单 / 处置单）

export const FUELS = ["92号汽油", "95号汽油", "0号柴油", "-10号柴油"] as const;
export type Fuel = (typeof FUELS)[number];

/** 车辆分仓：不同分仓保温能力不同，降温速度单位 ℃/小时 */
export interface Bay {
  id: string;
  name: string;
  coolRate: number;
}

export interface Vehicle {
  id: string;
  plate: string;
  driver: string;
  bays: Bay[];
}

/** 站点：登记最低接收温度 */
export interface Station {
  id: string;
  name: string;
  minTemp: number;
}

export type OrderStatus = "pending" | "inTransit" | "done";

/** 发车后锁定的排车结果：分仓 + 夜间时段 */
export interface Assignment {
  vehicleId: string;
  bayId: string;
  slot: string;
  dispatchedAt: string;
}

/** 锁定释放记录：改派、卸油都会释放原车分仓时段 */
export interface ReleaseRecord {
  at: string;
  reason: string;
}

export interface UnloadRecord {
  actualTemp: number;
  unloadedAt: string;
  abnormal: boolean;
}

export interface DeliveryOrder {
  id: string;
  code: string;
  fuel: string;
  tons: number;
  stationId: string;
  /** 装车温度 ℃ */
  loadTemp: number;
  /** 里程 km */
  mileage: number;
  notes: string;
  status: OrderStatus;
  assignment: Assignment | null;
  unload: UnloadRecord | null;
  releases: ReleaseRecord[];
  createdAt: string;
}

/** 异常处置单：卸油实测温度跌破站点接收要求时生成 */
export interface DisposalOrder {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  stationId: string;
  stationName: string;
  vehiclePlate: string;
  bayName: string;
  actualTemp: number;
  minTemp: number;
  gap: number;
  measure: string;
  handled: boolean;
  createdAt: string;
}
