<template>
  <div class="official-panel">
    <div class="panel-top">
      <div>
        <div class="panel-title">官方模型目录</div>
      </div>
      <div class="dataset-chip" v-if="selectedProject">
        <span class="label">数据集</span>
        <span class="value">{{ datasetLabel }}</span>
      </div>
    </div>

    <div class="arch-section">
      <div class="section-title">{{ sectionTitle }}</div>
      <div v-if="archLoading" class="arch-state">
        <i class="el-icon-loading"></i>
        <span>加载架构中...</span>
      </div>
      <div v-else-if="archError" class="arch-state error">
        <i class="el-icon-warning"></i>
        <span>{{ archError }}</span>
        <el-button size="mini" type="primary" @click="reloadArchitectures" style="margin-left: 10px">重试</el-button>
      </div>
      <div v-else-if="architectureGroups.length" class="arch-tabbed">
        <!-- Family tabs -->
        <div class="family-tabs">
          <button
            v-for="group in architectureGroups"
            :key="group.family"
            :class="['family-tab', { active: selectedFamily === group.family }]"
            @click="onSelectFamily(group.family)"
          >
            {{ group.family }}
            <span class="tab-count">{{ group.items.length }}</span>
          </button>
        </div>
        <!-- Variant chips for selected family -->
        <div class="variant-chips">
          <button
            v-for="arch in selectedFamilyItems"
            :key="arch.arch_id || arch.model_variant"
            :class="['arch-chip', { active: selectedModel === arch.model_variant }]"
            @click="onSelectArchitecture(arch)"
          >
            {{ formatVariantShort(arch.model_variant) }}
          </button>
        </div>
      </div>
      <div v-else class="arch-state">
        <i class="el-icon-info"></i>
        <span>暂无可用架构</span>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">准确率</div>
        <div class="metric-value">{{ accuracyLabel }}%</div>
        <div class="metric-bar">
          <div class="metric-fill" :style="{ width: accuracyWidth + '%' }"></div>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">速度(ms)</div>
        <div class="metric-value">{{ speedLabel }}ms</div>
        <div class="metric-bar">
          <div class="metric-fill" :style="{ width: speedWidth + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="advanced-panel">
      <button class="advanced-toggle" type="button" @click="showAdvancedModelConfiguration">
        <span>高级设置</span>
        <span class="chevron" :class="{ open: isRotated }"></span>
      </button>
      <div v-show="isRotated" class="advanced-grid">


        <!-- Save Period -->
        <div class="field-row">
          <div class="field-label">预训练权重</div>
          <el-switch v-model="pretrainedEnabled"></el-switch>
        </div>
        <div class="field-row" v-if="pretrainedEnabled">
          <div class="field-label">上传预训练权重</div>
          <div class="upload-compact">
            <el-upload
              ref="pretrainUploader"
              action="#"
              :auto-upload="false"
              :on-change="handlePretrainFileChange"
              :show-file-list="false"
              :disabled="uploadingPretrain"
              accept=".pt,.pth,.ckpt,.pdparams"
              class="upload-hidden"
            >
              <el-button size="small" type="primary" :loading="uploadingPretrain" class="browse-btn">
                <i class="el-icon-folder-opened" v-if="!uploadingPretrain"></i>
                {{ uploadingPretrain ? '上传中...' : '选择文件' }}
              </el-button>
            </el-upload>
            <span v-if="pretrainedFileName" class="file-name" :title="pretrainedFileName">
              <i class="el-icon-document"></i>
              {{ pretrainedFileName }}
              <i class="el-icon-close remove-icon" @click="removePretrainFile"></i>
            </span>
            <span v-else class="file-hint">.pt / .pth / .ckpt / .pdparams</span>
          </div>
          <div v-if="pretrainUploadError" class="upload-error">{{ pretrainUploadError }}</div>
        </div>
        <div class="field-row">
          <div class="field-label">保存周期 (每隔X轮保存一次 【-1禁用】)</div>
          <el-input v-model="savePeriod" size="small" placeholder="-1" class="field-input">
             <template slot="append">Epochs</template>
          </el-input>
          <div style="font-size: 10px; color: #999; margin-top: 4px;"></div>
        </div>

        
        <div class="field-row">
          <div class="field-label">训练轮次</div>
          <el-input v-model="epochs" size="small" placeholder="100" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">图像尺寸</div>
          <el-input v-model="imgSize" size="small" placeholder="640" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">耐心值</div>
          <el-input v-model="patience" size="small" placeholder="100" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">学习率</div>
          <el-input v-model="learningRate" size="small" placeholder="0.01" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label-row">
            <span class="field-label">设备</span>
            <el-tooltip effect="dark" placement="top" content="默认使用单卡 GPU 0。多卡请用逗号分隔（如 0,1）。如需仅使用 CPU，请输入 cpu。">
              <i class="el-icon-question hint-icon"></i>
            </el-tooltip>
          </div>
          <el-input v-model="selectedDevice" size="small" placeholder="例: 0 或 0,1 或 cpu" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label-row">
            <span class="field-label">批次大小</span>
            <el-tooltip effect="dark" placement="top" content="设置为 -1 可开启批次大小自适应（仅单卡 Ultralytics 训练支持）">
              <i class="el-icon-question hint-icon"></i>
            </el-tooltip>
          </div>
          <el-input v-model="batchSize" size="small" placeholder="16" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">优化器</div>
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
import { uploadPretrainedWeights } from "@/api/training";

