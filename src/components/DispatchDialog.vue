<script setup lang="ts">
// 排车测算弹窗：估算到站油温；达标才允许发车/改派，不够可“留在待排”并记下缺几度
import { computed, reactive, ref, watch } from "vue";
import { useDispatchStore } from "../store/dispatch";
import type { DeliveryOrder } from "../types";
import { SLOTS, slotLabel } from "../domain/thermal";
import { dateStr, fmt1, fmtDateTime } from "../utils";

const props = defineProps<{
  order: DeliveryOrder;
  mode: "dispatch" | "reassign";
}>();
const emit = defineEmits<{ close: [] }>();

const store = useDispatchStore();
const site = computed(() => store.getSite(props.order.siteId)!);

const form = reactive({
  vehicleId: props.order.assignment?.vehicleId ?? store.vehicles[0]?.id ?? "",
  bayId: props.order.assignment?.bayId ?? "",
  date: props.order.assignment?.date ?? dateStr(),
  slotId: props.order.assignment?.slotId ?? "slot-22",
});

const vehicle = computed(() => store.vehicles.find((v) => v.id === form.vehicleId));

function pickUsableBay() {
  const list = vehicle.value?.bays ?? [];
  // 改派时优先保留当前分仓，便于在原车上换时段
  const current = list.find((b) => b.id === props.order.assignment?.bayId);
  if (current) {
    const r = store.assess(props.order.id, { ...form, bayId: current.id });
    if (r && !r.locked && !r.tooSmall) {
      form.bayId = current.id;
      return;
    }
  }
  const usable = list.find((b) => {
    const r = store.assess(props.order.id, { ...form, bayId: b.id });
    return r && !r.locked && !r.tooSmall;
  });
  form.bayId = usable?.id ?? current?.id ?? list[0]?.id ?? "";
}
pickUsableBay();

watch(
  () => [form.vehicleId, form.date, form.slotId],
  () => pickUsableBay()
);

const selection = computed(() => ({ ...form }));
const result = computed(() =>
  form.bayId ? store.assess(props.order.id, selection.value) : undefined
);

function bayBadge(bayId: string) {
  const r = store.assess(props.order.id, { ...form, bayId });
  if (!r) return { text: "无法测算", cls: "bad" };
  if (r.locked) return { text: "时段已锁定", cls: "bad" };
  if (r.tooSmall) return { text: "仓容不足", cls: "bad" };
  if (r.short > 0) return { text: `缺${fmt1(r.short)}℃`, cls: "warn" };
  return { text: "温度达标", cls: "good" };
}

const estHours = computed(() =>
  store.speed > 0 ? props.order.mileage / store.speed : 0
);

const error = ref("");

function stayPending() {
  if (!form.bayId) {
    error.value = "请先选择一个分仓再记录测算结果";
    return;
  }
  store.saveCheck(props.order.id, selection.value);
  emit("close");
}

function confirm() {
  error.value = "";
  const message =
    props.mode === "reassign"
      ? store.reassign(props.order.id, selection.value)
      : store.dispatch(props.order.id, selection.value);
  if (message) {
    error.value = message;
    return;
  }
  emit("close");
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <header class="modal-head">
        <h3>{{ mode === "reassign" ? "改派（先释放原车，再锁定新车）" : "排车测算" }}</h3>
        <button class="icon-btn" type="button" @click="emit('close')">×</button>
      </header>

      <div class="modal-body">
        <div class="order-summary">
          <strong>{{ order.code }}</strong>
          <span>{{ site.name }} · {{ order.fuel }} · {{ order.tons }}吨</span>
          <span>装车温度 {{ order.loadTemp }}℃ · 里程 {{ order.mileage }}km · 约行 {{ fmt1(estHours) }}h</span>
          <span>站点接收线 ≥ {{ site.minTemp }}℃</span>
        </div>

        <div class="modal-grid">
          <label>
            车辆（司机）
            <select v-model="form.vehicleId">
              <option v-for="v in store.vehicles" :key="v.id" :value="v.id">
                {{ v.plate }}（{{ v.driver }}）
              </option>
            </select>
          </label>
          <label>
            发车日期
            <input v-model="form.date" type="date" />
          </label>
          <label class="span2">
            夜间时段（同仓同日同时段只锁一单）
            <select v-model="form.slotId">
              <option v-for="s in SLOTS" :key="s.id" :value="s.id">{{ s.label }}</option>
            </select>
          </label>
        </div>

        <div class="bay-list">
          <p class="bay-list-title">选择分仓（登记的降温速度直接参与测算）</p>
          <label v-for="bay in vehicle?.bays ?? []" :key="bay.id" class="bay-option"
            :class="{ disabled: bayBadge(bay.id).cls === 'bad' }">
            <input v-model="form.bayId" type="radio" name="bay" :value="bay.id" />
            <span class="bay-name">{{ bay.name }}</span>
            <span class="bay-meta">{{ bay.capacity }}吨 · {{ bay.coolRate }}℃/h</span>
            <span class="bay-pick" :class="bayBadge(bay.id).cls">{{ bayBadge(bay.id).text }}</span>
          </label>
          <p v-if="(vehicle?.bays.length ?? 0) === 0" class="empty">该车尚未登记分仓</p>
        </div>

        <div v-if="result && !result.vehicleMissing" class="estimate" :class="result.short > 0 ? 'cold' : 'warm'">
          <p>预计到站油温 <strong>{{ fmt1(result.estTemp) }}℃</strong></p>
          <p v-if="result.short > 0" class="short">低于接收线 <strong>{{ fmt1(result.short) }}℃</strong>，不可发车，请留在待排</p>
          <p v-else-if="!result.locked && !result.tooSmall" class="ok">温度达标，可锁定分仓与时段发车</p>
          <p v-else class="block">{{ result.reason }}</p>
        </div>

        <p v-if="order.lastCheck && mode === 'dispatch'" class="last-check">
          上次留存测算：{{ store.getVehicle(order.lastCheck.vehicleId)?.plate ?? "原车" }}
          {{ store.getBay(order.lastCheck.vehicleId, order.lastCheck.bayId)?.name ?? "" }} ·
          {{ order.lastCheck.date }} {{ slotLabel(order.lastCheck.slotId) }} →
          预计 {{ fmt1(order.lastCheck.estTemp) }}℃，
          <span :class="order.lastCheck.short > 0 ? 'cold-text' : 'ok-text'">
            {{ order.lastCheck.short > 0 ? `缺${fmt1(order.lastCheck.short)}℃` : "达标" }}
          </span>
          （{{ fmtDateTime(order.lastCheck.checkedAt) }}）
        </p>

        <p v-if="error" class="form-error">{{ error }}</p>
      </div>

      <footer class="modal-foot">
        <button v-if="mode === 'dispatch'" class="secondary" type="button" @click="stayPending">
          留在待排（记录缺温）
        </button>
        <button class="secondary" type="button" @click="emit('close')">取消</button>
        <button type="button" :disabled="!result?.ok" @click="confirm">
          {{ mode === "reassign" ? "释放原车并确认改派" : "确认发车（锁定分仓时段）" }}
        </button>
      </footer>
    </div>
  </div>
</template>
