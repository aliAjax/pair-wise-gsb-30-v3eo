<script setup lang="ts">
// 低温保温排程台：冬季夜间送油，按分仓降温速度估算到站油温再排车
import { computed, ref } from "vue";
import { useDispatchStore } from "./store/dispatch";
import ScheduleBoard from "./pages/ScheduleBoard.vue";
import RegistryPage from "./pages/RegistryPage.vue";
import DispositionPage from "./pages/DispositionPage.vue";

const store = useDispatchStore();
type Tab = "board" | "registry" | "disposition";
const tab = ref<Tab>("board");

const openCount = computed(() => store.openDispositions.length);
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业 · 冬季夜间配送</p>
          <h1>低温保温排程台</h1>
          <p class="subtitle">
            车辆登记分仓降温速度，配送单登记油品、装车温度与里程，站点登记最低接收温度；
            排车时按“装车温度 − 降温速度 ×（里程 ÷ 均速）”估算到站油温，缺温留待排，发车即锁定分仓与时段。
          </p>
        </div>
        <nav class="tabs">
          <button :class="{ active: tab === 'board' }" type="button" @click="tab = 'board'">排程台</button>
          <button :class="{ active: tab === 'registry' }" type="button" @click="tab = 'registry'">资料登记</button>
          <button :class="{ active: tab === 'disposition' }" type="button" @click="tab = 'disposition'">
            处置单<span v-if="openCount" class="badge">{{ openCount }}</span>
          </button>
        </nav>
      </header>

      <ScheduleBoard v-if="tab === 'board'" />
      <RegistryPage v-else-if="tab === 'registry'" />
      <DispositionPage v-else />
    </div>
  </main>
</template>
