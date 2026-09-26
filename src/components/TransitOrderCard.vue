<script setup lang="ts">
import { computed, ref } from "vue";
import type { DeliveryOrder } from "../types";
import { estimateArrivalTemp, transitHours } from "../domain/schedule";
import { useDispatchStore } from "../stores/dispatch";
import { formatDateTime } from "../utils/format";

const props = defineProps<{ order: DeliveryOrder }>();
const store = useDispatchStore();

const actualTemp = ref<number | null>(null);
const error = ref("");

const station = computed(() => store.stationOf(props.order));
const vehicle = computed(() =>
  props.order.assignment ? store.vehicleOf(props.order.assignment.vehicleId) : undefined
);
const bay = computed(() =>
  vehicle.value && props.order.assignment
    ? vehicle.value.bays.find((item) => item.id === props.order.assignment?.bayId)
    : undefined
);
const estimated = computed(() =>
  bay.value ? estimateArrivalTemp(props.order.loadTemp, bay.value.coolRate, props.order.mileage) : null
);

function reassign() {
  error.value = store.releaseForReassign(props.order.id) ?? "";
}

function unload() {
  error.value = "";
  if (actualTemp.value === null || Number.isNaN(actualTemp.value)) {
    error.value = "请填写实测到站油温";
    return;
  }
  const message = store.unloadOrder(props.order.id, actualTemp.value);
  if (message) error.value = message;
}
</script>

<template>
  <article class="card transit-card">
    <header class="card-head">
      <div>
        <p class="card-title">{{ order.code }} <span class="muted">{{ order.fuel }} · {{ order.tons }}t</span></p>
        <p class="muted small">→ {{ station?.name }}（接收 ≥ {{ station?.minTemp }}℃）</p>
      </div>
      <span class="badge badge-transit">在途</span>
    </header>

    <div class="info-grid">
      <span>车 / 仓<strong>{{ vehicle?.plate }} · {{ bay?.name }}</strong></span>
      <span>时段<strong>{{ order.assignment?.slot }}</strong></span>
      <span>司机<strong>{{ vehicle?.driver }}</strong></span>
      <span>装车<strong>{{ order.loadTemp }}℃</strong></span>
      <span>里程<strong>{{ order.mileage }}km · ≈{{ transitHours(order.mileage).toFixed(1) }}h</strong></span>
      <span>预估到站<strong :class="estimated !== null && station && estimated < station.minTemp ? 'temp-bad' : 'temp-ok'">{{ estimated }}℃</strong></span>
    </div>

    <div class="lock-line">
      <span class="lock-tag">🔒 {{ vehicle?.plate }} · {{ bay?.name }} · {{ order.assignment?.slot }} 已锁定</span>
      <span class="muted small">发车 {{ order.assignment ? formatDateTime(order.assignment.dispatchedAt) : "" }}</span>
    </div>

    <ul v-if="order.releases.length" class="release-list">
      <li v-for="(item, index) in order.releases" :key="index" class="muted small">
        {{ formatDateTime(item.at) }} {{ item.reason }}
      </li>
    </ul>

    <p v-if="error" class="form-error">{{ error }}</p>
    <div class="card-actions">
      <label class="unload-field">
        实测到站油温（℃）
        <input v-model.number="actualTemp" type="number" step="0.1" />
      </label>
      <button type="button" @click="unload">卸油回填</button>
      <button type="button" class="secondary" @click="reassign">改派（先释放原车）</button>
    </div>
  </article>
</template>
