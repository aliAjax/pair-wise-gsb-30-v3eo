<script setup lang="ts">
// 卸油回填弹窗：填写实测温度；跌破站点接收线自动生成处置单
import { computed, ref } from "vue";
import { useDispatchStore } from "../store/dispatch";
import type { DeliveryOrder } from "../types";
import { fmt1 } from "../utils";

const props = defineProps<{ order: DeliveryOrder }>();
const emit = defineEmits<{ close: [] }>();

const store = useDispatchStore();
const site = computed(() => store.getSite(props.order.siteId)!);
const measured = ref<number>(Math.round((props.order.assignment?.estTemp ?? props.order.loadTemp) * 10) / 10);
const error = ref("");
const createdShort = ref<number | null>(null);

const previewShort = computed(() => Math.max(0, site.value.minTemp - (measured.value || 0)));

function submit() {
  error.value = "";
  if (!Number.isFinite(measured.value)) {
    error.value = "请填写实测温度";
    return;
  }
  const res = store.unload(props.order.id, measured.value);
  if (res.error) {
    error.value = res.error;
    return;
  }
  if (res.dispositionId) {
    createdShort.value = previewShort.value;
    return; // 留在弹窗内提示已生成处置单，用户确认后关闭
  }
  emit("close");
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal modal-sm">
      <header class="modal-head">
        <h3>卸油回填 · {{ order.code }}</h3>
        <button class="icon-btn" type="button" @click="emit('close')">×</button>
      </header>

      <div class="modal-body">
        <div class="order-summary">
          <span>{{ site.name }} · {{ order.fuel }} · {{ order.tons }}吨</span>
          <span>装车温度 {{ order.loadTemp }}℃ · 排车预计到站 {{ fmt1(order.assignment?.estTemp ?? NaN) }}℃</span>
          <span>站点接收线 ≥ {{ site.minTemp }}℃</span>
        </div>

        <label class="measure-field">
          实测到站油温（℃）
          <input v-model.number="measured" type="number" step="0.1" />
        </label>

        <p v-if="previewShort > 0" class="cold-text warn-line">
          低于接收线 {{ fmt1(previewShort) }}℃，提交后自动生成异常处置单并释放分仓锁定
        </p>
        <p v-else class="ok-text warn-line">实测达标，提交后完成卸油并释放分仓与时段锁定</p>

        <p v-if="error" class="form-error">{{ error }}</p>

        <div v-if="createdShort !== null" class="done-banner">
          已生成异常处置单（缺 {{ fmt1(createdShort) }}℃），可在“处置单”页填写处置措施并闭环。
        </div>
      </div>

      <footer class="modal-foot">
        <button class="secondary" type="button" @click="emit('close')">
          {{ createdShort !== null ? "知道了" : "取消" }}
        </button>
        <button v-if="createdShort === null" type="button" @click="submit">提交回填</button>
      </footer>
    </div>
  </div>
</template>
