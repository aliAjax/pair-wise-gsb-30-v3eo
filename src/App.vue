<script setup lang="ts">
import { useDispatchStore } from "./stores/dispatch";
import RegistrationPanel from "./components/RegistrationPanel.vue";
import PendingOrderCard from "./components/PendingOrderCard.vue";
import TransitOrderCard from "./components/TransitOrderCard.vue";
import DisposalPanel from "./components/DisposalPanel.vue";
import DoneList from "./components/DoneList.vue";

const store = useDispatchStore();
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">冬季夜间 · 低温保温排程台</p>
          <h1>油品配送低温保温排程台</h1>
          <p class="subtitle">
            车辆登记分仓与降温速度，配送单登记油品 / 装车温度 / 里程，站点登记最低接收温度。
            排车按里程由近到远估算到站油温，不达标留在待排并标明缺几度；发车即锁定分仓与时段，改派先释放原车，卸油回填实测温度，异常自动生成处置单。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Pinia</span>
          <span class="tag">分层架构</span>
          <span class="tag">本地持久化</span>
        </div>
      </header>

      <section class="metrics">
        <article class="metric">
          <span>待排单</span>
          <strong>{{ store.metrics.pending }}</strong>
        </article>
        <article class="metric">
          <span>在途单（分仓时段锁定中）</span>
          <strong>{{ store.metrics.inTransit }}</strong>
        </article>
        <article class="metric">
          <span>待处置异常</span>
          <strong :class="{ 'alert-number': store.metrics.disposals > 0 }">{{ store.metrics.disposals }}</strong>
        </article>
        <article class="metric">
          <span>车辆 / 分仓</span>
          <strong>{{ store.vehicles.length }} / {{ store.metrics.bays }}</strong>
        </article>
      </section>

      <section class="layout">
        <div class="left-col">
          <RegistrationPanel />
          <DisposalPanel />
        </div>

        <div class="right-col">
          <section class="panel board-panel">
            <div class="toolbar">
              <h2>排程台</h2>
              <span class="muted small">待排按里程升序 · 估算公式：装车温度 − 降温速度 ×（里程 ÷ 45km/h）</span>
            </div>

            <div class="board-columns">
              <div class="board-col">
                <h3>待排 <span class="count-pill">{{ store.pendingOrders.length }}</span></h3>
                <div v-if="store.pendingOrders.length === 0" class="empty compact">暂无待排单</div>
                <PendingOrderCard v-for="order in store.pendingOrders" :key="order.id" :order="order" />
              </div>

              <div class="board-col">
                <h3>在途 <span class="count-pill">{{ store.inTransitOrders.length }}</span></h3>
                <div v-if="store.inTransitOrders.length === 0" class="empty compact">暂无在途单</div>
                <TransitOrderCard v-for="order in store.inTransitOrders" :key="order.id" :order="order" />
              </div>
            </div>
          </section>

          <DoneList />
        </div>
      </section>
    </div>
  </main>
</template>
