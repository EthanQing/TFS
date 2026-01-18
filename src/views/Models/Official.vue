<template>
  <div class="Official">
    <div class="description">从官方的Ultralytics预训练模型开始训练</div>

    <!-- 显示关联的数据集信息 -->
    <div class="dataset-info" v-if="selectedProject">
      <span class="dataset-label">关联数据集:</span>
      <span class="dataset-name">{{ selectedProject.dataset.dataset_name || '未关联数据集' }}</span>
    </div>

    <div class="detectArchitecture">检测架构</div>
    <div class="showModelArchitectureList">
      <ul>
        <div>YOLO11</div>
        <div class="list">
          <li v-for="model in [
            'YOLO11n',
            'YOLO11s',
            'YOLO11m',
            'YOLO11l',
            'YOLO11x',
          ]" :key="model" :class="{ active: selectedModel === model }" @click="selectedModel = model">
            {{ model }}
          </li>
        </div>
      </ul>
      <ul>
        <div>YOLOv8</div>
        <div class="list">
          <li v-for="model in [
            'YOLOv8n',
            'YOLOv8s',
            'YOLOv8m',
            'YOLOv8l',
            'YOLOv8x',
          ]" :key="model" :class="{ active: selectedModel === model }" @click="selectedModel = model">
            {{ model }}
          </li>
        </div>
      </ul>
      <!-- <ul>
        <div>YOLOv5u</div>
        <div class="list">
          <li
            v-for="model in [
              'YOLOv5nu',
              'YOLOv5su',
              'YOLOv5mu',
              'YOLOv5lu',
              'YOLOv5xu',
            ]"
            :key="model"
            :class="{ active: selectedModel === model }"
            @click="selectedModel = model"
          >
            {{ model }}
          </li>
        </div>
      </ul>
      <ul>
        <div>YOLOv5u6</div>
        <div class="list">
          <li
            v-for="model in [
              'YOLOv5n6u',
              'YOLOv5s6u',
              'YOLOv5m6u',
              'YOLOv5l6u',
              'YOLOv5x6u',
            ]"
            :key="model"
            :class="{ active: selectedModel === model }"
            @click="selectedModel = model"
          >
            {{ model }}
          </li>
        </div>
      </ul> -->
    </div>
    <div class="value">
      <div class="Accuracy">
        <div class="AccuracyTitle">Accuracy -{{ accuracyLabel }}%</div>
        <div class="progress-container">
          <div class="AccuracyValue" :style="{ width: accuracyWidth + '%' }"></div>
        </div>
      </div>
      <div class="Speed">
        <div class="SpeedTitle">Speed -{{ speedLabel }}ms</div>
        <div class="progress-container">
          <div class="SpeedValue" :style="{ width: speedWidth + '%' }"></div>
        </div>
      </div>
    </div>
    <div class="ModelConfiguration">
      <div class="ModelConfigurationTitle" @click="showAdvancedModelConfiguration">
        <div class="arrow" :class="{ rotated: isRotated }"></div>
        <div>高级模型配置</div>
      </div>
    </div>
    <div class="AdvancedModelConfiguration" v-show="isRotated">
      <div class="PreTrained">
        <span>预训练</span>
        <label class="switch">
          <input type="checkbox" :checked="pretrainedEnabled" @change="handlePretrainedChange" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="Epochs">
        <span>训练轮数</span>
        <el-input v-model="input1" placeholder="请输入内容" class="ElInput"></el-input>
      </div>
      <div class="ImageSize">
        <span>图像大小</span>
        <el-input v-model="input2" placeholder="请输入内容" class="ElInput"></el-input>
      </div>
      <div class="Patience">
        <span>耐心值</span>
        <el-input v-model="input3" placeholder="请输入内容" class="ElInput"></el-input>
      </div>
      <div class="LearningRate">
        <span>学习率</span>
        <el-input v-model="input4" placeholder="请输入内容" class="ElInput"></el-input>
      </div>
      <div class="Device">
        <span>设备</span>
        <div class="DeviceSelect">
          <button @click="selectedDevice = '默认'" :class="{ active: selectedDevice === '默认' }">
            默认
          </button>
          <button @click="selectedDevice = 'GPU'" :class="{ active: selectedDevice === 'GPU' }">
            GPU
          </button>
          <button @click="selectedDevice = 'CPU'" :class="{ active: selectedDevice === 'CPU' }">
            CPU
          </button>
        </div>
      </div>
      <div class="BatchSize">
        <span>批次大小</span>
        <el-input v-model="batchSize" placeholder="请输入内容" class="ElInput"></el-input>
      </div>
      <div class="Optimizer">
        <span>优化器</span>
        <el-select v-model="value" placeholder="请选择">
          <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value">
          </el-option>
        </el-select>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Official",
  props: {
    selectedProject: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      selectedModel: null, // 用于记录当前选中的模型
      isRotated: false,
      input1: "100",
      input2: "640",
      input3: "100",
      input4: "0.01",
      selectedDevice: "默认", // 记录选中的设备
      batchSize: "16",
      custom: "",
      options: [
        {
          value: "Auto",
          label: "Auto",
        },
        {
          value: "Adam",
          label: "Adam",
        },
        {
          value: "AdamW",
          label: "AdamW",
        },
        {
          value: "SGD",
          label: "SGD",
        },
      ],
      value: "Auto",
      pretrainedEnabled: true,
      modelMetrics: {
        YOLO11n: { accuracy: 35.0, speedMs: 6.1 },
        YOLO11s: { accuracy: 41.3, speedMs: 8.7 },
        YOLO11m: { accuracy: 45.9, speedMs: 12.4 },
        YOLO11l: { accuracy: 49.8, speedMs: 18.9 },
        YOLO11x: { accuracy: 51.2, speedMs: 24.7 },
        YOLOv8n: { accuracy: 37.3, speedMs: 7.2 },
        YOLOv8s: { accuracy: 43.5, speedMs: 10.8 },
        YOLOv8m: { accuracy: 47.6, speedMs: 15.9 },
        YOLOv8l: { accuracy: 50.4, speedMs: 22.5 },
        YOLOv8x: { accuracy: 52.1, speedMs: 29.8 }
      }
    };
  },
  computed: {
    metrics() {
      const def = { accuracy: 37.3, speedMs: 80.4 };
      if (!this.selectedModel) return def;
      return this.modelMetrics[this.selectedModel] || def;
    },
    currentSeriesKey() {
      const m = this.selectedModel || '';
      if (/^YOLO11/.test(m)) return 'YOLO11';
      if (/^YOLOv8/.test(m)) return 'YOLOv8';
      return null;
    },
    seriesModelEntries() {
      const all = Object.entries(this.modelMetrics || {});
      if (!this.currentSeriesKey) return all;
      return all.filter(([name]) => name.startsWith(this.currentSeriesKey));
    },
    seriesMetricsList() {
      return this.seriesModelEntries.map(([, v]) => v);
    },
    seriesTopAccuracy() {
      const list = this.seriesMetricsList;
      if (!list.length) return 100;
      return list.reduce((m, it) => Math.max(m, Number(it.accuracy) || 0), 0) || 100;
    },
    seriesMinAccuracy() {
      const vals = this.seriesMetricsList
        .map(m => Number(m.accuracy))
        .filter(v => Number.isFinite(v));
      if (!vals.length) return Number(this.metrics.accuracy) || 0;
      return Math.min(...vals);
    },
    seriesMinSpeedMs() {
      const vals = this.seriesMetricsList
        .map(m => Number(m.speedMs))
        .filter(v => Number.isFinite(v));
      if (!vals.length) return Number(this.metrics.speedMs) || 0;
      return Math.min(...vals);
    },
    seriesMaxSpeedMs() {
      const vals = this.seriesMetricsList
        .map(m => Number(m.speedMs))
        .filter(v => Number.isFinite(v));
      if (!vals.length) return Number(this.metrics.speedMs) || 0;
      return Math.max(...vals);
    },
    accuracyLabel() {
      return Number(this.metrics.accuracy).toFixed(1);
    },
    speedLabel() {
      return Number(this.metrics.speedMs).toFixed(1);
    },
    accuracyWidth() {
      const acc = Number(this.metrics.accuracy) || 0;
      const minAcc = Number(this.seriesMinAccuracy);
      const maxAcc = Number(this.seriesTopAccuracy) || 100;
      const range = maxAcc - minAcc;
      if (range <= 0) return 50;
      const normalized = (acc - minAcc) / range;
      const VIS_MIN = 15;
      const VIS_MAX = 90;
      const pct = VIS_MIN + normalized * (VIS_MAX - VIS_MIN);
      return Math.max(0, Math.min(100, pct));
    },
    speedWidth() {
      const ms = Number(this.metrics.speedMs) || 0;
      const minMs = Number(this.seriesMinSpeedMs);
      const maxMs = Number(this.seriesMaxSpeedMs);
      const range = maxMs - minMs;
      if (range <= 0) return 50;
      const normalized = (maxMs - ms) / range;
      const VIS_MIN = 15;
      const VIS_MAX = 90;
      const pct = VIS_MIN + normalized * (VIS_MAX - VIS_MIN);
      return Math.max(0, Math.min(100, pct));
    }
  },
  watch: {
    // 监听模型选择变化
    selectedModel(newModel) {
      if (newModel) {
        this.$emit('model-selected', {
          model: newModel
        });
      }
    },
    // 监听配置变化
    input1(newVal) {
      this.emitConfigChange();
    },
    input2(newVal) {
      this.emitConfigChange();
    },
    input3(newVal) {
      this.emitConfigChange();
    },
    input4(newVal) {
      this.emitConfigChange();
    },
    batchSize(newVal) {
      this.emitConfigChange();
    },
    selectedDevice(newVal) {
      this.emitConfigChange();
    },
    value(newVal) {
      this.emitConfigChange();
    },
    pretrainedEnabled(newVal) {
      this.emitConfigChange();
    }
  },
  methods: {
    showAdvancedModelConfiguration() {
      this.isRotated = !this.isRotated;
    },
    // 发送配置变化事件到父组件
    emitConfigChange() {
      const configData = {
        epochs: parseInt(this.input1) || 100,
        img_size: parseInt(this.input2) || 640,
        patience: parseInt(this.input3) || 100,
        learning_rate: parseFloat(this.input4) || 0.01,
        batch_size: parseInt(this.batchSize) || 16,
        device: this.getDeviceValue(),
        optimizer: this.value.toLowerCase(),
        use_pretrained: this.pretrainedEnabled,
        // 如果项目关联了数据集，自动填充
        dataset_name: this.selectedProject?.dataset.dataset_name || ''
      };

      this.$emit('config-changed', configData);
    },
    // 获取设备值
    getDeviceValue() {
      switch (this.selectedDevice) {
        case 'GPU':
          return '0';
        case 'CPU':
          return 'cpu';
        default:
          return '0';
      }
    },
    // 处理预训练开关变化
    handlePretrainedChange(event) {
      this.pretrainedEnabled = event.target.checked;
    }
  },
  mounted() {
    // 默认选择第一个检测架构并发送事件
    if (!this.selectedModel) {
      this.selectedModel = 'YOLO11n';
    }
    this.$emit('model-selected', { model: this.selectedModel });
    this.$nextTick(() => {
      this.emitConfigChange();
    });
  }
};
</script>

