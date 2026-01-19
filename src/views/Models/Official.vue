<template>
  <div class="official-panel">
    <div class="panel-top">
      <div>
        <div class="panel-title">Official Model Catalog</div>
        <div class="panel-subtitle">Start from Ultralytics pre-trained models.</div>
      </div>
      <div class="dataset-chip" v-if="selectedProject">
        <span class="label">Dataset</span>
        <span class="value">{{ datasetLabel }}</span>
      </div>
    </div>

    <div class="arch-section">
      <div class="section-title">Detection Architectures</div>
      <div v-if="archLoading" class="arch-state">
        <i class="el-icon-loading"></i>
        <span>Loading architectures...</span>
      </div>
      <div v-else-if="archError" class="arch-state error">
        <i class="el-icon-warning"></i>
        <span>{{ archError }}</span>
        <el-button size="mini" type="primary" @click="reloadArchitectures" style="margin-left: 10px">Retry</el-button>
      </div>
      <div v-else class="arch-groups">
        <div v-for="group in architectureGroups" :key="group.family" class="arch-group">
          <div class="group-title">{{ group.family }}</div>
          <div class="group-list">
            <button
              v-for="arch in group.items"
              :key="arch.arch_id || arch.model_variant"
              :class="['arch-chip', { active: selectedModel === arch.model_variant }]"
              @click="onSelectArchitecture(arch)"
            >
              {{ formatVariant(arch.model_variant) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Accuracy</div>
        <div class="metric-value">{{ accuracyLabel }}%</div>
        <div class="metric-bar">
          <div class="metric-fill" :style="{ width: accuracyWidth + '%' }"></div>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Speed</div>
        <div class="metric-value">{{ speedLabel }}ms</div>
        <div class="metric-bar">
          <div class="metric-fill" :style="{ width: speedWidth + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="advanced-panel">
      <button class="advanced-toggle" type="button" @click="showAdvancedModelConfiguration">
        <span>Advanced settings</span>
        <span class="chevron" :class="{ open: isRotated }"></span>
      </button>
      <div v-show="isRotated" class="advanced-grid">
        <div class="field-row">
          <div class="field-label">Pretrained weights</div>
          <el-switch v-model="pretrainedEnabled"></el-switch>
        </div>
        <div class="field-row">
          <div class="field-label">Epochs</div>
          <el-input v-model="epochs" size="small" placeholder="100" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">Image size</div>
          <el-input v-model="imgSize" size="small" placeholder="640" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">Patience</div>
          <el-input v-model="patience" size="small" placeholder="100" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">Learning rate</div>
          <el-input v-model="learningRate" size="small" placeholder="0.01" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">Device</div>
          <div class="device-toggle">
            <button @click="selectedDevice = 'Auto'" :class="{ active: selectedDevice === 'Auto' }">Auto</button>
            <button @click="selectedDevice = 'GPU'" :class="{ active: selectedDevice === 'GPU' }">GPU</button>
            <button @click="selectedDevice = 'CPU'" :class="{ active: selectedDevice === 'CPU' }">CPU</button>
          </div>
        </div>
        <div class="field-row">
          <div class="field-label">Batch size</div>
          <el-input v-model="batchSize" size="small" placeholder="16" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">Optimizer</div>
          <el-select v-model="optimizer" size="small" placeholder="Select">
            <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value"></el-option>
          </el-select>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { referenceStore, loadArchitectures } from "@/store/referenceStore";

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
      ref: referenceStore,
      selectedModel: null,
      selectedArchitectureId: null,
      isRotated: false,
      epochs: "100",
      imgSize: "640",
      patience: "100",
      learningRate: "0.01",
      selectedDevice: "Auto",
      batchSize: "16",
      options: [
        { value: "Auto", label: "Auto" },
        { value: "Adam", label: "Adam" },
        { value: "AdamW", label: "AdamW" },
        { value: "SGD", label: "SGD" }
      ],
      optimizer: "Auto",
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
    datasetLabel() {
      return this.selectedProject?.dataset?.dataset_name || "No dataset linked";
    },
    archLoading() {
      return !!this.ref?.loading?.architectures;
    },
    archError() {
      return this.ref?.error?.architectures || "";
    },
    architectureGroups() {
      const list = Array.isArray(this.ref?.architectures) ? this.ref.architectures : [];

      const detected = list.filter((it) => {
        const tt = String(it?.task_type || "").toLowerCase();
        return !tt || tt === "detection";
      });

      const fallbackFamily = "YOLOv8";
      const fallbackItems = [
        { model_variant: "yolov8n" },
        { model_variant: "yolov8s" },
        { model_variant: "yolov8m" },
        { model_variant: "yolov8l" },
        { model_variant: "yolov8x" }
      ];

      const items = detected.length ? detected : fallbackItems;
      const map = {};
      items.forEach((it) => {
        const fam = it.model_family || it.family || fallbackFamily || "Uncategorized";
        (map[fam] = map[fam] || []).push(it);
      });

      const sizeOrder = { n: 0, s: 1, m: 2, l: 3, x: 4 };
      const sizeRank = (variant = "") => {
        const base = String(variant || "").replace(/-(cls|seg)$/i, "");
        const letter = base.slice(-1).toLowerCase();
        return letter in sizeOrder ? sizeOrder[letter] : 999;
      };

      return Object.entries(map)
        .sort((a, b) => {
          if (a[0] === "Uncategorized") return 1;
          if (b[0] === "Uncategorized") return -1;
          return String(a[0]).localeCompare(String(b[0]), "en");
        })
        .map(([family, arr]) => ({
          family,
          items: arr.slice().sort((a, b) => {
            const sa = sizeRank(a.model_variant);
            const sb = sizeRank(b.model_variant);
            if (sa !== sb) return sa - sb;
            return String(a.model_variant || "").localeCompare(String(b.model_variant || ""), "en");
          })
        }));
    },
    metrics() {
      const def = { accuracy: 37.3, speedMs: 80.4 };
      if (!this.selectedModel) return def;
      const key = this.formatVariantKey(this.selectedModel);
      return this.modelMetrics[key] || def;
    },
    currentSeriesKey() {
      const m = this.formatVariantKey(this.selectedModel);
      if (/^YOLO11/.test(m)) return "YOLO11";
      if (/^YOLOv8/.test(m)) return "YOLOv8";
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
      const visMin = 15;
      const visMax = 90;
      const pct = visMin + normalized * (visMax - visMin);
      return Math.max(0, Math.min(100, pct));
    },
    speedWidth() {
      const ms = Number(this.metrics.speedMs) || 0;
      const minMs = Number(this.seriesMinSpeedMs);
      const maxMs = Number(this.seriesMaxSpeedMs);
      const range = maxMs - minMs;
      if (range <= 0) return 50;
      const normalized = (maxMs - ms) / range;
      const visMin = 15;
      const visMax = 90;
      const pct = visMin + normalized * (visMax - visMin);
      return Math.max(0, Math.min(100, pct));
    }
  },
  watch: {
    "ref.architectures": {
      handler() {
        this.ensureDefaultModel();
      },
      immediate: true
    },
    selectedModel(newModel) {
      if (newModel) {
        this.$emit("model-selected", {
          model: newModel,
          architecture_id: this.selectedArchitectureId || null
        });
      }
    },
    epochs() {
      this.emitConfigChange();
    },
    imgSize() {
      this.emitConfigChange();
    },
    patience() {
      this.emitConfigChange();
    },
    learningRate() {
      this.emitConfigChange();
    },
    batchSize() {
      this.emitConfigChange();
    },
    selectedDevice() {
      this.emitConfigChange();
    },
    optimizer() {
      this.emitConfigChange();
    },
    pretrainedEnabled() {
      this.emitConfigChange();
    }
  },
  methods: {
    reloadArchitectures() {
      loadArchitectures({ force: true });
    },
    ensureDefaultModel() {
      if (this.selectedModel) return;
      const first = this.architectureGroups?.[0]?.items?.[0];
      if (first) this.onSelectArchitecture(first);
    },
    onSelectArchitecture(arch) {
      this.selectedArchitectureId = arch?.arch_id || arch?.architecture_id || arch?.id || null;
      this.selectedModel = arch?.model_variant || null;
    },
    formatVariantKey(v) {
      const s = String(v || "").trim();
      if (!s) return "";
      return s.replace(/^yolo/i, "YOLO");
    },
    formatVariant(v) {
      return this.formatVariantKey(v);
    },
    showAdvancedModelConfiguration() {
      this.isRotated = !this.isRotated;
    },
    emitConfigChange() {
      const configData = {
        epochs: parseInt(this.epochs, 10) || 100,
        img_size: parseInt(this.imgSize, 10) || 640,
        patience: parseInt(this.patience, 10) || 100,
        learning_rate: parseFloat(this.learningRate) || 0.01,
        batch_size: parseInt(this.batchSize, 10) || 16,
        device: this.getDeviceValue(),
        optimizer: String(this.optimizer || "auto").toLowerCase(),
        use_pretrained: this.pretrainedEnabled,
        dataset_name: this.selectedProject?.dataset?.dataset_name || ""
      };

      this.$emit("config-changed", configData);
    },
    getDeviceValue() {
      switch (this.selectedDevice) {
        case "GPU":
          return "0";
        case "CPU":
          return "cpu";
        default:
          return "0";
      }
    }
  },
  mounted() {
    loadArchitectures();
    this.ensureDefaultModel();
    this.$nextTick(() => {
      this.emitConfigChange();
    });
  }
};
</script>

