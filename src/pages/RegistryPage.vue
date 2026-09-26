<script setup lang="ts">
// 页面：资料登记（配送单、车辆+分仓降温速度、站点最低接收温度）
import { reactive, ref } from "vue";
import { useDispatchStore } from "../store/dispatch";
import { STATUS_LABEL } from "../domain/thermal";
import { fmtDateTime } from "../utils";

const store = useDispatchStore();
const tab = ref<"orders" | "vehicles" | "sites">("orders");
const error = ref("");

// ---- 配送单 ----
const orderForm = reactive({
  siteId: "",
  fuel: store.fuels[0],
  tons: 10,
  loadTemp: 10,
  mileage: 80,
  notes: "",
});
function submitOrder() {
  error.value = "";
  if (!orderForm.siteId) {
    error.value = "请选择目标站点";
    return;
  }
  store.addOrder({ ...orderForm });
  orderForm.tons = 10;
  orderForm.loadTemp = 10;
  orderForm.mileage = 80;
  orderForm.notes = "";
}

// ---- 车辆 ----
const vehicleForm = reactive({ plate: "", driver: "" });
const bayForms = reactive<Record<string, { name: string; capacity: number; coolRate: number }>>({});
function bayDraft(vehicleId: string) {
  if (!bayForms[vehicleId]) {
    bayForms[vehicleId] = { name: "", capacity: 15, coolRate: 1 };
  }
  return bayForms[vehicleId];
}
function submitVehicle() {
  error.value = "";
  if (!vehicleForm.plate.trim()) {
    error.value = "请填写车牌号";
    return;
  }
  store.addVehicle({ ...vehicleForm });
  vehicleForm.plate = "";
  vehicleForm.driver = "";
}
function submitBay(vehicleId: string) {
  error.value = "";
  const f = bayDraft(vehicleId);
  if (!f.name.trim()) {
    error.value = "请填写分仓名称";
    return;
  }
  store.addBay(vehicleId, { ...f });
  bayForms[vehicleId] = { name: "", capacity: 15, coolRate: 1 };
}

// ---- 站点 ----
const siteForm = reactive({ name: "", minTemp: 4 });
function submitSite() {
  error.value = "";
  if (!siteForm.name.trim()) {
    error.value = "请填写站点名称";
    return;
  }
  store.addSite({ ...siteForm });
  siteForm.name = "";
  siteForm.minTemp = 4;
}
</script>