export default {
  name: "Official",
  props: {
    selectedProject: {
      type: Object,
      default: null
    },
    taskType: {
      type: String,
      default: 'detection'
    }
  },
  data() {
    return {
      ref: referenceStore,
      selectedModel: null,
      selectedArchitectureId: null,
      selectedFamily: null,
      isRotated: false,
      epochs: "100",
      imgSize: "640",
      patience: "100",
      learningRate: "0.01",
      selectedDevice: "0",
      batchSize: "16",
      options: [
        { value: "Auto", label: "Auto" },
        { value: "Adam", label: "Adam" },
        { value: "AdamW", label: "AdamW" },
        { value: "SGD", label: "SGD" }
      ],
      optimizer: "Auto",
      pretrainedEnabled: true,
      pretrainedFileName: "",
      pretrainedPath: "",
      uploadingPretrain: false,
      pretrainUploadError: "",
      modelMetrics: {
        // YOLO26 series (COCO mAP@50-95 / T4 TensorRT10 FP16 ms)
        YOLO26n: { accuracy: 40.5, speedMs: 1.7 },
        YOLO26s: { accuracy: 48.0, speedMs: 2.9 },
        YOLO26m: { accuracy: 52.5, speedMs: 4.7 },
        YOLO26l: { accuracy: 54.6, speedMs: 7.0 },
        YOLO26x: { accuracy: 56.9, speedMs: 11.8 },
        // YOLO12 series (COCO mAP@50-95 / T4 TensorRT10 FP16 ms)
        YOLO12n: { accuracy: 40.6, speedMs: 1.6 },
        YOLO12s: { accuracy: 48.0, speedMs: 2.6 },
        YOLO12m: { accuracy: 52.5, speedMs: 4.9 },
        YOLO12l: { accuracy: 53.7, speedMs: 6.8 },
        YOLO12x: { accuracy: 55.2, speedMs: 11.2 },
        // YOLO11 series (COCO mAP@50-95 / T4 TensorRT10 FP16 ms)
        YOLO11n: { accuracy: 39.5, speedMs: 1.5 },
        YOLO11s: { accuracy: 47.0, speedMs: 2.5 },
        YOLO11m: { accuracy: 51.5, speedMs: 4.7 },
        YOLO11l: { accuracy: 53.4, speedMs: 6.2 },
        YOLO11x: { accuracy: 54.7, speedMs: 11.3 },
        // YOLOv10 series (COCO mAP@50-95 / T4 TensorRT FP16 ms)
        YOLOv10n: { accuracy: 38.5, speedMs: 1.8 },
        YOLOv10s: { accuracy: 46.3, speedMs: 2.5 },
        YOLOv10m: { accuracy: 51.1, speedMs: 4.7 },
        YOLOv10l: { accuracy: 53.2, speedMs: 7.3 },
        YOLOv10x: { accuracy: 54.4, speedMs: 10.7 },
        YOLOv10b: { accuracy: 52.5, speedMs: 5.7 },
        // YOLOv9 series (COCO mAP@50-95 / T4 TensorRT FP16 ms)
        YOLOv9s: { accuracy: 46.8, speedMs: 3.5 },
        YOLOv9m: { accuracy: 51.4, speedMs: 6.4 },
        YOLOv9c: { accuracy: 53.0, speedMs: 7.2 },
        YOLOv9e: { accuracy: 55.6, speedMs: 15.8 },
        YOLOv9t: { accuracy: 38.3, speedMs: 2.3 },
        // YOLOv8 series (COCO mAP@50-95 / T4 TensorRT FP16 ms)
        YOLOv8n: { accuracy: 37.3, speedMs: 7.2 },
        YOLOv8s: { accuracy: 44.9, speedMs: 10.8 },
        YOLOv8m: { accuracy: 50.2, speedMs: 15.9 },
        YOLOv8l: { accuracy: 52.9, speedMs: 22.5 },
        YOLOv8x: { accuracy: 53.9, speedMs: 29.8 },
        // RT-DETR series (COCO mAP@50-95 / T4 TensorRT FP16 ms)
        "RT-DETR-l": { accuracy: 53.0, speedMs: 8.7 },
        "RT-DETR-x": { accuracy: 54.8, speedMs: 13.5 },
        // YOLOv8-seg series
        "YOLOv8n-seg": { accuracy: 30.5, speedMs: 8.1 },
        "YOLOv8s-seg": { accuracy: 36.8, speedMs: 12.3 },
        "YOLOv8m-seg": { accuracy: 40.2, speedMs: 20.4 },
        "YOLOv8l-seg": { accuracy: 42.1, speedMs: 35.6 },
        "YOLOv8x-seg": { accuracy: 43.4, speedMs: 48.2 },
        // PaddleDetection PP-YOLOE+ series (COCO mAP / T4 FP16 ms)
        "PP-YOLOE_s": { accuracy: 43.1, speedMs: 8.5 },
        "PP-YOLOE_m": { accuracy: 48.9, speedMs: 14.2 },
        "PP-YOLOE_l": { accuracy: 51.4, speedMs: 20.8 },
        "PP-YOLOE_x": { accuracy: 53.3, speedMs: 32.1 },
        // PaddleDetection PicoDet series
        "PicoDet_s": { accuracy: 29.1, speedMs: 3.5 },
        "PicoDet_l": { accuracy: 36.6, speedMs: 6.8 },
      },
      savePeriod: "-1",
    };
  },
  computed: {
    datasetLabel() {
      return this.selectedProject?.dataset?.dataset_name || "No dataset linked";
    },
    sectionTitle() {
      return this.taskType === 'segmentation' ? '分割架构' : '检测架构';
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
        // Backend usually returns 'detection' or 'segmentation'
        // If empty, assume detection for BC
        const target = this.taskType === 'segmentation' ? 'segmentation' : 'detection';
        return tt === target || (!tt && target === 'detection');
      });

      const fallbackFamily = "YOLOv8";
      // Different fallbacks based on taskType if list is empty
      let fallbackItems = [];
      if (this.taskType === 'segmentation') {
         fallbackItems = [
            { model_variant: "yolov8n-seg" },
            { model_variant: "yolov8s-seg" },
            { model_variant: "yolov8m-seg" },
            { model_variant: "yolov8l-seg" },
            { model_variant: "yolov8x-seg" }
        ];
      } else {
        fallbackItems = [
            { model_variant: "yolov8n" },
            { model_variant: "yolov8s" },
            { model_variant: "yolov8m" },
            { model_variant: "yolov8l" },
            { model_variant: "yolov8x" }
        ];
      }

      const items = detected.length ? detected : fallbackItems;
      const map = {};
      items.forEach((it) => {
        const fam = it.model_family || it.family || fallbackFamily || "Uncategorized";
        (map[fam] = map[fam] || []).push(it);
      });

      const sizeOrder = { t: 0, n: 1, s: 2, m: 3, b: 4, l: 5, x: 6, c: 7, e: 8 };
      const sizeRank = (variant = "") => {
        const base = String(variant || "").toLowerCase().replace(/-(cls|seg)$/i, "");
        const rtDetr = base.match(/^rtdetr-([a-z0-9]+)$/);
        if (rtDetr && rtDetr[1] in sizeOrder) return sizeOrder[rtDetr[1]];
        const letter = base.slice(-1).toLowerCase();
        return letter in sizeOrder ? sizeOrder[letter] : 999;
      };

      // Version-based family order
      const familyOrder = ['YOLOv8', 'YOLOv9', 'YOLOv10', 'YOLO11', 'YOLO12', 'YOLO26', 'RT-DETR'];
      const familyRank = (name) => {
        const idx = familyOrder.indexOf(name);
        return idx >= 0 ? idx : 999;
      };

      return Object.entries(map)
        .sort((a, b) => {
          if (a[0] === "Uncategorized") return 1;
          if (b[0] === "Uncategorized") return -1;
          const ra = familyRank(a[0]);
          const rb = familyRank(b[0]);
          if (ra !== rb) return ra - rb;
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
    selectedFamilyItems() {
      if (!this.selectedFamily) return [];
      const group = this.architectureGroups.find(g => g.family === this.selectedFamily);
      return group ? group.items : [];
    },
    metrics() {
      const def = { accuracy: 37.3, speedMs: 80.4 };
      if (!this.selectedModel) return def;
      const key = this.formatVariantKey(this.selectedModel);
      return this.modelMetrics[key] || def;
    },
    currentSeriesKey() {
      const m = this.formatVariantKey(this.selectedModel);
      const prefixes = ["YOLO26", "YOLO12", "YOLO11", "YOLOv10", "YOLOv9", "YOLOv8", "RT-DETR"];
      for (const prefix of prefixes) {
        if (m.startsWith(prefix)) return prefix;
      }
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
    taskType(newType) {
      if (newType) {
          // Clear current selection and re-select default
          this.selectedModel = null;
          this.selectedArchitectureId = null;
          this.selectedFamily = null;
          this.ensureDefaultModel();
      }
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
      if (!this.pretrainedEnabled) {
        this.pretrainedFileName = "";
        this.pretrainedPath = "";
        this.pretrainUploadError = "";
      }
      this.emitConfigChange();
    },
    savePeriod() {
        this.emitConfigChange();
    }
  },
  methods: {
    reloadArchitectures() {
      loadArchitectures({ force: true });
    },
    async handlePretrainFileChange(file) {
      const raw = file && (file.raw || file);
      if (!raw) return;
      this.pretrainUploadError = "";
      this.uploadingPretrain = true;
      try {
        const res = await uploadPretrainedWeights(raw);
        this.pretrainedFileName = res?.filename || raw.name || "";
        this.pretrainedPath = res?.token || res?.path || "";
        this.emitConfigChange();
      } catch (err) {
        const msg = err?.message || "无法上传预训练权重";
        this.pretrainUploadError = msg;
        this.pretrainedFileName = "";
        this.pretrainedPath = "";
        this.emitConfigChange();
      } finally {
        this.uploadingPretrain = false;
      }
    },
    removePretrainFile() {
      this.pretrainedFileName = "";
      this.pretrainedPath = "";
      this.pretrainUploadError = "";
      this.emitConfigChange();
    },
    ensureDefaultModel() {
      // Ensure selectedFamily is set
      if (!this.selectedFamily && this.architectureGroups.length) {
        this.selectedFamily = this.architectureGroups[0].family;
      }
      if (this.selectedModel) return;
      const first = this.architectureGroups?.[0]?.items?.[0];
      if (first) this.onSelectArchitecture(first);
    },
    onSelectFamily(family) {
      this.selectedFamily = family;
    },
    onSelectArchitecture(arch) {
      this.selectedArchitectureId = arch?.arch_id || arch?.architecture_id || arch?.id || null;
      this.selectedModel = arch?.model_variant || null;
    },
    formatVariantKey(v) {
      const s = String(v || "").trim();
      if (!s) return "";
      return s
        .replace(/^rtdetr-/i, "RT-DETR-")
        .replace(/^ppyoloe/i, "PP-YOLOE")
        .replace(/^picodet/i, "PicoDet")
        .replace(/^yolov8/i, "YOLOv8")
        .replace(/^yolov9/i, "YOLOv9")
        .replace(/^yolov10/i, "YOLOv10")
        .replace(/^yolo11/i, "YOLO11")
        .replace(/^yolo12/i, "YOLO12")
        .replace(/^yolo26/i, "YOLO26")
        .replace(/^yolo/i, "YOLO");
    },
    formatVariantShort(v) {
      const full = this.formatVariantKey(v);
      const family = this.selectedFamily || '';
      const sizeNames = {
        't': 'Tiny', 'n': 'Nano', 's': 'Small', 'm': 'Medium',
        'b': 'Base', 'l': 'Large', 'x': 'Extra', 'c': 'Compact', 'e': 'Extreme'
      };
      if (full.startsWith(family)) {
        const suffix = full.slice(family.length);
        // e.g. suffix = "n", "s", "m", "l", "x", "-seg", "n-seg"
        const baseSuffix = suffix.replace(/-(seg|cls)$/i, '');
        const taskSuffix = suffix.includes('-seg') ? ' Seg' : suffix.includes('-cls') ? ' Cls' : '';
        const sizeName = sizeNames[baseSuffix.toLowerCase()];
        if (sizeName) return sizeName + taskSuffix;
        // For RT-DETR variants like "-l", "-x"
        if (baseSuffix.startsWith('-') && sizeNames[baseSuffix.slice(1).toLowerCase()]) {
          return sizeNames[baseSuffix.slice(1).toLowerCase()] + taskSuffix;
        }
        return suffix || full;
      }
      return full;
    },
    formatVariant(v) {
      const k = this.formatVariantKey(v);
      return k;
    },
    showAdvancedModelConfiguration() {
      this.isRotated = !this.isRotated;
    },
    emitConfigChange() {
      const variant = String(this.selectedModel || "").toLowerCase();
      let configPath = "";

      const configData = {
        epochs: parseInt(this.epochs, 10) || 100,
        img_size: parseInt(this.imgSize, 10) || 640,
        patience: parseInt(this.patience, 10) || 100,
        learning_rate: parseFloat(this.learningRate) || 0.01,
        batch_size: this.batchSize != null && String(this.batchSize).trim() !== '' ? parseInt(this.batchSize, 10) : 16,
        device: this.getDeviceValue(),
        optimizer: String(this.optimizer || "auto").toLowerCase(),
        use_pretrained: this.pretrainedEnabled,
        pretrained_model_path: this.pretrainedEnabled ? this.pretrainedPath : "",
        dataset_name: this.selectedProject?.dataset?.dataset_name || "",
        save_period: parseInt(this.savePeriod, 10),
        config_path: configPath 
      };

      this.$emit("config-changed", configData);
    },
    getDeviceValue() {
      const val = String(this.selectedDevice || "").trim();
      return val || "0";
    }
  },
  mounted() {
    loadArchitectures();
    this.$nextTick(() => {
      this.ensureDefaultModel();
      // Ensure model-selected is emitted after initial selection
      if (this.selectedModel) {
        this.$emit("model-selected", {
          model: this.selectedModel,
          architecture_id: this.selectedArchitectureId || null
        });
      }
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
  gap: 10px;
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

.arch-tabbed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Family tab bar */
.family-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.family-tabs::-webkit-scrollbar {
  display: none;
}

.family-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #6a7482;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.family-tab:hover {
  background: #f0f2f8;
  color: #3e4a5b;
}

.family-tab.active {
  background: linear-gradient(135deg, #eef0ff 0%, #e4e8ff 100%);
  border-color: #c5cdff;
  color: #2b3a67;
  font-weight: 600;
}

.tab-count {
  font-size: 10px;
  background: #e4e7ee;
  color: #6a7482;
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 600;
  line-height: 1.4;
}

.family-tab.active .tab-count {
  background: rgba(79, 99, 199, 0.2);
  color: #3b4fb8;
}

/* Variant chips row */
.variant-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.arch-chip {
  border: 1px solid #e4e7ee;
  background: #f6f7fb;
  padding: 8px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: #3e4a5b;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.5px;
}

.arch-chip:hover {
  border-color: #9bb0ff;
  color: #2b3a67;
  background: #eef1ff;
}

.arch-chip.active {
  background: linear-gradient(135deg, rgba(79, 99, 199, 0.18), rgba(79, 99, 199, 0.12));
  border-color: #4f63c7;
  color: #2b3a67;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(79, 99, 199, 0.18);
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

.field-row.wide {
  grid-column: 1 / -1;
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

/* Compact upload row */
.upload-compact {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.upload-hidden ::v-deep .el-upload {
  display: inline-block;
}

.browse-btn {
  border-radius: 8px !important;
  background: linear-gradient(135deg, #111f68 0%, #0d1554 100%) !important;
  border-color: #111f68 !important;
  color: #fff !important;
  font-weight: 500;
  padding: 8px 14px;
}

.browse-btn:hover {
  background: linear-gradient(135deg, #1a2d8a 0%, #111f68 100%) !important;
}

.file-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #2b3a67;
  background: #fff;
  border: 1px solid #e4e7ee;
  border-radius: 8px;
  padding: 6px 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-name .el-icon-document {
  color: #4f63c7;
}

.remove-icon {
  cursor: pointer;
  color: #d64545;
  margin-left: 4px;
}

.remove-icon:hover {
  color: #b33c3c;
}

.file-hint {
  font-size: 12px;
  color: #9ca3af;
}

.upload-error {
  font-size: 11px;
  color: #d64545;
  margin-top: 4px;
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

/* Field label with tooltip */
.field-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Hint icon (?) */
.hint-icon {
  font-size: 14px;
  color: #9ca3af;
  cursor: help;
  transition: color 0.2s ease;
}

.hint-icon:hover {
  color: #4f63c7;
}
</style>
