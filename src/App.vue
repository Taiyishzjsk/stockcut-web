<!-- App.vue 文件 -->
<template>
  <div class="app-container">
    <van-nav-bar title="一维下料优化计算器" fixed />

    <div class="content-container">
      <!-- 原材料部分 -->
      <van-cell-group inset class="section">
        <van-cell title="原材料" is-link @click="showMaterialPopup = true">
          <template #right-icon>
            <van-button type="primary" size="mini" icon="plus" round @click.stop="showAddMaterial" />
          </template>
        </van-cell>

        <template v-if="materials.length > 0">
          <van-cell v-for="(material, index) in materials" :key="'material-'+index">
            <template #title>
              <div class="item-content">
                <span>长度: {{ material.length }}mm</span>
                <span>数量: {{ material.quantity }}根</span>
              </div>
            </template>
            <template #right-icon>
              <van-icon name="close" class="delete-icon" @click.stop="removeMaterial(index)" />
            </template>
          </van-cell>
        </template>
        <van-empty v-else description="尚未添加原材料" />
      </van-cell-group>

      <!-- 切割零件部分 -->
      <van-cell-group inset class="section">
        <van-cell title="切割零件" is-link @click="showPartPopup = true">
          <template #right-icon>
            <van-button type="primary" size="mini" icon="plus" round @click.stop="showAddPart" />
          </template>
        </van-cell>

        <template v-if="parts.length > 0">
          <van-cell v-for="(part, index) in parts" :key="'part-'+index">
            <template #title>
              <div class="item-content">
                <span>长度: {{ part.length }}mm</span>
                <span>数量: {{ part.quantity }}个</span>
              </div>
            </template>
            <template #right-icon>
              <van-icon name="close" class="delete-icon" @click.stop="removePart(index)" />
            </template>
          </van-cell>
        </template>
        <van-empty v-else description="尚未添加切割零件" />
      </van-cell-group>

      <!-- 切口长度部分 -->
      <van-cell-group inset class="section">
        <van-field
            v-model="cuttingLoss"
            type="digit"
            label="切口长度"
            label-width="100px"
            placeholder="请输入切口损耗"
            input-align="right"
            left-icon="question-o"
            @click-left-icon="showCuttingLossTooltip"
        >
          <template #button>
            <span class="unit-text">mm</span>
          </template>
        </van-field>
      </van-cell-group>

      <!-- 计算按钮 -->
      <div class="action-buttons">
        <van-button type="primary" block round size="large" @click="calculate">
          开始计算
        </van-button>
      </div>
      <!-- 重置按钮 -->
      <div class="action-buttons">
        <van-button type="default" block round size="large" @click="openResetDialog">
          重置
        </van-button>
      </div>

      <!-- 优化方案结果 -->
      <van-cell-group v-if="showResults" inset class="section results-container">
          <van-tabs animated swipeable>
            <van-tab title="优化结果">
              <div class="plan-container">
                <van-card
                    v-for="(solution, index) in calculatedPlans"
                    :key="'solution-'+index"
                    :title="`材料 ${solution.length}mm (使用 ${solution.count} 根)`"
                    :desc="solution.parts"
                    class="solution-card"
                >
                  <template #tags>
                    <van-tag type="primary" size="medium" round>利用率: {{ solution.utilizationRate }}%</van-tag>
                    <van-tag type="danger" size="medium" round style="margin-left: 5px">浪费: {{ solution.waste }}mm/根</van-tag>
                  </template>
                </van-card>

                <div v-if="optimizationResult" class="summary-container">
                  <div class="summary-title">汇总信息</div>
                  <div class="summary-content">
                    <div class="summary-item">
                      <span class="item-label">总浪费:</span>
                      <span class="item-value">{{ optimizationResult.summary.totalWaste }}mm</span>
                    </div>
                    <div class="summary-item">
                      <span class="item-label">切口损耗:</span>
                      <span class="item-value">{{ optimizationResult.summary.totalCutLoss }}mm</span>
                    </div>
                    <div class="summary-item">
                      <span class="item-label">使用材料:</span>
                      <span class="item-value">{{ optimizationResult.summary.totalStockUsed / 1000 }}m</span>
                    </div>
                  </div>
                </div>
              </div>


          </van-tab>
        </van-tabs>
      </van-cell-group>
    </div>

    <!-- 添加原材料对话框 -->
    <van-popup v-model:show="showMaterialPopup" position="bottom" round close-on-click-overlay>
      <div class="popup-header">
        <div class="popup-title">添加原材料</div>
        <van-icon name="cross" class="close-icon" @click="showMaterialPopup = false" />
      </div>
      <div class="popup-content">
        <van-form @submit="addMaterial">
          <van-cell-group inset>
            <van-field
                v-model="newMaterial.length"
                type="digit"
                name="length"
                label="长度"
                placeholder="输入长度"
                required
                :rules="[{ required: true, message: '请输入长度' }]"
            >
              <template #button>
                <span class="unit-text">mm</span>
              </template>
            </van-field>

            <van-field
                v-model="newMaterial.quantity"
                type="digit"
                name="quantity"
                label="数量"
                placeholder="输入数量"
                required
                :rules="[{ required: true, message: '请输入数量' }]"
            >
              <template #button>
                <span class="unit-text">根</span>
              </template>
            </van-field>
          </van-cell-group>

          <div class="popup-buttons">
            <van-button round block type="primary" native-type="submit">
              确认添加
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 添加切割零件对话框 -->
    <van-popup v-model:show="showPartPopup" position="bottom" round close-on-click-overlay>
      <div class="popup-header">
        <div class="popup-title">添加切割零件</div>
        <van-icon name="cross" class="close-icon" @click="showPartPopup = false" />
      </div>
      <div class="popup-content">
        <van-form @submit="addPart">
          <van-cell-group inset>
            <van-field
                v-model="newPart.length"
                type="digit"
                name="length"
                label="长度"
                placeholder="输入长度"
                required
                :rules="[{ required: true, message: '请输入长度' }]"
            >
              <template #button>
                <span class="unit-text">mm</span>
              </template>
            </van-field>

            <van-field
                v-model="newPart.quantity"
                type="digit"
                name="quantity"
                label="数量"
                placeholder="输入数量"
                required
                :rules="[{ required: true, message: '请输入数量' }]"
            >
              <template #button>
                <span class="unit-text">个</span>
              </template>
            </van-field>
          </van-cell-group>

          <div class="popup-buttons">
            <van-button round block type="primary" native-type="submit">
              确认添加
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 切口损耗提示弹出框 -->
    <van-dialog
        v-model:show="showCuttingTooltip"
        title="切口长度说明"
        confirm-button-text="我知道了"
        confirm-button-color="#1989fa"
    >
      <div class="tooltip-content">
        切口长度是指每次切割时损失的材料长度，通常由切割工具的宽度决定。在优化计算时会考虑这个损耗。
      </div>
    </van-dialog>

  <!--重置确认对话框-->
    <van-dialog
        v-model:show="showResetConfirmDialog"
        title="确认重置"
        show-cancel-button
        :close-on-click-overlay="false"
        @confirm="resetForm"
    >
      <div style="padding: 16px;">
        确定要重置所有输入吗？此操作将清空原材料、切割零件等信息。
      </div>
    </van-dialog>
    <!-- 全局消息提示 -->
    <van-toast id="van-toast" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {showSuccessToast, showToast} from 'vant';