<template>
  <div class="registry">
    <nav class="subtabs">
      <button :class="{ active: tab === 'orders' }" type="button" @click="tab = 'orders'">配送单</button>
      <button :class="{ active: tab === 'vehicles' }" type="button" @click="tab = 'vehicles'">车辆与分仓</button>
      <button :class="{ active: tab === 'sites' }" type="button" @click="tab = 'sites'">站点</button>
    </nav>
    <p v-if="error" class="form-error">{{ error }}</p>

    <!-- 配送单登记 -->
    <section v-if="tab === 'orders'" class="reg-grid">
      <form class="panel" @submit.prevent="submitOrder">
        <h3>登记配送单</h3>
        <p class="hint">油品、装车温度、里程是排车测算的必要资料</p>
        <label>目标站点
          <select v-model="orderForm.siteId">
            <option value="">请选择</option>
            <option v-for="s in store.sites" :key="s.id" :value="s.id">
              {{ s.name }}（接收线 ≥{{ s.minTemp }}℃）
            </option>
          </select>
        </label>
        <label>油品
          <select v-model="orderForm.fuel">
            <option v-for="f in store.fuels" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <div class="two-col">
          <label>配送吨数
            <input v-model.number="orderForm.tons" type="number" min="0" step="0.5" />
          </label>
          <label>装车温度 ℃
            <input v-model.number="orderForm.loadTemp" type="number" step="0.1" />
          </label>
        </div>
        <label>里程 km
          <input v-model.number="orderForm.mileage" type="number" min="0" step="1" />
        </label>
        <label>备注
          <textarea v-model="orderForm.notes" placeholder="装车批次、提温情况等" />
        </label>
        <button type="submit">保存配送单（进入待排）</button>
      </form>

      <div class="panel">
        <h3>全部配送单（{{ store.orders.length }}）</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>单号</th><th>站点</th><th>油品</th><th>吨数</th>
                <th>装车温度</th><th>里程</th><th>状态</th><th>登记时间</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in store.orders" :key="o.id">
                <td>{{ o.code }}</td>
                <td>{{ store.getSite(o.siteId)?.name ?? "—" }}</td>
                <td>{{ o.fuel }}</td>
                <td>{{ o.tons }}</td>
                <td>{{ o.loadTemp }}℃</td>
                <td>{{ o.mileage }}km</td>
                <td><span class="pill" :class="`${o.status}-pill`">{{ STATUS_LABEL[o.status] }}</span></td>
                <td>{{ fmtDateTime(o.createdAt) }}</td>
                <td>
                  <button v-if="o.status !== 'inTransit'" class="danger tiny" type="button"
                    @click="error = store.removeOrder(o.id) ?? ''">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 车辆登记 -->
    <section v-else-if="tab === 'vehicles'" class="reg-grid">
      <form class="panel" @submit.prevent="submitVehicle">
        <h3>登记车辆</h3>
        <label>车牌号
          <input v-model="vehicleForm.plate" placeholder="如 鲁B·7M215" />
        </label>
        <label>司机
          <input v-model="vehicleForm.driver" placeholder="冬季夜班司机姓名" />
        </label>
        <button type="submit">保存车辆</button>
      </form>

      <div class="panel vehicles">
        <h3>车辆 / 分仓 / 降温速度（{{ store.vehicles.length }}台）</h3>
        <article v-for="v in store.vehicles" :key="v.id" class="vehicle-block">
          <div class="vehicle-head">
            <strong>{{ v.plate }}</strong>
            <span class="muted">司机 {{ v.driver || "—" }} · {{ v.bays.length }}个分仓</span>
            <button class="danger tiny" type="button"
              @click="error = store.removeVehicle(v.id) ?? ''">删除车辆</button>
          </div>
          <table class="bay-table">
            <thead>
              <tr><th>分仓</th><th>仓容（吨）</th><th>降温速度（℃/h）</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="b in v.bays" :key="b.id">
                <td>{{ b.name }}</td>
                <td>{{ b.capacity }}</td>
                <td>{{ b.coolRate }}</td>
                <td>
                  <button class="danger tiny" type="button"
                    @click="error = store.removeBay(v.id, b.id) ?? ''">删仓</button>
                </td>
              </tr>
            </tbody>
          </table>
          <form class="bay-form" @submit.prevent="submitBay(v.id)">
            <input v-model="bayDraft(v.id).name" placeholder="分仓名，如 保温一仓" />
            <input v-model.number="bayDraft(v.id).capacity" type="number" min="0" step="0.5" title="仓容（吨）" placeholder="仓容吨" />
            <input v-model.number="bayDraft(v.id).coolRate" type="number" min="0" step="0.1" title="降温速度 ℃/h" placeholder="降温℃/h" />
            <button class="secondary" type="submit">加分仓</button>
          </form>
        </article>
        <p v-if="store.vehicles.length === 0" class="empty">尚未登记车辆</p>
      </div>
    </section>

    <!-- 站点登记 -->
    <section v-else class="reg-grid">
      <form class="panel" @submit.prevent="submitSite">
        <h3>登记站点</h3>
        <p class="hint">最低接收温度是判定“缺几度”的接收线</p>
        <label>站点名称
          <input v-model="siteForm.name" placeholder="如 城东站" />
        </label>
        <label>最低接收温度 ℃
          <input v-model.number="siteForm.minTemp" type="number" step="0.1" />
        </label>
        <button type="submit">保存站点</button>
      </form>

      <div class="panel">
        <h3>站点接收标准（{{ store.sites.length }}个）</h3>
        <table>
          <thead>
            <tr><th>站点</th><th>最低接收温度</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="s in store.sites" :key="s.id">
              <td><input v-model="s.name" class="inline-input" /></td>
              <td>
                <span class="inline-temp">
                  ≥ <input v-model.number="s.minTemp" type="number" step="0.1" class="inline-input narrow" /> ℃
                </span>
              </td>
              <td>
                <button class="danger tiny" type="button"
                  @click="error = store.removeSite(s.id) ?? ''">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
