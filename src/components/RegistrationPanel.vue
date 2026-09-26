<script setup lang="ts">
import { reactive, ref } from "vue";
import { FUELS } from "../types";
import { useDispatchStore } from "../stores/dispatch";

const store = useDispatchStore();
const tab = ref<"vehicle" | "station" | "order">("vehicle");
const vehicleDeleteError = ref("");
const stationDeleteError = ref("");

// ---------- 车辆：登记分仓与降温速度 ----------
const vehicleForm = reactive({ plate: "", driver: "" });
const bays = reactive<{ name: string; coolRate: number }[]>([{ name: "1号仓", coolRate: 0.8 }]);
const vehicleError = ref("");

function addBay() {
  bays.push({ name: `${bays.length + 1}号仓`, coolRate: 0.8 });
}

function removeBay(index: number) {
  bays.splice(index, 1);
}

function submitVehicle() {
  vehicleError.value = "";
  vehicleDeleteError.value = "";
  if (!vehicleForm.plate.trim()) {
    vehicleError.value = "请填写车牌";
    return;
  }
  if (bays.length === 0 || bays.some((bay) => !bay.name.trim() || bay.coolRate <= 0)) {
    vehicleError.value = "至少保留一个分仓，并填写名称和大于 0 的降温速度";
    return;
  }
  store.addVehicle({ plate: vehicleForm.plate.trim(), driver: vehicleForm.driver.trim(), bays });
  vehicleForm.plate = "";
  vehicleForm.driver = "";
  bays.splice(0, bays.length, { name: "1号仓", coolRate: 0.8 });
}

function deleteVehicle(id: string) {
  vehicleDeleteError.value = store.removeVehicle(id) ?? "";
}

// ---------- 站点：登记最低接收温度 ----------
const stationForm = reactive({ name: "", minTemp: 5 });
const stationError = ref("");

function submitStation() {
  stationError.value = "";
  stationDeleteError.value = "";
  if (!stationForm.name.trim()) {
    stationError.value = "请填写站点名称";
    return;
  }
  store.addStation(stationForm.name.trim(), stationForm.minTemp);
  stationForm.name = "";
  stationForm.minTemp = 5;
}

function deleteStation(id: string) {
  stationDeleteError.value = store.removeStation(id) ?? "";
}

// ---------- 配送单：油品、装车温度、里程 ----------
const orderForm = reactive({
  fuel: FUELS[0] as string,
  tons: 15,
  stationId: "" as string,
  loadTemp: 12,
  mileage: 100,
  notes: ""
});
const orderError = ref("");

function submitOrder() {
  orderError.value = "";
  if (!orderForm.stationId) {
    orderError.value = "请选择目标站点";
    return;
  }
  if (orderForm.loadTemp < -40 || orderForm.mileage <= 0 || orderForm.tons <= 0) {
    orderError.value = "请核对吨数、装车温度与里程";
    return;
  }
  store.addOrder({ ...orderForm });
  orderForm.notes = "";
}
</script>

<template>
  <section class="panel register">
    <h2>资料登记</h2>
    <nav class="tabs">
      <button type="button" :class="{ active: tab === 'vehicle' }" @click="tab = 'vehicle'">车辆分仓</button>
      <button type="button" :class="{ active: tab === 'station' }" @click="tab = 'station'">站点</button>
      <button type="button" :class="{ active: tab === 'order' }" @click="tab = 'order'">配送单</button>
    </nav>

    <!-- 车辆登记 -->
    <form v-if="tab === 'vehicle'" class="form-grid" @submit.prevent="submitVehicle">
      <div class="form-row">
        <label>车牌<input v-model="vehicleForm.plate" placeholder="黑A·D8821" /></label>
        <label>司机<input v-model="vehicleForm.driver" placeholder="司机姓名" /></label>
      </div>
      <div class="bay-editor">
        <p class="sub-label">分仓与降温速度（℃/小时）</p>
        <div v-for="(bay, index) in bays" :key="index" class="form-row">
          <input v-model="bay.name" placeholder="分仓名称" />
          <input v-model.number="bay.coolRate" type="number" step="0.1" min="0.1" placeholder="降温速度" />
          <button type="button" class="danger tiny" @click="removeBay(index)">删仓</button>
        </div>
        <button type="button" class="secondary tiny" @click="addBay">＋ 增加分仓</button>
      </div>
      <p v-if="vehicleError" class="form-error">{{ vehicleError }}</p>
      <p v-if="vehicleDeleteError" class="form-error">{{ vehicleDeleteError }}</p>
      <button type="submit">登记车辆</button>

      <ul class="entry-list">
        <li v-for="vehicle in store.vehicles" :key="vehicle.id">
          <div>
            <strong>{{ vehicle.plate }}</strong>
            <span class="muted">{{ vehicle.driver || "未登记司机" }}</span>
          </div>
          <div class="chips">
            <span v-for="bay in vehicle.bays" :key="bay.id" class="chip">
              {{ bay.name }} · {{ bay.coolRate }}℃/h
            </span>
          </div>
          <button type="button" class="danger tiny" @click="deleteVehicle(vehicle.id)">删除</button>
        </li>
      </ul>
    </form>

    <!-- 站点登记 -->
    <form v-else-if="tab === 'station'" class="form-grid" @submit.prevent="submitStation">
      <div class="form-row">
        <label>站点名称<input v-model="stationForm.name" placeholder="城东站" /></label>
        <label>最低接收温度（℃）<input v-model.number="stationForm.minTemp" type="number" step="0.5" /></label>
      </div>
      <p v-if="stationError" class="form-error">{{ stationError }}</p>
      <p v-if="stationDeleteError" class="form-error">{{ stationDeleteError }}</p>
      <button type="submit">登记站点</button>

      <ul class="entry-list">
        <li v-for="station in store.stations" :key="station.id">
          <strong>{{ station.name }}</strong>
          <span class="chip warn">接收 ≥ {{ station.minTemp }}℃</span>
          <button type="button" class="danger tiny" @click="deleteStation(station.id)">删除</button>
        </li>
      </ul>
    </form>

    <!-- 配送单登记 -->
    <form v-else class="form-grid" @submit.prevent="submitOrder">
      <div class="form-row">
        <label>油品
          <select v-model="orderForm.fuel">
            <option v-for="fuel in FUELS" :key="fuel" :value="fuel">{{ fuel }}</option>
          </select>
        </label>
        <label>吨数<input v-model.number="orderForm.tons" type="number" min="0.1" step="0.1" /></label>
      </div>
      <div class="form-row">
        <label>装车温度（℃）<input v-model.number="orderForm.loadTemp" type="number" step="0.1" /></label>
        <label>里程（km）<input v-model.number="orderForm.mileage" type="number" min="1" step="1" /></label>
      </div>
      <label>目标站点
        <select v-model="orderForm.stationId" required>
          <option value="" disabled>请选择站点</option>
          <option v-for="station in store.stations" :key="station.id" :value="station.id">
            {{ station.name }}（接收 ≥ {{ station.minTemp }}℃）
          </option>
        </select>
      </label>
      <label>备注<textarea v-model="orderForm.notes" placeholder="路况、装卸要求等" /></label>
      <p v-if="orderError" class="form-error">{{ orderError }}</p>
      <button type="submit">登记配送单</button>

      <ul class="entry-list">
        <li v-for="order in store.pendingOrders.slice(0, 5)" :key="order.id">
          <strong>{{ order.code }}</strong>
          <span class="muted">{{ order.fuel }} · {{ order.mileage }}km · 装车 {{ order.loadTemp }}℃</span>
        </li>
      </ul>
    </form>
  </section>
</template>
