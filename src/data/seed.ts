// 资料层：首次打开时的演示数据（冬季夜间送油场景）
import type { PersistShape } from "../types";
import { dateStr, uid } from "../utils";

export const STORAGE_KEY = "hxwlfront-19-low-temp-dispatch-v1";
export const DATA_VERSION = 1;
export const FUELS = ["92号汽油", "95号汽油", "0号柴油", "-10号柴油", "-35号柴油"];
export const DEFAULT_SPEED = 45;

export function buildSeed(now: string = new Date().toISOString(), day: string = dateStr()): PersistShape {
  const v1 = uid();
  const v2 = uid();
  const b11 = uid();
  const b12 = uid();
  const b21 = uid();
  const b22 = uid();
  const s1 = uid();
  const s2 = uid();
  const s3 = uid();
  const o1 = uid();
  const o2 = uid();
  const o3 = uid();
  const d1 = uid();

  // 车辆：分仓降温速度越低，保温越好
  const vehicles = [
    {
      id: v1,
      plate: "鲁B·7M215",
      driver: "张师傅",
      bays: [
        { id: b11, name: "保温一仓", capacity: 16, coolRate: 0.6 },
        { id: b12, name: "普通二仓", capacity: 14, coolRate: 1.1 },
      ],
    },
    {
      id: v2,
      plate: "鲁B·9K806",
      driver: "李师傅",
      bays: [
        { id: b21, name: "保温一仓", capacity: 20, coolRate: 0.5 },
        { id: b22, name: "普通二仓", capacity: 12, coolRate: 1.4 },
      ],
    },
  ];

  const sites = [
    { id: s1, name: "城东站", minTemp: 4 },
    { id: s2, name: "机场站", minTemp: 5 },
    { id: s3, name: "新区站", minTemp: 3 },
  ];

  const orders = [
    // 在途：机场站 -10号柴油，120km，v2保温仓 0.5℃/h
    //   行驶 120/45≈2.7h，预计到站 18-0.5*2.7≈16.7℃，今晚夜二班锁定
    {
      id: o1,
      code: "PS-260926-002",
      siteId: s2,
      fuel: "-10号柴油",
      tons: 18,
      loadTemp: 18,
      mileage: 120,
      notes: "夜班首单，机场站要求5℃以上",
      createdAt: now,
      status: "inTransit" as const,
      assignment: {
        vehicleId: v2,
        bayId: b21,
        date: day,
        slotId: "slot-22",
        estHours: 120 / DEFAULT_SPEED,
        estTemp: 18 - 0.5 * (120 / DEFAULT_SPEED),
        dispatchedAt: now,
      },
    },
    // 待排：城东站 92号汽油，90km（2h），装车温度仅5℃、接收线4℃
    //   v2保温一仓 0.5℃/h → 4.0℃ 勉强达标（但今晚夜二班已被002锁定）
    //   v1保温一仓 0.6℃/h → 3.8℃，缺0.2℃；普通仓更不达标
    {
      id: o2,
      code: "PS-260926-003",
      siteId: s1,
      fuel: "92号汽油",
      tons: 10,
      loadTemp: 5,
      mileage: 90,
      notes: "装车温度偏低，需选保温仓并避开锁定时段",
      createdAt: now,
      status: "pending" as const,
    },
    // 待排：新区站 0号柴油，210km（4.7h），装车4℃、接收线3℃
    //   最好的 v2保温一仓 0.5℃/h → 约1.7℃，缺约1.3℃，所有分仓均不达标
    {
      id: o3,
      code: "PS-260926-004",
      siteId: s3,
      fuel: "0号柴油",
      tons: 12,
      loadTemp: 4,
      mileage: 210,
      notes: "远郊长途，预估缺温，需提温或换保温车",
      createdAt: now,
      status: "pending" as const,
    },
    // 已卸异常：v1普通二仓，预计4.3℃勉强达标，实测仅3.2℃（途中堵车降温超预期）
    {
      id: uid(),
      code: "PS-260925-001",
      siteId: s1,
      fuel: "0号柴油",
      tons: 14,
      loadTemp: 7,
      mileage: 110,
      notes: "到站油温偏低",
      createdAt: now,
      status: "done" as const,
      assignment: {
        vehicleId: v1,
        bayId: b12,
        date: day,
        slotId: "slot-02",
        estHours: 110 / DEFAULT_SPEED,
        estTemp: 7 - 1.1 * (110 / DEFAULT_SPEED),
        dispatchedAt: now,
      },
      arrival: {
        temp: 3.2,
        at: now,
        abnormal: true,
        short: 0.8,
      },
    },
  ];

  const dispositions = [
    {
      id: d1,
      orderId: orders[3].id,
      code: "PS-260925-001",
      siteName: "城东站",
      fuel: "0号柴油",
      plate: "鲁B·7M215",
      bayName: "普通二仓",
      measuredTemp: 3.2,
      minTemp: 4,
      short: 0.8,
      createdAt: now,
      action: "现场协调：先做沉降化验，合格后减量接收并加热循环，不合格原路返库。",
      handler: "调度-王磊",
      status: "handling" as const,
    },
  ];

  return {
    version: DATA_VERSION,
    vehicles,
    sites,
    orders,
    dispositions,
    settings: { speed: DEFAULT_SPEED },
  };
}