<style scoped>
.official-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: #111315;
  width: 100%;
  max-width: 100%;
}

.panel-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
}

.panel-subtitle {
  font-size: 13px;
  color: #6a7482;
  margin-top: 4px;
}

.dataset-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(79, 99, 199, 0.1);
  color: #2b3a67;
  font-size: 12px;
}

.dataset-chip .label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 10px;
}

.arch-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #3e4a5b;
}

.arch-state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6a7482;
  font-size: 12px;
}

.arch-state.error {
  color: #d64545;
}

.arch-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.arch-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6a7482;
}

.group-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.arch-chip {
  border: 1px solid #e4e7ee;
  background: #f6f7fb;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: #3e4a5b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.arch-chip:hover {
  border-color: #9bb0ff;
  color: #2b3a67;
}

.arch-chip.active {
  background: rgba(79, 99, 199, 0.18);
  border-color: #4f63c7;
  color: #2b3a67;
  box-shadow: 0 6px 14px rgba(79, 99, 199, 0.2);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.metric-card {
  background: #f7f8fc;
  border-radius: 14px;
  padding: 12px;
}

.metric-label {
  font-size: 11px;
  color: #6a7482;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  margin-top: 6px;
  color: #111315;
}

.metric-bar {
  margin-top: 8px;
  height: 10px;
  background: #e4e7ee;
  border-radius: 999px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f63c7, #9bb0ff);
  transition: width 0.4s ease;
}

.advanced-panel {
  border-top: 1px solid #e4e7ee;
  padding-top: 12px;
}

.advanced-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #2b3a67;
  cursor: pointer;
  padding: 6px 0;
}

.chevron {
  width: 10px;
  height: 10px;
  border-right: 2px solid #4f63c7;
  border-bottom: 2px solid #4f63c7;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}

.chevron.open {
  transform: rotate(-135deg);
}

.advanced-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f6f7fb;
  border: 1px solid #e4e7ee;
}

.field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6a7482;
}

.field-input ::v-deep .el-input__inner {
  border-radius: 10px;
}

.device-toggle {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}

.device-toggle button {
  border: 1px solid #e4e7ee;
  background: #fff;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: #3e4a5b;
  transition: all 0.2s ease;
}

.device-toggle button.active {
  background: #4f63c7;
  border-color: #4f63c7;
  color: #fff;
}

@media (max-width: 720px) {
  .panel-top {
    flex-direction: column;
    align-items: flex-start;
  }
  .advanced-grid {
    grid-template-columns: 1fr;
  }
}
</style>
