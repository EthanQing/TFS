<template>
  <div class="training-report-page">
    <div class="report-toolbar no-print">
      <el-button icon="el-icon-arrow-left" @click="goBack">返回</el-button>
      <div class="toolbar-spacer"></div>
      <el-button
        type="primary"
        icon="el-icon-document"
        :loading="exportingDocx"
        :disabled="!report || loading || unavailable"
        @click="downloadDocx"
      >
        导出 Word（DOCX）
      </el-button>
    </div>

    <el-skeleton v-if="loading" :rows="10" animated class="report-skeleton" />

    <el-alert
      v-else-if="!runId"
      title="缺少训练任务 ID"
      type="warning"
      description="请从训练任务列表或训练监控页进入报告。"
      show-icon
      :closable="false"
    />

    <el-alert
      v-else-if="unavailable"
      title="训练报告不可用"
      type="warning"
      :description="errorMessage || '训练尚未完成，报告不可用。'"
      show-icon
      :closable="false"
    />

    <el-alert
      v-else-if="errorMessage"
      title="报告加载失败"
      type="error"
      :description="errorMessage"
      show-icon
      :closable="false"
    />

    <main v-else-if="report" ref="reportContent" class="report-content">
      <section class="report-hero">
        <div>
          <div class="report-eyebrow">Training Result Report</div>
          <h1>训练结果报告</h1>
          <p>任务名称：{{ report.basic.name || report.basic.run_id }}</p>
        </div>
        <div class="report-status" :class="statusClass(report.basic.status)">
          <i class="el-icon-success" v-if="report.basic.status === 'completed'"></i>
          {{ statusLabel(report.basic.status) }}
        </div>
      </section>

      <section class="summary-grid">
        <div class="summary-card">
          <span>数据集</span>
          <strong>{{ report.dataset.dataset_name || '-' }}</strong>
          <small v-if="report.dataset.dataset_version">版本：{{ report.dataset.dataset_version }}</small>
        </div>
        <div class="summary-card">
          <span>框架</span>
          <strong>{{ report.basic.framework_label || '-' }}</strong>
          <small>{{ report.basic.engine || '-' }}</small>
        </div>
        <div class="summary-card">
          <span>训练时长</span>
          <strong>{{ formatDuration(report.basic.duration_seconds) }}</strong>
        </div>
        <div class="summary-card">
          <span>开始时间</span>
          <strong>{{ formatDateTime(report.basic.started_at) }}</strong>
        </div>
        <div class="summary-card">
          <span>完成时间</span>
          <strong>{{ formatDateTime(report.basic.finished_at) }}</strong>
        </div>
        <div class="summary-card">
          <span>Run ID</span>
          <strong class="mono">{{ report.basic.run_id }}</strong>
        </div>
      </section>

      <section class="report-section">
        <header class="section-header">
          <i class="el-icon-crop"></i>
          <h2>模型架构选型</h2>
        </header>
        <div class="info-grid">
          <InfoItem label="家族" :value="report.architecture.family" />
          <InfoItem label="变体" :value="report.architecture.variant" />
          <InfoItem label="任务类型" :value="taskTypeLabel(report.architecture.task_type)" />
          <InfoItem label="训练引擎" :value="report.basic.engine" />
          <InfoItem label="预训练权重" :value="report.architecture.pretrained_path || '-'" class="info-wide" />
          <InfoItem label="描述" :value="report.architecture.description || '-'" class="info-wide" />
        </div>
      </section>

      <section class="report-section">
        <header class="section-header">
          <i class="el-icon-setting"></i>
          <h2>训练参数配置</h2>
        </header>
        <el-collapse v-model="activeParamPanels" class="report-collapse">
          <el-collapse-item title="通用参数" name="general">
            <div class="kv-grid">
              <div v-for="item in generalParamItems" :key="item.key" class="kv-item">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </el-collapse-item>
          <el-collapse-item title="增强配置" name="augmentation">
            <KeyValueTable :items="objectEntries(report.parameters.augmentation)" empty-text="暂无增强配置" />
          </el-collapse-item>
          <el-collapse-item title="损失权重" name="loss">
            <KeyValueTable :items="objectEntries(report.parameters.loss_weights)" empty-text="暂无损失权重配置" />
          </el-collapse-item>
          <el-collapse-item title="框架特有 / 其他参数" name="additional">
            <KeyValueTable :items="objectEntries(report.parameters.additional_params)" empty-text="暂无其他参数" />
          </el-collapse-item>
        </el-collapse>
      </section>

      <section class="report-section">
        <header class="section-header">
          <i class="el-icon-data-analysis"></i>
          <h2>模型最终指标</h2>
        </header>

        <div v-if="coreMetricItems.length" class="metric-card-grid">
          <div v-for="metric in coreMetricItems" :key="metric.name" class="core-metric-card">
            <span>{{ metric.name }}</span>
            <strong>{{ formatMetric(metric.value) }}</strong>
            <small>Best</small>
          </div>
        </div>
        <el-alert
          v-else
          title="暂无核心指标"
          type="info"
          description="未在 best_metrics / final_metrics 中找到 mAP、Precision、Recall 等核心指标。"
          show-icon
          :closable="false"
          class="section-alert"
        />

        <div class="metrics-compare">
          <div class="metric-panel best">
            <h3><i class="el-icon-trophy"></i> Best Metrics</h3>
            <KeyValueTable :items="metricEntries(report.metrics.best_metrics)" empty-text="暂无 best metrics" metric />
          </div>
          <div class="metric-panel">
            <h3><i class="el-icon-document-checked"></i> Final Metrics</h3>
            <KeyValueTable :items="metricEntries(report.metrics.final_metrics)" empty-text="暂无 final metrics" metric />
          </div>
        </div>
      </section>

      <section class="report-section">
        <header class="section-header">
          <i class="el-icon-box"></i>
          <h2>模型产物</h2>
        </header>
        <div class="artifact-list">
          <InfoItem label="最佳权重" :value="report.artifacts.best_weights_path || '-'" class="info-wide" />
          <InfoItem label="最终权重" :value="report.artifacts.last_weights_path || '-'" class="info-wide" />
          <InfoItem label="模型大小" :value="formatSize(report.artifacts.model_size_mb)" />
          <InfoItem label="推理耗时" :value="formatLatency(report.artifacts.inference_time_ms)" />
          <InfoItem label="FLOPs" :value="formatFlops(report.artifacts.flops)" />
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { DownloadTrainingReportDocx, FetchTrainingReport } from "@/api/training";

