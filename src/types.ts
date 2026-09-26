// 资料层：低温保温排程台的领域模型

/** 站点（油站）资料 */
export interface Site {
  id: string;
  name: string;
  /** 最低接收温度 ℃ */
  minTemp: number;
}

/** 车辆分仓：一台油罐车挂多个仓，各仓保温能力不同 */
export interface Bay {
  id: string;
  /** 仓名，如 1号保温仓 */
  name: string;
  /** 额定仓容（吨） */
  capacity: number;
  /** 降温速度 ℃/小时 */
  coolRate: number;
}

/** 车辆资料 */
export interface Vehicle {
  id: string;
  /** 车牌号 */
  plate: string;
  /** 司机 */
  driver: string;
  bays: Bay[];
}

export type OrderStatus = "pending" | "inTransit" | "done";

/** 一次排车选择（车辆 + 分仓 + 发车日期 + 夜间时段） */
export interface Selection {
  vehicleId: string;
  bayId: string;
  /** YYYY-MM-DD */
  date: string;
  slotId: string;
}

/** 发车后锁定的排程 */
export interface Assignment extends Selection {
  /** 预计行驶小时数 */
  estHours: number;
  /** 预计到站油温 ℃ */
  estTemp: number;
  /** 实际发车时间 ISO */
  dispatchedAt: string;
}

/** 留在待排单上的最近一次测算结果（含缺几度） */
export interface TempCheck extends Selection {
  estHours: number;
  estTemp: number;
  /** 低于接收线的度数，0 表示达标 */
  short: number;
  checkedAt: string;
}

/** 卸油回填的实测结果 */
export interface ArrivalInfo {
  /** 实测到站油温 ℃ */
  temp: number;
  /** 卸油时间 ISO */
  at: string;
  abnormal: boolean;
  /** 缺温度数 */
  short: number;
}

/** 配送单 */
export interface DeliveryOrder {
  id: string;
  /** 配送单号 */
  code: string;
  siteId: string;
  /** 油品 */
  fuel: string;
  /** 配送吨数 */
  tons: number;
  /** 装车温度 ℃ */
  loadTemp: number;
  /** 里程 km */
  mileage: number;
  notes: string;
  createdAt: string;
  status: OrderStatus;
  /** 发车后的锁定排程 */
  assignment?: Assignment;
  /** 卸油回填 */
  arrival?: ArrivalInfo;
  /** 最近一次留在待排单上的测算 */
  lastCheck?: TempCheck;
}

export type DispositionStatus = "open" | "handling" | "closed";

/** 异常处置单：实测油温跌破站点接收线时自动生成 */
export interface Disposition {
  id: string;
  orderId: string;
  /** 配送单号 */
  code: string;
  siteName: string;
  fuel: string;
  plate: string;
  bayName: string;
  /** 实测温度 ℃ */
  measuredTemp: number;
  /** 站点最低接收温度 ℃ */
  minTemp: number;
  /** 缺温度数 */
  short: number;
  createdAt: string;
  /** 处置措施 */
  action: string;
  /** 处理人 */
  handler: string;
  status: DispositionStatus;
}

export interface Settings {
  /** 夜间路况平均车速 km/h，里程/均速 = 行驶小时数 */
  speed: number;
}

/** localStorage 落盘结构 */
export interface PersistShape {
  version: number;
  vehicles: Vehicle[];
  sites: Site[];
  orders: DeliveryOrder[];
  dispositions: Disposition[];
  settings: Settings;
}
