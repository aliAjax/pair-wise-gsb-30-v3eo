<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DeliveryOrder } from "../types";
import { TIME_SLOTS, transitHours } from "../domain/schedule";
import { useDispatchStore } from "../stores/dispatch";

const props = defineProps<{ order: DeliveryOrder }>();
const store = useDispatchStore();

const slot = ref(TIME_SLOTS[1]);
const choiceKey = ref("");
const error = ref("");

const station = computed(() => store.stationOf(props.order));
const hours = computed(() => (transitHours(props.order.mileage)).toFixed(1));
const choices = computed(() => store.choicesFor(props.order, slot.value));
const selected = computed(() => choices.value.find((item) => `${item.vehicle.id}-${item.bayId}` === choiceKey.value) ?? null);

// 切换时段或数据变化后，尽量保留一个可用选择，否则重置
function syncSelection() {
  if (!choices.value.some((item) => `${item.vehicle.id}-${item.bayId}` === choiceKey.value)) {
    const first = choices.value.find((item) => item.ok);
    choiceKey.value = first ? `${first.vehicle.id}-${first.bayId}` : "";
  }
}

watch(choices, syncSelection);

function onSlotChange(value: string) {
  slot.value = value;
  error.value = "";
  syncSelection();
}

function dispatch() {
  error.value = "";
  if (!selected.value) {
    error.value = "请选择分仓";
    return;
  }
  const message = store.dispatchOrder(props.order.id, selected.value.vehicle.id, selected.value.bayId, slot.value);
  if (message) error.value = message;
}

// 初次进入立即同步一次默认选择
syncSelection();

function remove() {
  error.value = store.removeOrder(props.order.id) ?? "";
}
</script>

<template>
  <article class="card pending-card">
    <header class="card-head">
      <div>
        <p class="card-title">{{ order.code }} <span class="muted">{{ order.fuel }} · {{ order.tons }}t</span></p>
        <p class="muted small">→ {{ station?.name }}（接收 ≥ {{ station?.minTemp }}℃）</p>
      </div>
      <span class="badge badge-pending">待排</span>
    </header>

    <div class="info-grid">
      <span>装车温度<strong>{{ order.loadTemp }}℃</strong></span>
      <span>里程<strong>{{ order.mileage }}km</strong></span>
      <span>预计在途<strong>≈{{ hours }}h</strong></span>
    </div>
    <p v-if="order.notes !== '暂无备注'" class="card-note">{{ order.notes }}</p>

    <label class="inline-field">发车时段
      <select :value="slot" @change="onSlotChange(($event.target as HTMLSelectElement).value)">
        <option v-for="item in TIME_SLOTS" :key="item" :value="item">{{ item }}</option>
      </select>
    </label>

    <div class="bay-list">
      <label
        v-for="choice in choices"
        :key="`${choice.vehicle.id}-${choice.bayId}`"
        class="bay-option"
        :class="{ disabled: !choice.ok }"
      >
        <input
          v-if="choice.ok"
          v-model="choiceKey"
          type="radio"
          name="bay"
          :value="`${choice.vehicle.id}-${choice.bayId}`"
        />
        <span v-else class="lock-mark">{{ choice.locked ? "🔒" : "❄️" }}</span>
        <span class="bay-main">
          {{ choice.vehicle.plate }} · {{ choice.bayName }}
          <small class="muted">{{ choice.vehicle.driver }} · 降温 {{ choice.coolRate }}℃/h</small>
        </span>
        <span class="bay-temp" :class="choice.gap > 0 ? 'temp-bad' : 'temp-ok'">
          到站 {{ choice.estimated }}℃
          <small v-if="choice.locked">已锁定</small>
          <small v-else-if="choice.gap > 0">缺 {{ choice.gap }}℃</small>
        </span>
      </label>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
    <div class="card-actions">
      <button type="button" :disabled="!selected" @click="dispatch">确认发车</button>
      <button type="button" class="secondary tiny" @click="remove">删除单据</button>
    </div>
  </article>
</template>
