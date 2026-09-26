<script setup lang="ts">
// 页面：异常处置单（卸油实测跌破接收线时自动生成，填写措施与处理人并闭环）
import { computed, ref } from "vue";
import { useDispatchStore } from "../store/dispatch";
import { STATUS_LABEL } from "../domain/thermal";
import { fmt1, fmtDateTime } from "../utils";
import type { Disposition } from "../types";

const store = useDispatchStore();
const filter = ref<"all" | "open" | "handling" | "closed">("all");

const list = computed(() => {
  if (filter.value === "all") return store.dispositions;
  return store.dispositions.filter((d) => d.status === filter.value);
});

const counts = computed(() => ({
  all: store.dispositions.length,
  open: store.dispositions.filter((d) => d.status === "open").length,
  handling: store.dispositions.filter((d) => d.status === "handling").length,
  closed: store.dispositions.filter((d) => d.status === "closed").length,
}));

function drafts(id: string) {
  if (!draftsMap.value[id]) {
    const item = store.dispositions.find((d) => d.id === id);
    draftsMap.value[id] = { action: item?.action ?? "", handler: item?.handler ?? "" };
  }
  return draftsMap.value[id];
}
const draftsMap = ref<Record<string, { action: string; handler: string }>>({});

function startHandle(item: Disposition) {
  if (!draftsMap.value[item.id]) {
    draftsMap.value[item.id] = { action: item.action, handler: item.handler };
  }
  store.updateDisposition(item.id, {
    action: draftsMap.value[item.id].action,
    handler: draftsMap.value[item.id].handler,
    status: "handling",
  });
}

function saveItem(item: Disposition) {
  const draft = draftsMap.value[item.id];
  if (draft) {
    store.updateDisposition(item.id, {
      action: draft.action,
      handler: draft.handler,
      status: item.status === "open" ? "handling" : item.status,
    });
  }
}

function closeItem(item: Disposition) {
  saveItem(item);
  if (!item.action.trim()) return;
  store.updateDisposition(item.id, { status: "closed" });
}
</script>

<template>
  <div>
    <nav class="subtabs">
      <button :class="{ active: filter === 'all' }" type="button" @click="filter = 'all'">全部（{{ counts.all }}）</button>
      <button :class="{ active: filter === 'open' }" type="button" @click="filter = 'open'">待处置（{{ counts.open }}）</button>
      <button :class="{ active: filter === 'handling' }" type="button" @click="filter = 'handling'">处置中（{{ counts.handling }}）</button>
      <button :class="{ active: filter === 'closed' }" type="button" @click="filter = 'closed'">已闭环（{{ counts.closed }}）</button>
    </nav>

    <p v-if="list.length === 0" class="empty big">暂无处置单；只有卸油实测温度跌破站点接收线时才会自动生成。</p>

    <div class="dispo-grid">
      <article v-for="d in list" :key="d.id" class="dispo-card" :class="d.status">
        <header class="card-head">
          <strong>{{ d.code }}</strong>
          <span class="pill" :class="`${d.status}-pill`">{{ STATUS_LABEL[d.status] }}</span>
        </header>
        <div class="kv">
          <span>站点 <b>{{ d.siteName }}</b></span>
          <span>油品 <b>{{ d.fuel }}</b></span>
          <span>车辆/分仓 <b>{{ d.plate }} / {{ d.bayName }}</b></span>
        </div>
        <div class="temp-compare">
          <span>实测 <b class="cold-text">{{ fmt1(d.measuredTemp) }}℃</b></span>
          <span>接收线 <b>{{ fmt1(d.minTemp) }}℃</b></span>
          <span class="short-badge">缺 {{ fmt1(d.short) }}℃</span>
        </div>
        <p class="note-line">生成时间：{{ fmtDateTime(d.createdAt) }}</p>

        <label v-if="d.status !== 'closed'" class="dispo-field">
          处置措施（加热循环 / 沉降化验 / 返库等）
          <textarea v-model="drafts(d.id).action" :placeholder="d.action || '填写现场处置过程与结论'"></textarea>
        </label>
        <p v-else class="note-line remark">{{ d.action || "（未填写措施）" }}</p>

        <label v-if="d.status !== 'closed'" class="dispo-field inline">
          处理人
          <input v-model="drafts(d.id).handler" :placeholder="d.handler || '姓名/班组'" />
        </label>
        <p v-else-if="d.handler" class="note-line">处理人：{{ d.handler }}</p>

        <div v-if="d.status !== 'closed'" class="actions">
          <button v-if="d.status === 'open'" type="button" @click="startHandle(d)">开始处置</button>
          <button class="secondary" type="button" @click="saveItem(d)">保存</button>
          <button class="secondary" type="button" :disabled="!drafts(d.id).action?.trim() && !d.action.trim()" @click="closeItem(d)">闭环</button>
        </div>
      </article>
    </div>
  </div>
</template>
