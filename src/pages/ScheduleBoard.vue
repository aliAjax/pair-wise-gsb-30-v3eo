<script setup lang="ts">
// 页面：低温保温排程台
import { computed, ref } from "vue";
import { useDispatchStore } from "../store/dispatch";
import { STATUS_LABEL, slotLabel } from "../domain/thermal";
import type { DeliveryOrder } from "../types";
import { fmt1, fmtDateTime } from "../utils";
import DispatchDialog from "../components/DispatchDialog.vue";
import UnloadDialog from "../components/UnloadDialog.vue";

const store = useDispatchStore();

const dialogOrder = ref<DeliveryOrder | null>(null);
const dialogMode = ref<"dispatch" | "reassign">("dispatch");
const unloadOrder = ref<DeliveryOrder | null>(null);

function openDispatch(order: DeliveryOrder) {
  dialogMode.value = "dispatch";
  dialogOrder.value = order;
}
function openReassign(order: DeliveryOrder) {
  dialogMode.value = "reassign";
  dialogOrder.value = order;
}

function siteName(order: DeliveryOrder) {
  return store.getSite(order.siteId)?.name ?? "未知站点";
}
function vehiclePlate(order: DeliveryOrder) {
  const a = order.assignment;
  return a ? store.getVehicle(a.vehicleId)?.plate ?? "—" : "";
}
function bayName(order: DeliveryOrder) {
  const a = order.assignment;
  return a ? store.getBay(a.vehicleId, a.bayId)?.name ?? "—" : "";
}
function checkVehiclePlate(order: DeliveryOrder) {
  const c = order.lastCheck;
  return c ? store.getVehicle(c.vehicleId)?.plate ?? "—" : "";
}
function checkBayName(order: DeliveryOrder) {
  const c = order.lastCheck;
  return c ? store.getBay(c.vehicleId, c.bayId)?.name ?? "—" : "";
}
function hasOpenDisposition(order: DeliveryOrder) {
  return store.dispositions.some((d) => d.orderId === order.id && d.status !== "closed");
}

function estTempClass(order: DeliveryOrder) {
  const site = store.getSite(order.siteId);
  const est = order.assignment?.estTemp;
  return site && typeof est === "number" && est < site.minTemp ? "cold-text" : "";
}

const metrics = computed(() => [
  { label: "待排", value: store.pendingOrders.length },
  { label: "在途（分仓时段锁定中）", value: store.inTransitOrders.length },
  { label: "未闭环处置单", value: store.openDispositions.length },
]);
</script>