import {solveCuttingProblem} from './utils/cutting_stock_solver_heuristic.ts'
import type { StockCutPlan, CutResult} from './utils/cutting_stock_types.ts';
import {showFailToast} from "vant/lib/toast/function-call";
// 定义接口
interface Material {
  length: number;
  quantity: number;
}

interface Part {
  length: number;
  quantity: number;
}


// 算法计算结果接口
interface OptimizationResult {
  plans: StockCutPlan[];
  summary: {
    totalStockUsed: number;
    totalCutLoss: number;
    totalWaste: number;
    isOrderFulfilled: boolean;
  };
}

// 转换后要展示的方案接口
interface Solution {
  length: number;
  parts: string;
  utilizationRate: number;
  waste: number;
  count: number;
}

// 数据
const materials = ref<Material[]>([]);
const parts = ref<Part[]>([]);
const cuttingLoss = ref<string>(null);
const showMaterialPopup = ref<boolean>(false);
const showPartPopup = ref<boolean>(false);
const newMaterial = ref<{length: string; quantity: string}>({ length: '', quantity: '' });
const newPart = ref<{length: string; quantity: string}>({ length: '', quantity: '' });
const showResults = ref<boolean>(false);
const optimizationResult = ref<OptimizationResult | null>(null);
const showCuttingTooltip = ref<boolean>(false);
const showResetConfirmDialog = ref<boolean>(false);

function openResetDialog(): void {
  showResetConfirmDialog.value = true;
}

function resetForm(): void {
  // 清空原材料和切割零件列表
  materials.value = [];
  parts.value = [];

  // 重置输入框中的切口长度为默认值
  cuttingLoss.value = null;

  // 隐藏计算结果
  showResults.value = false;
  optimizationResult.value = null;

  showToast('已重置');
}

const calculatedPlans = computed<Solution[]>(() => {
  if (!optimizationResult.value) return [];
  const plans : StockCutPlan[] = optimizationResult.value.plans;
  let temp: Solution[] = [];
  for (const plan of plans) {
    // 把切割方案改成 长度*数量 + 长度*数量的形式输出
    let str : string = '';
    for(let i=0;i<plan.cutLengths.length;i++){
      str += `${plan.cutLengths[i]} * ${plan.cutCounts[i]}`;
      if(i<plan.cutLengths.length-1){
        str += ' + ';
      }
    }
    let solution : Solution = {
      length: plan.stockLength,
      parts: str,
      utilizationRate: plan.avgWaste,
      waste: plan.totalWaste,
      count: plan.count
    };
    temp.push(solution);
  }
  return temp;
});
// 输入数据
let stockLengths: number[] = [];
let stockCounts: number[] = [];
let orderLengths: number[] = [];
let orderCounts: number[] = [];
let cutWidth: number = 0;