const CORE_METRIC_CANDIDATES = {
  "mAP50-95": [
    "metrics/mAP50-95(B)",
    "metrics/mAP50-95(M)",
    "mAP50-95",
    "mAP",
    "map",
    "bbox_map",
    "bbox_mAP",
    "eval/bbox_mAP",
    "eval/bbox_map",
  ],
  mAP50: [
    "metrics/mAP50(B)",
    "metrics/mAP50(M)",
    "mAP50",
    "AP50",
    "ap50",
    "bbox_ap50",
    "bbox_AP50",
    "eval/bbox_AP50",
    "eval/bbox_ap50",
  ],
  Precision: [
    "metrics/precision(B)",
    "metrics/precision(M)",
    "precision",
    "Precision",
    "bbox_precision",
    "eval/bbox_precision",
  ],
  Recall: [
    "metrics/recall(B)",
    "metrics/recall(M)",
    "recall",
    "Recall",
    "bbox_recall",
    "eval/bbox_recall",
  ],
};

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickMetric(metrics, candidates) {
  const source = metrics && typeof metrics === "object" ? metrics : {};
  const lowerMap = {};
  Object.keys(source).forEach((key) => {
    lowerMap[String(key).toLowerCase()] = key;
  });
  for (const key of candidates || []) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const n = toFiniteNumber(source[key]);
      if (n !== null) return n;
    }
    const actual = lowerMap[String(key).toLowerCase()];
    if (actual) {
      const n = toFiniteNumber(source[actual]);
      if (n !== null) return n;
    }
  }
  return null;
}

