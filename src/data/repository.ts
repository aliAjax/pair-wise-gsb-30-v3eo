// 保存层：localStorage 持久化与首次种子数据
import type { DeliveryOrder, DisposalOrder, Station, Vehicle } from "../types";

export const STORAGE_KEY = "hxwlfront-19-cold-dispatch";

export interface Db {
  vehicles: Vehicle[];
  stations: Station[];
  orders: DeliveryOrder[];
  disposals: DisposalOrder[];
  /** 配送单编号序号，保证重开后编号不重复 */
  orderSeq: number;
}

function seed(): Db {
  const now = Date.now();
  const iso = (offsetHours: number) => new Date(now - offsetHours * 3600000).toISOString();
  return {
    orderSeq: 4,
    vehicles: [
      {
        id: "v1",
        plate: "黑A·D8821",
        driver: "王建国",
        bays: [
          { id: "v1-b1", name: "1号保温仓", coolRate: 0.4 },
          { id: "v1-b2", name: "2号普通仓", coolRate: 1.1 }
        ]
      },
      {
        id: "v2",
        plate: "吉C·T5560",
        driver: "李长顺",
        bays: [
          { id: "v2-b1", name: "前仓", coolRate: 0.7 },
          { id: "v2-b2", name: "后仓", coolRate: 0.9 }
        ]
      },
      {
        id: "v3",
        plate: "辽B·K3107",
        driver: "赵立冬",
        bays: [{ id: "v3-b1", name: "单仓", coolRate: 1.4 }]
      }
    ],
    stations: [
      { id: "s1", name: "城东站", minTemp: 5 },
      { id: "s2", name: "机场站", minTemp: 8 },
      { id: "s3", name: "新区站", minTemp: 3 }
    ],
    orders: [
      {
        id: "o1",
        code: "PS-0001",
        fuel: "0号柴油",
        tons: 18,
        stationId: "s1",
        loadTemp: 12,
        mileage: 120,
        notes: "夜间路滑，到站先测罐口温度",
        status: "pending",
        assignment: null,
        unload: null,
        releases: [],
        createdAt: iso(6)
      },
      {
        id: "o2",
        code: "PS-0002",
        fuel: "95号汽油",
        tons: 12,
        stationId: "s2",
        loadTemp: 10,
        mileage: 210,
        notes: "远途单，优先保温仓",
        status: "pending",
        assignment: null,
        unload: null,
        releases: [],
        createdAt: iso(5)
      },
      {
        id: "o3",
        code: "PS-0003",
        fuel: "-10号柴油",
        tons: 20,
        stationId: "s3",
        loadTemp: 6,
        mileage: 60,
        notes: "低凝点油品，短驳",
        status: "pending",
        assignment: null,
        unload: null,
        releases: [],
        createdAt: iso(4)
      },
      {
        id: "o4",
        code: "PS-0004",
        fuel: "92号汽油",
        tons: 15,
        stationId: "s1",
        loadTemp: 14,
        mileage: 90,
        notes: "已发车，预计 2 小时到站",
        status: "inTransit",
        assignment: { vehicleId: "v2", bayId: "v2-b1", slot: "20:00-22:00", dispatchedAt: iso(1) },
        unload: null,
        releases: [],
        createdAt: iso(8)
      }
    ],
    disposals: [
      {
        id: "d1",
        code: "CL-0001",
        orderId: "o0",
        orderCode: "PS-0000",
        stationId: "s2",
        stationName: "机场站",
        vehiclePlate: "辽B·K3107",
        bayName: "单仓",
        actualTemp: 6.5,
        minTemp: 8,
        gap: 1.5,
        measure: "到站实测低于接收线，站方暂收一半，余油回库加热后明日补送。",
        handled: false,
        createdAt: iso(20)
      }
    ]
  };
}

export function loadDb(): Db {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seed();
  try {
    const parsed = JSON.parse(raw) as Partial<Db>;
    return {
      vehicles: parsed.vehicles ?? [],
      stations: parsed.stations ?? [],
      orders: parsed.orders ?? [],
      disposals: parsed.disposals ?? [],
      orderSeq: parsed.orderSeq ?? (parsed.orders?.length ?? 0) + 1
    };
  } catch {
    return seed();
  }
}

export function saveDb(db: Db): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
