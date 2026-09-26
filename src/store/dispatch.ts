// 保存层 + 应用动作：Pinia 统一管理资料、配送单、处置单，任何变更自动落盘
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type {
  Bay,
  DeliveryOrder,
  Disposition,
  PersistShape,
  Selection,
  Site,
  Vehicle,
} from "../types";
import { loadState, saveState } from "./persistence";
import { evaluate, lockKey } from "../domain/thermal";
import { uid } from "../utils";
import { FUELS } from "../data/seed";

const initial = loadState();

export const useDispatchStore = defineStore("lowTempDispatch", () => {
  // ---- 资料 ----
  const vehicles = ref<Vehicle[]>(initial.vehicles);
  const sites = ref<Site[]>(initial.sites);

  // ---- 单据 ----
  const orders = ref<DeliveryOrder[]>(initial.orders);
  const dispositions = ref<Disposition[]>(initial.dispositions);

  // ---- 设置 ----
  const speed = ref<number>(initial.settings.speed || 45);

  const fuels = FUELS;

  // 任意变化都写回 localStorage，重开即可看到待排、在途、处置
  watch(
    [vehicles, sites, orders, dispositions, speed],
    () => {
      const snapshot: PersistShape = {
        version: initial.version,
        vehicles: vehicles.value,
        sites: sites.value,
        orders: orders.value,
        dispositions: dispositions.value,
        settings: { speed: speed.value },
      };
      saveState(snapshot);
    },
    { deep: true }
  );

  // ---- 查询辅助 ----
  function getSite(id: string): Site | undefined {
    return sites.value.find((s) => s.id === id);
  }
  function getVehicle(id: string): Vehicle | undefined {
    return vehicles.value.find((v) => v.id === id);
  }
  function getBay(vehicleId: string, bayId: string): Bay | undefined {
    return getVehicle(vehicleId)?.bays.find((b) => b.id === bayId);
  }
  function getOrder(id: string): DeliveryOrder | undefined {
    return orders.value.find((o) => o.id === id);
  }

  const pendingOrders = computed(() =>
    orders.value.filter((o) => o.status === "pending")
  );
  const inTransitOrders = computed(() =>
    orders.value.filter((o) => o.status === "inTransit")
  );
  const doneOrders = computed(() =>
    orders.value.filter((o) => o.status === "done")
  );
  const openDispositions = computed(() =>
    dispositions.value.filter((d) => d.status !== "closed")
  );

  /** 当前锁定集合，供资料页展示 */
  const lockKeys = computed(() => {
    const set = new Set<string>();
    for (const order of inTransitOrders.value) {
      if (order.assignment) set.add(lockKey(order.assignment));
    }
    return set;
  });

  function isBayLocked(vehicleId: string, bayId: string, date: string, slotId: string): boolean {
    return lockKeys.value.has(lockKey({ vehicleId, bayId, date, slotId }));
  }

  // ---- 判断：对某个单 + 某个排车选择做油温测算 ----
  function assess(orderId: string, selection: Selection) {
    const order = getOrder(orderId);
    const site = order ? getSite(order.siteId) : undefined;
    if (!order || !site) {
      return undefined;
    }
    return evaluate({
      ...selection,
      orders: orders.value,
      vehicles: vehicles.value,
      selfOrderId: order.status === "inTransit" ? order.id : undefined,
      loadTemp: order.loadTemp,
      mileage: order.mileage,
      tons: order.tons,
      minTemp: site.minTemp,
      speed: speed.value,
    });
  }

  // ---- 配送单登记 ----
  function addOrder(input: {
    siteId: string;
    fuel: string;
    tons: number;
    loadTemp: number;
    mileage: number;
    notes: string;
  }): DeliveryOrder {
    const stamp = new Date();
    const yy = String(stamp.getFullYear()).slice(2);
    const seq = String(orders.value.length + 1).padStart(3, "0");
    const order: DeliveryOrder = {
      id: uid(),
      code: `PS-${yy}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(
        stamp.getDate()
      ).padStart(2, "0")}-${seq}`,
      ...input,
      createdAt: stamp.toISOString(),
      status: "pending",
    };
    orders.value.unshift(order);
    return order;
  }

  function removeOrder(id: string): string | undefined {
    const order = getOrder(id);
    if (order?.status === "inTransit") {
      return "在途单不能直接删除，请先改派或完成卸油";
    }
    orders.value = orders.value.filter((o) => o.id !== id);
    return undefined;
  }

  /** 留在待排：记录最近一次测算（含缺几度），单仍不动 */
  function saveCheck(orderId: string, selection: Selection): void {
    const result = assess(orderId, selection);
    const order = getOrder(orderId);
    if (!result || !order) return;
    order.lastCheck = {
      ...selection,
      estHours: result.estHours,
      estTemp: result.estTemp,
      short: result.short,
      checkedAt: new Date().toISOString(),
    };
  }

  // ---- 发车：锁定分仓与时段，单转在途 ----
  function dispatch(orderId: string, selection: Selection): string | undefined {
    const result = assess(orderId, selection);
    const order = getOrder(orderId);
    if (!result || !order) return "配送单不存在";
    if (result.vehicleMissing) return "请选择车辆与分仓";
    if (result.locked) return "该分仓此时段已被其他在途单锁定";
    if (result.tooSmall) return "分仓仓容不足，无法装下本单吨数";
    if (result.short > 0) return `预计缺温${result.short.toFixed(1)}℃，请留在待排，禁止发车`;

    order.assignment = {
      ...selection,
      estHours: result.estHours,
      estTemp: result.estTemp,
      dispatchedAt: new Date().toISOString(),
    };
    order.status = "inTransit";
    order.lastCheck = undefined;
    return undefined;
  }

    // 改派：先释放原车原仓原时段，再锁新车新时段（同一事务内完成）
  function reassign(orderId: string, selection: Selection): string | undefined {
    const order = getOrder(orderId);
    if (!order) return "配送单不存在";
    if (order.status !== "inTransit") return "只有在途单可以改派";

    const result = assess(orderId, selection);
    if (!result) return "测算失败";
    if (result.vehicleMissing) return "请选择车辆与分仓";
    if (result.locked) return "目标分仓此时段已被其他在途单锁定";
    if (result.tooSmall) return "目标分仓仓容不足";
    if (result.short > 0) return `预计缺温${result.short.toFixed(1)}℃，不能改派过去`;

    // assess 已用 selfOrderId 排除本单，直接覆写即“释放原车 + 锁定新车”
    order.assignment = {
      ...selection,
      estHours: result.estHours,
      estTemp: result.estTemp,
      dispatchedAt: new Date().toISOString(),
    };
    return undefined;
  }

  // ---- 卸油回填：实测温度低于站点线则自动生成处置单 ----
  function unload(
    orderId: string,
    measuredTemp: number
  ): { dispositionId?: string; error?: string } {
    const order = getOrder(orderId);
    if (!order) return { error: "配送单不存在" };
    if (order.status !== "inTransit") return { error: "只有在途单可以卸油回填" };
    const site = getSite(order.siteId);
    if (!site) return { error: "站点资料缺失" };

    const short = Math.max(0, site.minTemp - measuredTemp);
    const abnormal = short > 0;
    order.arrival = {
      temp: measuredTemp,
      at: new Date().toISOString(),
      abnormal,
      short,
    };
    // 卸油完成，分仓与时段锁定随之释放
    order.status = "done";

    if (abnormal) {
      const assignment = order.assignment;
      const vehicle = assignment ? getVehicle(assignment.vehicleId) : undefined;
      const bay = assignment
        ? getBay(assignment.vehicleId, assignment.bayId)
        : undefined;
      const disposition: Disposition = {
        id: uid(),
        orderId: order.id,
        code: order.code,
        siteName: site.name,
        fuel: order.fuel,
        plate: vehicle?.plate ?? "—",
        bayName: bay?.name ?? "—",
        measuredTemp,
        minTemp: site.minTemp,
        short,
        createdAt: new Date().toISOString(),
        action: "",
        handler: "",
        status: "open",
      };
      dispositions.value.unshift(disposition);
      return { dispositionId: disposition.id };
    }
    return {};
  }

  // ---- 处置单流转 ----
  function updateDisposition(
    id: string,
    patch: Partial<Pick<Disposition, "action" | "handler" | "status">>
  ): void {
    const item = dispositions.value.find((d) => d.id === id);
    if (!item) return;
    Object.assign(item, patch);
  }

  // ---- 车辆登记（含分仓与降温速度） ----
  function addVehicle(input: { plate: string; driver: string }): Vehicle {
    const vehicle: Vehicle = { id: uid(), plate: input.plate, driver: input.driver, bays: [] };
    vehicles.value.push(vehicle);
    return vehicle;
  }
  function addBay(vehicleId: string, input: { name: string; capacity: number; coolRate: number }): void {
    getVehicle(vehicleId)?.bays.push({ id: uid(), ...input });
  }
  function removeBay(vehicleId: string, bayId: string): string | undefined {
    const inUse = inTransitOrders.value.some(
      (o) => o.assignment?.vehicleId === vehicleId && o.assignment?.bayId === bayId
    );
    if (inUse) return "该分仓正被在途单锁定，不能删除";
    const vehicle = getVehicle(vehicleId);
    if (vehicle) vehicle.bays = vehicle.bays.filter((b) => b.id !== bayId);
    return undefined;
  }
  function removeVehicle(vehicleId: string): string | undefined {
    const inUse = inTransitOrders.value.some((o) => o.assignment?.vehicleId === vehicleId);
    if (inUse) return "该车有在途单锁定，不能删除";
    vehicles.value = vehicles.value.filter((v) => v.id !== vehicleId);
    return undefined;
  }

  // ---- 站点登记（最低接收温度） ----
  function addSite(input: { name: string; minTemp: number }): void {
    sites.value.push({ id: uid(), ...input });
  }
  function updateSite(id: string, patch: Partial<Pick<Site, "name" | "minTemp">>): void {
    const site = getSite(id);
    if (site) Object.assign(site, patch);
  }
  function removeSite(id: string): string | undefined {
    if (orders.value.some((o) => o.siteId === id)) return "已有配送单引用该站点，不能删除";
    sites.value = sites.value.filter((s) => s.id !== id);
    return undefined;
  }

  return {
    // state
    vehicles,
    sites,
    orders,
    dispositions,
    speed,
    fuels,
    // getters
    pendingOrders,
    inTransitOrders,
    doneOrders,
    openDispositions,
    // helpers
    getSite,
    getVehicle,
    getBay,
    getOrder,
    assess,
    isBayLocked,
    // order actions
    addOrder,
    removeOrder,
    saveCheck,
    dispatch,
    reassign,
    unload,
    // dispositions
    updateDisposition,
    // vehicle actions
    addVehicle,
    addBay,
    removeBay,
    removeVehicle,
    // site actions
    addSite,
    updateSite,
    removeSite,
  };
});