<style scoped>
.Official {
  margin-top: 10px;
  color: #111f68;
  width: 100%;
  max-width: 100%;
  max-height: calc(100vh - 220px);
  overflow: auto;
  /* padding: 0 16px; */
}

.description {
  margin-bottom: 10px;
}

/* 数据集信息样式 */
.dataset-info {
  background: #f8f9fa;
  border: 1px solid #e8ecef;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 15px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dataset-label {
  font-weight: 600;
  color: #111f68;
  font-size: 14px;
}

.dataset-name {
  color: #6c757d;
  font-size: 14px;
  font-style: italic;
}

.detectArchitecture {
  margin-bottom: 10px;
}

.showModelArchitectureList {
  width: 100%;
}

.showModelArchitectureList div {
  font-size: 12px;
  margin-bottom: 2px;
}

/* 模型选择样式 */
.showModelArchitectureList li {
  background-color: rgb(239, 239, 239);
  width: 85%;
  height: 45px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  box-sizing: border-box;
}

.showModelArchitectureList li.active {
  border: #111f68 2px solid;
}

.showModelArchitectureList li:hover {
  background-color: rgb(229, 229, 229);
}

.showModelArchitectureList .list {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 5px;
}

.showModelArchitectureList ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* 进度条样式 */
.value {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}
.value > div {
  flex: 1;
  min-width: 0;
}

