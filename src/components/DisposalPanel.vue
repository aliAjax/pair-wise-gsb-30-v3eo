<script setup lang="ts">
import { ref } from "vue";
import { useDispatchStore } from "../stores/dispatch";
import { formatDateTime } from "../utils/format";

const store = useDispatchStore();
const measures = ref<Record<string, string>>({});
const errors = ref<Record<string, string>>({});

function resolve(id: string) {
  const message = store.resolveDisposal(id, measures.value[id] ?? "");
  errors.value[id] = message ?? "";
}
</script>

<template>
  <section class="panel disposal-panel">
    <h2>异常处置 <span class="count-pill">{{ store.openDisposals.length }}</span></h2>
    <p class="muted small">卸油实测温度跌破站点接收要求时自动生成处置单，已处理记录保留备查。</p>

    <div v-if="store.disposals.length === 0" class="empty">暂无异常处置单</div>
    <div v-else class="disposal-list">
      <article v-for="item in store.disposals" :key="item.id" class="disposal-item" :class="{ handled: item.handled }">
        <header class="card-head">
          <p class="card-title">
            {{ item.code }}
            <span class="muted small">{{ item.orderCode }} · {{ item.stationName }}</span>
          </p>
          <span class="badge" :class="item.handled ? 'badge-done' : 'badge-alert'">
            {{ item.handled ? "已处理" : "待处置" }}
          </span>
        </header>
        <div class="info-grid">
          <span>车 / 仓<strong>{{ item.vehiclePlate }} · {{ item.bayName }}</strong></span>
          <span>实测温度<strong class="temp-bad">{{ item.actualTemp }}℃</strong></span>
          <span>接收线<strong>{{ item.minTemp }}℃</strong></span>
          <span>缺口<strong class="temp-bad">{{ item.gap }}℃</strong></span>
        </div>
        <p class="muted small">生成于 {{ formatDateTime(item.createdAt) }}</p>
        <template v-if="!item.handled">
          <textarea v-model="measures[item.id]" placeholder="填写处置措施：加热回库、降温稀释、拒收退回等" />
          <p v-if="errors[item.id]" class="form-error">{{ errors[item.id] }}</p>
          <div class="card-actions">
            <button type="button" @click="resolve(item.id)">结案</button>
          </div>
        </template>
        <p v-else class="measure-line">处置：{{ item.measure }}</p>
      </article>
    </div>
  </section>
</template>