// 输出数据
let cutResult1: CutResult | null = null;
// 方法
function showAddMaterial(): void {
  newMaterial.value = { length: '', quantity: '' };
  showMaterialPopup.value = true;
}

function showAddPart(): void {
  newPart.value = { length: '', quantity: '' };
  showPartPopup.value = true;
}

function addMaterial(): void {
  if (newMaterial.value.length && newMaterial.value.quantity) {
    materials.value.push({
      length: Number(newMaterial.value.length),
      quantity: Number(newMaterial.value.quantity)
    });
    newMaterial.value = { length: '', quantity: '' };
    showMaterialPopup.value = false;
    showToast('原材料添加成功');
  }
}

function addPart(): void {
  if (newPart.value.length && newPart.value.quantity) {
    parts.value.push({
      length: Number(newPart.value.length),
      quantity: Number(newPart.value.quantity)
    });
    newPart.value = { length: '', quantity: '' };
    showPartPopup.value = false;
    showToast('切割零件添加成功');
  }
}

function removeMaterial(index: number): void {
  materials.value.splice(index, 1);
  showToast('已删除');
}

function removePart(index: number): void {
  parts.value.splice(index, 1);
  showToast('已删除');
}

function showCuttingLossTooltip(): void {
  showCuttingTooltip.value = true;
}

// 一维下料优化算法实现


function init(): void {
  // 原材料长度列表和数量列表
  stockLengths = materials.value.map(m => m.length);
  stockCounts = materials.value.map(m => m.quantity);

  // 订单长度列表和数量列表
  orderLengths = parts.value.map(p => p.length);
  orderCounts = parts.value.map(p => p.quantity);

  // 切口宽度
  cutWidth = Number(cuttingLoss.value) || 0;
}

function calculate(): void {
  if (materials.value.length === 0 || parts.value.length === 0) {
    showToast('请先添加原材料和切割零件');
    return;
  }

  init();
  cutResult1 = solveCuttingProblem(
      stockLengths,
      stockCounts,
      orderLengths,
      orderCounts,
      cutWidth
  );
  optimizationResult.value = {
    plans: cutResult1.plans,
    summary: cutResult1.summary
  };
  if(! cutResult1.summary.isOrderFulfilled){
    showFailToast('订单无法满足');
    return;
  }
  showResults.value = true;
  showSuccessToast('计算完成');
}
</script>

<style>
/* 导入Vant样式 */
@import 'vant/lib/index.css';

/* 全局样式 */
:root {
  --van-primary-color: #1989fa;
  --van-success-color: #07c160;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Segoe UI, Arial, Roboto, "PingFang SC", "miui", "Hiragino Sans GB", "Microsoft Yahei", sans-serif;
  background-color: #f7f8fa;
  margin: 0;
  padding: 0;
}

.app-container {
  min-height: 100vh;
  padding-bottom: 20px;
}

.content-container {
  padding: 56px 12px 20px;
}

.section {
  margin-bottom: 12px;
}

.item-content {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.delete-icon {
  margin: 3.5px 4px 3.5px 8px; /* 上 右 下 左 */
  vertical-align: middle;
  font-size: 18px;
  color: #ee0a24;
}

.action-buttons {
  margin: 20px 0;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f2f2f2;
}

.popup-title {
  font-size: 16px;
  font-weight: bold;
}

.close-icon {
  font-size: 18px;
}

.popup-content {
  padding: 16px;
}

.popup-buttons {
  margin-top: 24px;
  padding: 0 12px;
}

.tooltip-content {
  padding: 16px;
  line-height: 1.5;
  color: #666;
}

.results-container {
  margin-top: 24px;
}

.plan-container {
  padding: 12px;
}

.solution-card {
  margin-bottom: 12px;
  background-color: #fff;
}

.total-rate {
  text-align: center;
  padding: 16px;
  font-weight: bold;
  color: #323233;
}

.rate-value {
  color: var(--van-primary-color);
  font-size: 18px;
}

.summary-container {
  margin-top: 20px;
  padding: 16px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-title {
  font-size: 16px;
  font-weight: bold;
  color: #323233;
  margin-bottom: 12px;
  border-bottom: 1px solid #ebedf0;
  padding-bottom: 8px;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-label {
  color: #646566;
}

.item-value {
  font-weight: 500;
}

.highlight {
  color: var(--van-primary-color);
  font-size: 16px;
  font-weight: bold;
}

.success {
  color: var(--van-success-color);
  font-weight: bold;
}

.error {
  color: var(--van-danger-color);
  font-weight: bold;
}
</style>