.progress-container {
  width: 85%;
  height: 12px;
  background-color: rgb(239, 239, 239);
  border-radius: 4px;
  overflow: hidden;
}

.AccuracyValue,
.SpeedValue {
  height: 100%;
  background-color: #111f68;
  transition: width 0.5s ease-in-out;
  will-change: width;
}

.AccuracyTitle,
.SpeedTitle {
  margin-bottom: 5px;
  font-size: 12px;
}

/* 高级配置折叠面板 */
.ModelConfiguration {
  margin-top: 10px;
  display: flex;
  align-items: center;
  font-size: 16px;
}

.arrow {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 12px solid #111f68;
  margin-right: 5px;
  transition: transform 0.3s ease;
}

.rotated {
  transform: rotate(180deg);
}

.AdvancedModelConfiguration>div {
  width: 100%;
  height: 50px;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1px;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e0e0e0;
  transition: 0.4s;
  border-radius: 34px;
  border: 1px solid #e0e0e0;
}

.slider::before {
  position: absolute;
  content: "";
  height: 26px;
  width: 25px;
  left: 1px;
  bottom: -1px;
  background-color: #ffffff;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked+.slider {
  background-color: #111f68;
  border-color: #111f68;
}

input:checked+.slider::before {
  transform: translateX(31px);
  background-color: white;
}