const InfoItem = {
  name: "InfoItem",
  functional: true,
  props: {
    label: String,
    value: [String, Number],
  },
  render(h, ctx) {
    return h("div", { class: ["info-item", ctx.data.class, ctx.data.staticClass] }, [
      h("span", ctx.props.label || ""),
      h("strong", { class: "info-value" }, String(ctx.props.value ?? "-")),
    ]);
  },
};

const KeyValueTable = {
  name: "KeyValueTable",
  functional: true,
  props: {
    items: { type: Array, default: () => [] },
    emptyText: { type: String, default: "暂无数据" },
    metric: { type: Boolean, default: false },
  },
  render(h, ctx) {
    const items = ctx.props.items || [];
    if (!items.length) {
      return h("div", { class: "empty-inline" }, ctx.props.emptyText);
    }
    return h(
      "div",
      { class: ["kv-table", ctx.props.metric ? "is-metric" : ""] },
      items.map((item) =>
        h("div", { class: "kv-row", key: item.key }, [
          h("span", { class: "kv-key", attrs: { title: item.key } }, item.key),
          h("strong", { class: "kv-value", attrs: { title: item.raw } }, item.value),
        ])
      )
    );
  },
};

export default {
  name: "TrainingReport",
  components: { InfoItem, KeyValueTable },
  data() {
    return {
      runId: "",
      report: null,
      loading: false,
      errorMessage: "",
      unavailable: false,
      exportingDocx: false,
      activeParamPanels: ["general", "augmentation", "loss", "additional"],
    };
  },
  computed: {
    generalParamItems() {
      const p = (this.report && this.report.parameters) || {};
      const items = [
        ["epochs", "Epochs", p.epochs],
        ["batch_size", "Batch Size", p.batch_size],
        ["image_size", "Image Size", p.image_size],
        ["learning_rate", "Learning Rate", p.learning_rate],
        ["lr_scheduler", "LR Scheduler", p.lr_scheduler],
        ["patience", "Patience", p.patience],
        ["device", "Device", p.device],
        ["workers", "Workers", p.workers],
        ["optimizer", "Optimizer", p.optimizer],
        ["use_pretrained", "Use Pretrained", p.use_pretrained ? "是" : "否"],
      ];
      if (p.save_period !== null && p.save_period !== undefined) {
        items.push(["save_period", "Save Period", p.save_period]);
      }
      return items.map(([key, label, value]) => ({
        key,
        label,
        value: this.formatValue(value),
      }));
    },
    coreMetricItems() {
      const metrics = (this.report && this.report.metrics) || {};
      const core = metrics.core_metrics && typeof metrics.core_metrics === "object"
        ? metrics.core_metrics
        : this.extractCoreMetrics(metrics.best_metrics, metrics.final_metrics);
      return Object.keys(core || {}).map((name) => ({
        name,
        value: core[name],
      }));
    },
  },
  watch: {
    "$route.query.runId": {
      immediate: true,
      handler() {
        const id = String(this.$route.query.runId || this.$route.query.jobId || "").trim();
        this.runId = id;
        if (id) this.loadReport(id);
      },
    },
  },
  methods: {
    async loadReport(runId) {
      this.loading = true;
      this.errorMessage = "";
      this.unavailable = false;
      this.report = null;
      try {
        const data = await FetchTrainingReport(runId);
        this.report = data;
        if (normalizeStatus(data?.basic?.status) !== "completed") {
          this.unavailable = true;
          this.errorMessage = "训练尚未完成，报告不可用。";
        }
      } catch (err) {
        const msg = err?.message || "报告加载失败";
        this.errorMessage = msg;
        this.unavailable = err?.status === 400 || /尚未完成|不可用/.test(msg);
      } finally {
        this.loading = false;
      }
    },
    goBack() {
      if (window.history.length > 1) {
        this.$router.back();
      } else {
        this.$router.push({ path: "/projects" });
      }
    },
    async downloadDocx() {
      if (!this.runId) {
        this.$message.warning("缺少训练任务 ID");
        return;
      }
      this.exportingDocx = true;
      try {
        const { blob, filename } = await DownloadTrainingReportDocx(this.runId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || "训练报告.docx";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.$message.success("DOCX 报告已开始下载，可用 Word/WPS 编辑。");
      } catch (err) {
        this.$message.error("导出 DOCX 失败：" + (err?.message || err));
      } finally {
        this.exportingDocx = false;
      }
    },
    extractCoreMetrics(bestMetrics, finalMetrics) {
      const best = bestMetrics && typeof bestMetrics === "object" ? bestMetrics : {};
      const final = finalMetrics && typeof finalMetrics === "object" ? finalMetrics : {};
      const out = {};
      Object.keys(CORE_METRIC_CANDIDATES).forEach((name) => {
        let value = pickMetric(best, CORE_METRIC_CANDIDATES[name]);
        if (value === null) value = pickMetric(final, CORE_METRIC_CANDIDATES[name]);
        if (value !== null) out[name] = value;
      });
      return out;
    },
    objectEntries(obj) {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
      return Object.keys(obj)
        .sort((a, b) => String(a).localeCompare(String(b), "zh"))
        .map((key) => {
          const raw = obj[key];
          return {
            key,
            raw: this.formatRaw(raw),
            value: this.formatValue(raw),
          };
        });
    },
    metricEntries(obj) {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
      return Object.keys(obj)
        .sort((a, b) => String(a).localeCompare(String(b), "zh"))
        .map((key) => {
          const raw = obj[key];
          return {
            key,
            raw: this.formatRaw(raw),
            value: toFiniteNumber(raw) !== null ? this.formatMetric(raw) : this.formatValue(raw),
          };
        });
    },
    formatRaw(value) {
      if (value === null || value === undefined) return "-";
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch (_) {
          return String(value);
        }
      }
      return String(value);
    },
    formatValue(value) {
      if (value === null || value === undefined || value === "") return "-";
      if (typeof value === "boolean") return value ? "是" : "否";
      if (typeof value === "object") {
        try {
          return JSON.stringify(value, null, 2);
        } catch (_) {
          return String(value);
        }
      }
      return String(value);
    },
    formatMetric(value) {
      const n = toFiniteNumber(value);
      if (n === null) return "-";
      if (Math.abs(n) >= 100) return n.toFixed(2);
      if (Math.abs(n) >= 1) return n.toFixed(4);
      return n.toFixed(4);
    },
    formatSize(value) {
      const n = toFiniteNumber(value);
      return n === null ? "-" : `${n.toFixed(2)} MB`;
    },
    formatLatency(value) {
      const n = toFiniteNumber(value);
      return n === null ? "-" : `${n.toFixed(2)} ms`;
    },
    formatFlops(value) {
      const n = toFiniteNumber(value);
      if (n === null) return "-";
      if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TFLOPs`;
      if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GFLOPs`;
      if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MFLOPs`;
      return String(Math.round(n));
    },
    formatDuration(seconds) {
      const n = toFiniteNumber(seconds);
      if (n === null) return "-";
      const total = Math.max(0, Math.floor(n));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      if (h > 0) return `${h}h ${m}min`;
      if (m > 0) return `${m}min ${s}s`;
      return `${s}s`;
    },
    formatDateTime(value) {
      if (!value) return "-";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "-";
      return d.toLocaleString();
    },
    statusLabel(status) {
      const s = normalizeStatus(status);
      const map = {
        completed: "已完成",
        running: "运行中",
        queued: "排队中",
        created: "等待中",
        failed: "失败",
        cancelled: "已取消",
        deleted: "已删除",
      };
      return map[s] || status || "-";
    },
    statusClass(status) {
      const s = normalizeStatus(status);
      return {
        "is-success": s === "completed",
        "is-warning": s === "queued" || s === "running" || s === "created",
        "is-danger": s === "failed" || s === "cancelled" || s === "deleted",
      };
    },
    taskTypeLabel(taskType) {
      const s = String(taskType || "").toLowerCase();
      const map = {
        detection: "目标检测",
        segmentation: "图像分割",
        classification: "图像分类",
      };
      return map[s] || taskType || "-";
    },
  },
};
</script>

<style scoped>
.training-report-page {
  min-height: 100%;
  padding: 24px;
  background: #f6f8fb;
  color: #0f172a;
}

.report-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-spacer {
  flex: 1;
}

.report-skeleton,
.report-content {
  max-width: 1180px;
  margin: 0 auto;
}

.report-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.report-hero,
.report-section,
.summary-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.report-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 28px;
  border-radius: 22px;
}

.report-eyebrow {
  color: #4f63c7;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 800;
  margin-bottom: 8px;
}

.report-hero h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.2;
}

.report-hero p {
  margin: 10px 0 0;
  color: #64748b;
}

.report-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 999px;
  font-weight: 800;
  background: #f1f5f9;
  color: #475569;
}

.report-status.is-success {
  background: #ecfdf5;
  color: #047857;
}

.report-status.is-warning {
  background: #fffbeb;
  color: #b45309;
}

.report-status.is-danger {
  background: #fef2f2;
  color: #dc2626;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  min-height: 108px;
  padding: 18px;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-card span,
.info-item span,
.kv-item span {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.summary-card strong {
  font-size: 18px;
  line-height: 1.35;
  word-break: break-word;
}

.summary-card small {
  color: #94a3b8;
}

.mono {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 13px !important;
}

.report-section {
  padding: 22px;
  border-radius: 22px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.section-header i {
  color: #4f63c7;
  font-size: 20px;
}

.section-header h2 {
  margin: 0;
  font-size: 20px;
}

.info-grid,
.artifact-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.info-item {
  padding: 14px 16px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.info-item.info-wide {
  grid-column: 1 / -1;
}

.info-value {
  white-space: pre-wrap;
  word-break: break-word;
}

.report-collapse {
  border: none;
}

.report-collapse ::v-deep .el-collapse-item__header {
  font-weight: 800;
  color: #0f172a;
}

.kv-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.kv-item {
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kv-item strong {
  word-break: break-word;
}

.kv-table {
  display: grid;
  grid-template-columns: 1fr;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
}

.kv-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.2fr);
  gap: 12px;
  padding: 11px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
}

.kv-row:last-child {
  border-bottom: none;
}

.kv-row:nth-child(even) {
  background: #f8fafc;
}

.kv-key {
  color: #475569;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  word-break: break-word;
}

.kv-value {
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-inline {
  padding: 18px;
  color: #94a3b8;
  text-align: center;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  background: #f8fafc;
}

.section-alert {
  margin-bottom: 14px;
}

.metric-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.core-metric-card {
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, #eff6ff, #ffffff);
  border: 1px solid #bfdbfe;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.core-metric-card span {
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
}

.core-metric-card strong {
  font-size: 26px;
  color: #1e3a8a;
}

.core-metric-card small {
  color: #64748b;
}

.metrics-compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.metric-panel {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 16px;
  background: #ffffff;
}

.metric-panel.best {
  border-color: #facc15;
  background: #fffbeb;
}

.metric-panel h3 {
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.metric-panel.best h3 i {
  color: #d97706;
}

@media (max-width: 960px) {
  .summary-grid,
  .kv-grid,
  .metric-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metrics-compare,
  .info-grid,
  .artifact-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .training-report-page {
    padding: 14px;
  }

  .report-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-grid,
  .kv-grid,
  .metric-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
@media print {
  @page {
    size: A4;
    margin: 12mm;
  }

  body * {
    visibility: hidden !important;
  }

  .training-report-page,
  .training-report-page * {
    visibility: visible !important;
  }

  .training-report-page {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    min-height: auto !important;
    padding: 0 !important;
    background: #ffffff !important;
  }

  .report-content {
    max-width: none !important;
  }

  .no-print,
  .el-button,
  .el-message,
  .el-notification {
    display: none !important;
  }

  .report-hero,
  .report-section,
  .summary-card {
    box-shadow: none !important;
    break-inside: avoid;
  }

  .report-section {
    page-break-inside: avoid;
  }
}
</style>
