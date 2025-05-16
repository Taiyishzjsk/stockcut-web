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
              <van-icon name="delete" class="delete-icon" @click.stop="removePart(index)" />
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
            right-icon="question-o"
            @click-right-icon="showCuttingLossTooltip"
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

      <!-- 优化方案结果 -->
      <van-cell-group v-if="showResults" inset class="section results-container">
        <van-tabs v-model:active="activeTab" animated swipeable>
          <van-tab title="方案一" name="plan1">
            <div class="plan-container">
              <van-card
                  v-for="(solution, index) in plan1"
                  :key="'solution1-'+index"
                  :title="`材料 ${index + 1} (${solution.length}mm)`"
                  :desc="solution.parts"
                  class="solution-card"
              >
                <template #tags>
                  <van-tag type="primary" size="medium" round>利用率: {{ solution.utilizationRate }}%</van-tag>
                </template>
              </van-card>
              <div class="total-rate">
                材料总利用率: <span class="rate-value">{{ plan1UtilizationRate }}%</span>
              </div>
            </div>
          </van-tab>

          <van-tab title="方案二" name="plan2">
            <div class="plan-container">
              <van-card
                  v-for="(solution, index) in plan2"
                  :key="'solution2-'+index"
                  :title="`材料 ${index + 1} (${solution.length}mm)`"
                  :desc="solution.parts"
                  class="solution-card"
              >
                <template #tags>
                  <van-tag type="success" size="medium" round>利用率: {{ solution.utilizationRate }}%</van-tag>
                </template>
              </van-card>
              <div class="total-rate">
                材料总利用率: <span class="rate-value">{{ plan2UtilizationRate }}%</span>
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

    <!-- 全局消息提示 -->
    <van-toast id="van-toast" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { showToast } from 'vant';

// 数据
const materials = ref([]);
const parts = ref([]);
const cuttingLoss = ref('3');
const showMaterialPopup = ref(false);
const showPartPopup = ref(false);
const newMaterial = ref({ length: '', quantity: '' });
const newPart = ref({ length: '', quantity: '' });
const showResults = ref(false);
const activeTab = ref('plan1');
const plan1 = ref([]);
const plan2 = ref([]);
const plan1UtilizationRate = ref(0);
const plan2UtilizationRate = ref(0);
const showCuttingTooltip = ref(false);

// 方法
function showAddMaterial() {
  newMaterial.value = { length: '', quantity: '' };
  showMaterialPopup.value = true;
}

function showAddPart() {
  newPart.value = { length: '', quantity: '' };
  showPartPopup.value = true;
}

function addMaterial() {
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

function addPart() {
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

function removeMaterial(index) {
  materials.value.splice(index, 1);
  showToast('已删除');
}

function removePart(index) {
  parts.value.splice(index, 1);
  showToast('已删除');
}

function showCuttingLossTooltip() {
  showCuttingTooltip.value = true;
}

// 一维下料优化算法实现
function optimizeCutting(stockLengths, partLengths, cutWidth) {
  // 在这里实现真实的下料优化算法
  // 这里只是一个模拟示例

  // 返回两种优化方案
  return {
    plan1: [
      {
        length: stockLengths[0].length,
        parts: '3x 500mm + 2x 300mm',
        utilizationRate: 85
      },
      {
        length: stockLengths[0].length,
        parts: '2x 600mm + 1x 400mm',
        utilizationRate: 80
      }
    ],
    plan2: [
      {
        length: stockLengths[0].length,
        parts: '2x 600mm + 1x 500mm',
        utilizationRate: 90
      },
      {
        length: stockLengths[0].length,
        parts: '3x 400mm + 1x 300mm',
        utilizationRate: 75
      }
    ],
    plan1Rate: 83,
    plan2Rate: 85
  };
}

function calculate() {
  if (materials.value.length === 0 || parts.value.length === 0) {
    showToast('请先添加原材料和切割零件');
    return;
  }

  // 开始优化计算
  const result = optimizeCutting(
      materials.value,
      parts.value,
      Number(cuttingLoss.value) || 0
  );

  plan1.value = result.plan1;
  plan2.value = result.plan2;
  plan1UtilizationRate.value = result.plan1Rate;
  plan2UtilizationRate.value = result.plan2Rate;

  showResults.value = true;
  showToast('计算完成');
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
  color: #ee0a24;
  font-size: 18px;
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

.unit-text {
  color: #969799;
  font-size: 14px;
}
</style>