<template>
  <div>
    <section class="metrics">
      <article v-for="m in metrics" :key="m.label" class="metric">
        <span>{{ m.label }}</span>
        <strong>{{ m.value }}</strong>
      </article>
    </section>

    <section class="rule-bar">
      <p>
        测算规则：到站油温 = 装车温度 − 分仓降温速度 ×（里程 ÷ 夜间均速）；低于站点最低接收温度则留待排并记录缺温。
      </p>
      <label class="speed-field">
        夜间均速（km/h）
        <input v-model.number="store.speed" type="number" min="1" step="1" />
      </label>
    </section>

    <section class="board">
      <!-- 待排 -->
      <div class="column">
        <header class="column-head pending">
          <h2>待排</h2>
          <span>{{ store.pendingOrders.length }}</span>
        </header>
        <p v-if="store.pendingOrders.length === 0" class="empty">暂无待排配送单</p>
        <article v-for="order in store.pendingOrders" :key="order.id" class="card">
          <div class="card-head">
            <strong>{{ order.code }}</strong>
            <span class="pill pending-pill">{{ STATUS_LABEL[order.status] }}</span>
          </div>
          <p class="card-line">{{ siteName(order) }} · {{ order.fuel }} · {{ order.tons }}吨</p>
          <div class="kv">
            <span>装车温度 <b>{{ order.loadTemp }}℃</b></span>
            <span>里程 <b>{{ order.mileage }}km</b></span>
            <span>接收线 <b>{{ store.getSite(order.siteId)?.minTemp ?? "—" }}℃</b></span>
          </div>
          <div v-if="order.lastCheck" class="check-line cold-bg">
            <template v-if="order.lastCheck.short > 0">
              最近测算 {{ checkVehiclePlate(order) }}/{{ checkBayName(order) }} ·
              {{ slotLabel(order.lastCheck.slotId) }} → 预计 {{ fmt1(order.lastCheck.estTemp) }}℃，
              <b class="cold-text">缺 {{ fmt1(order.lastCheck.short) }}℃，留待排</b>
            </template>
            <template v-else>
              最近测算 {{ checkVehiclePlate(order) }}/{{ checkBayName(order) }} → 预计
              {{ fmt1(order.lastCheck.estTemp) }}℃，温度达标
            </template>
            <span class="check-time">{{ fmtDateTime(order.lastCheck.checkedAt) }}</span>
          </div>
          <p v-else class="note-line">尚未测算，点击排车选择车辆分仓</p>
          <p v-if="order.notes" class="note-line remark">{{ order.notes }}</p>
          <div class="actions">
            <button type="button" @click="openDispatch(order)">排车测算</button>
            <button class="danger" type="button" @click="store.removeOrder(order.id)">删除</button>
          </div>
        </article>
      </div>

      <!-- 在途 -->
      <div class="column">
        <header class="column-head transit">
          <h2>在途</h2>
          <span>{{ store.inTransitOrders.length }}</span>
        </header>
        <p v-if="store.inTransitOrders.length === 0" class="empty">暂无在途车辆</p>
        <article v-for="order in store.inTransitOrders" :key="order.id" class="card">
          <div class="card-head">
            <strong>{{ order.code }}</strong>
            <span class="pill transit-pill">{{ STATUS_LABEL[order.status] }} · 已锁定</span>
          </div>
          <p class="card-line">{{ siteName(order) }} · {{ order.fuel }} · {{ order.tons }}吨</p>
          <div class="kv">
            <span>车/仓 <b>{{ vehiclePlate(order) }} / {{ bayName(order) }}</b></span>
            <span>时段 <b>{{ order.assignment?.date }} {{ slotLabel(order.assignment?.slotId ?? "") }}</b></span>
            <span>预计到站 <b :class="estTempClass(order)">{{ fmt1(order.assignment?.estTemp ?? NaN) }}℃</b></span>
          </div>
          <p v-if="order.notes" class="note-line remark">{{ order.notes }}</p>
          <div class="actions">
            <button type="button" @click="unloadOrder = order">卸油回填</button>
            <button class="secondary" type="button" @click="openReassign(order)">改派</button>
          </div>
        </article>
      </div>

      <!-- 已卸 -->
      <div class="column">
        <header class="column-head done">
          <h2>已卸</h2>
          <span>{{ store.doneOrders.length }}</span>
        </header>
        <p v-if="store.doneOrders.length === 0" class="empty">暂无已完成配送单</p>
        <article v-for="order in store.doneOrders" :key="order.id" class="card" :class="{ abnormal: order.arrival?.abnormal }">
          <div class="card-head">
            <strong>{{ order.code }}</strong>
            <span v-if="order.arrival?.abnormal" class="pill danger-pill">
              异常缺{{ fmt1(order.arrival.short) }}℃{{ hasOpenDisposition(order) ? " · 处置中" : " · 已闭环" }}
            </span>
            <span v-else class="pill done-pill">{{ STATUS_LABEL[order.status] }}</span>
          </div>
          <p class="card-line">{{ siteName(order) }} · {{ order.fuel }} · {{ order.tons }}吨</p>
          <div class="kv">
            <span>车/仓 <b>{{ vehiclePlate(order) }} / {{ bayName(order) }}</b></span>
            <span>预计到站 <b>{{ fmt1(order.assignment?.estTemp ?? NaN) }}℃</b></span>
            <span>实测 <b :class="order.arrival?.abnormal ? 'cold-text' : 'ok-text'">{{ fmt1(order.arrival?.temp ?? NaN) }}℃</b></span>
          </div>
          <p class="note-line">卸油时间：{{ fmtDateTime(order.arrival?.at ?? "") }}</p>
        </article>
      </div>
    </section>

    <DispatchDialog v-if="dialogOrder" :order="dialogOrder" :mode="dialogMode" @close="dialogOrder = null" />
    <UnloadDialog v-if="unloadOrder" :order="unloadOrder" @close="unloadOrder = null" />
  </div>
</template>
