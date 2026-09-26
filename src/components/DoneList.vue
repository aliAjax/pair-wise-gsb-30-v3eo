<script setup lang="ts">
import { useDispatchStore } from "../stores/dispatch";
import { formatDateTime } from "../utils/format";

const store = useDispatchStore();
</script>

<template>
  <section class="panel done-panel">
    <h2>已完成 <span class="count-pill">{{ store.doneOrders.length }}</span></h2>
    <div v-if="store.doneOrders.length === 0" class="empty">暂无已完成配送单</div>
    <ul class="done-list">
      <li v-for="order in store.doneOrders" :key="order.id">
        <span class="card-title">{{ order.code }}</span>
        <span class="muted">{{ order.fuel }} · {{ order.tons }}t · {{ store.stationOf(order)?.name }}</span>
        <span v-if="order.unload" :class="order.unload.abnormal ? 'temp-bad' : 'temp-ok'">
          实测 {{ order.unload.actualTemp }}℃{{ order.unload.abnormal ? " · 异常" : " · 合格" }}
        </span>
        <span class="muted small">{{ order.unload ? formatDateTime(order.unload.unloadedAt) : "" }}</span>
      </li>
    </ul>
  </section>
</template>
