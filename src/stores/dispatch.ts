// 状态编排层：登记 / 排车 / 改派 / 卸油 / 处置，所有变更经保存层落盘
import { computed, reactive, watch } from "vue";
import { defineStore } from "pinia";
import type { DeliveryOrder, DisposalOrder, Station, Vehicle } from "../types";
import { bayOptionsFor, canDispatch, gapDegrees } from "../domain/schedule";
import type { BayChoice } from "../domain/schedule";
import { loadDb, saveDb } from "../data/repository";

export interface NewVehicleInput {
  plate: string;
  driver: string;
  bays: { name: string; coolRate: number }[];
}

export interface NewOrderInput {
  fuel: string;
  tons: number;
  stationId: string;
  loadTemp: number;
  mileage: number;
  notes: string;
}

export const useDispatchStore = defineStore("cold-dispatch", () => {
  const db = reactive(loadDb());

  // 任何变更自动落盘：重开页面仍能看到待排、在途和处置单
  watch(db, (value) => saveDb(JSON.parse(JSON.stringify(value))), { deep: true });

  const vehicles = computed<Vehicle[]>(() => db.vehicles);
  const stations = computed<Station[]>(() => db.stations);
  const orders = computed<DeliveryOrder[]>(() => db.orders);
  const disposals = computed<DisposalOrder[]>(() => db.disposals);

  // 司机按里程排车：待排单里程从近到远
  const pendingOrders = computed(() =>
    db.orders.filter((order) => order.status === "pending").sort((a, b) => a.mileage - b.mileage)
  );
  const inTransitOrders = computed(() => db.orders.filter((order) => order.status === "inTransit"));
  const doneOrders = computed(() => db.orders.filter((order) => order.status === "done"));
  const openDisposals = computed(() => db.disposals.filter((item) => !item.handled));

  const metrics = computed(() => ({
    pending: pendingOrders.value.length,
    inTransit: inTransitOrders.value.length,
    done: doneOrders.value.length,
    disposals: openDisposals.value.length,
    bays: db.vehicles.reduce((sum, vehicle) => sum + vehicle.bays.length, 0)
  }));

  function stationOf(order: DeliveryOrder): Station | undefined {
    return db.stations.find((station) => station.id === order.stationId);
  }

  function vehicleOf(id: string): Vehicle | undefined {
    return db.vehicles.find((vehicle) => vehicle.id === id);
  }

  function choicesFor(order: DeliveryOrder, slot: string): BayChoice[] {
    const station = stationOf(order);
    if (!station) return [];
    return bayOptionsFor(order, station, db.vehicles, db.orders, slot);
  }

  // ---------- 登记 ----------
  function addVehicle(input: NewVehicleInput): void {
    db.vehicles.push({
      id: crypto.randomUUID(),
      plate: input.plate,
      driver: input.driver,
      bays: input.bays.map((bay) => ({ id: crypto.randomUUID(), name: bay.name, coolRate: bay.coolRate }))
    });
  }

  function removeVehicle(id: string): string | null {
    const inUse = db.orders.some(
      (order) => order.status === "inTransit" && order.assignment?.vehicleId === id
    );
    if (inUse) return "该车有在途单锁定分仓，不能删除";
    db.vehicles = db.vehicles.filter((vehicle) => vehicle.id !== id);
    return null;
  }

  function addStation(name: string, minTemp: number): void {
    db.stations.push({ id: crypto.randomUUID(), name, minTemp });
  }

  function removeStation(id: string): string | null {
    if (db.orders.some((order) => order.status !== "done" && order.stationId === id)) {
      return "该站点有待排或在途配送单，不能删除";
    }
    db.stations = db.stations.filter((station) => station.id !== id);
    return null;
  }

  function addOrder(input: NewOrderInput): void {
    db.orderSeq += 1;
    db.orders.unshift({
      id: crypto.randomUUID(),
      code: `PS-${String(db.orderSeq).padStart(4, "0")}`,
      fuel: input.fuel,
      tons: input.tons,
      stationId: input.stationId,
      loadTemp: input.loadTemp,
      mileage: input.mileage,
      notes: input.notes || "暂无备注",
      status: "pending",
      assignment: null,
      unload: null,
      releases: [],
      createdAt: new Date().toISOString()
    });
  }

  function removeOrder(id: string): string | null {
    const order = db.orders.find((item) => item.id === id);
    if (order?.status === "inTransit") return "在途单已锁定，需先卸油或改派释放";
    db.orders = db.orders.filter((item) => item.id !== id);
    return null;
  }

  // ---------- 排车：估算达标才允许发车，发车即锁定分仓与时段 ----------
  function dispatchOrder(orderId: string, vehicleId: string, bayId: string, slot: string): string | null {
    const order = db.orders.find((item) => item.id === orderId);
    const vehicle = db.vehicles.find((item) => item.id === vehicleId);
    const bay = vehicle?.bays.find((item) => item.id === bayId);
    const station = order ? stationOf(order) : undefined;
    if (!order || !vehicle || !bay || !station) return "资料不完整，无法排车";

    const error = canDispatch(
      order,
      { vehicleId, bayId, slot, dispatchedAt: new Date().toISOString() },
      station,
      db.vehicles,
      db.orders
    );
    if (error) return error;

    order.assignment = { vehicleId, bayId, slot, dispatchedAt: new Date().toISOString() };
    order.status = "inTransit";
    return null;
  }

  // ---------- 改派：先释放原车分仓与时段，订单回到待排 ----------
  function releaseForReassign(orderId: string): string | null {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "inTransit" || !order.assignment) return "该订单不可改派";
    const vehicle = vehicleOf(order.assignment.vehicleId);
    const bay = vehicle?.bays.find((item) => item.id === order.assignment?.bayId);
    order.releases.push({
      at: new Date().toISOString(),
      reason: `改派释放：${vehicle?.plate ?? ""} · ${bay?.name ?? ""} · ${order.assignment.slot}`
    });
    order.assignment = null;
    order.status = "pending";
    return null;
  }

  // ---------- 卸油回填实测温度，低于接收线自动生成处置单 ----------
  function unloadOrder(orderId: string, actualTemp: number): string | null {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "inTransit" || !order.assignment) return "订单不在在途状态";
    const station = stationOf(order);
    const vehicle = vehicleOf(order.assignment.vehicleId);
    const bay = vehicle?.bays.find((item) => item.id === order.assignment?.bayId);
    if (!station || !vehicle || !bay) return "关联资料缺失，无法回填";

    const gap = gapDegrees(actualTemp, station.minTemp);
    const abnormal = gap > 0;
    order.unload = { actualTemp, unloadedAt: new Date().toISOString(), abnormal };
    order.status = "done";
    order.releases.push({
      at: new Date().toISOString(),
      reason: `卸油释放：${vehicle.plate} · ${bay.name} · ${order.assignment.slot}`
    });
    order.assignment = null;

    if (abnormal) {
      const seq = db.disposals.length + 1;
      db.disposals.unshift({
        id: crypto.randomUUID(),
        code: `CL-${String(seq).padStart(4, "0")}`,
        orderId: order.id,
        orderCode: order.code,
        stationId: station.id,
        stationName: station.name,
        vehiclePlate: vehicle.plate,
        bayName: bay.name,
        actualTemp,
        minTemp: station.minTemp,
        gap,
        measure: "",
        handled: false,
        createdAt: new Date().toISOString()
      });
    }
    return null;
  }

  function resolveDisposal(id: string, measure: string): string | null {
    const item = db.disposals.find((entry) => entry.id === id);
    if (!item) return "处置单不存在";
    if (!measure.trim()) return "请填写处置说明";
    item.measure = measure.trim();
    item.handled = true;
    return null;
  }

  return {
    db,
    vehicles,
    stations,
    orders,
    disposals,
    pendingOrders,
    inTransitOrders,
    doneOrders,
    openDisposals,
    metrics,
    stationOf,
    vehicleOf,
    choicesFor,
    addVehicle,
    removeVehicle,
    addStation,
    removeStation,
    addOrder,
    removeOrder,
    dispatchOrder,
    releaseForReassign,
    unloadOrder,
    resolveDisposal
  };
});