/* 输入框样式 */
.ElInput {
  width: 100px;
}

/* 设备选择按钮组 */
.DeviceSelect {
  width: auto;
  height: 40px;
  background-color: #f4f4f4;
  border-radius: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.DeviceSelect button {
  background-color: #f4f4f4;
  color: #111f68;
  width: 48px;
  height: 36px;
  border-radius: 12px;
  margin: 1px 0px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.DeviceSelect button.active {
  background-color: #111f68;
  color: white;
}

.DeviceSelect button:first-child {
  margin-left: 4px;
}
.ModelConfigurationTitle{
  display: flex;
  align-items: center;
  cursor: pointer;
}

/* 响应式：中小屏处理 */
@media (max-width: 1024px) {
  .value {
    flex-direction: column;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .Official {
    max-width: 100%;
    max-height: calc(100vh - 180px);
  }
  .showModelArchitectureList li {
    width: auto;
  }
  .ElInput {
    width: 120px;
    max-width: 40vw;
  }
}

/* 栅格在不同屏宽下的列数 */
@media (max-width: 1200px) {
  .showModelArchitectureList .list {
    grid-template-columns: repeat(4, 1fr);
  }
}
@media (max-width: 900px) {
  .showModelArchitectureList .list {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 600px) {
  .showModelArchitectureList .list {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
