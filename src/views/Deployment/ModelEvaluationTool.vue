<template>
  <div class="model-eval-tool">
    <div class="tool-head">
      <div>
        <h3><i class="el-icon-data-line"></i> 模型指标测试</h3>
        <p>选择训练好的模型和标准测试数据集，真实计算 Precision、Recall、F1 与 mAP。</p>
      </div>
      <div class="head-actions">
        <el-button size="small" @click="reloadOptions" :loading="loadingOptions">
          <i class="el-icon-refresh"></i> 刷新
        </el-button>
        <el-button size="small" @click="resetState" :disabled="isRunning">
          <i class="el-icon-refresh-left"></i> 重置
        </el-button>
      </div>
    </div>

    <div class="eval-grid">
      <el-card shadow="never" class="config-card">
        <div class="card-title">评估配置</div>
        <el-form label-position="top" size="small">
          <el-form-item label="选择模型">
            <el-select v-model="form.modelKey" filterable placeholder="选择可评估模型" :loading="modelsLoading">
              <el-option
                v-for="m in models"
                :key="m._key"
                :label="`${m.label} [${m.engine}]`"
                :value="m._key"
              >
                <span>{{ m.label }}</span>
                <el-tag size="mini" type="info" effect="plain" class="option-tag">{{ m.engine }}</el-tag>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="测试数据集">
            <el-select v-model="form.datasetId" filterable placeholder="选择标准检测数据集" :loading="datasetsLoading">
              <el-option
                v-for="d in datasets"
                :key="d.standard_dataset_id"
                :label="d.name || d.dataset_name"
                :value="d.standard_dataset_id"
              >
                <span>{{ d.name || d.dataset_name }}</span>
                <el-tag size="mini" effect="plain" class="option-tag">{{ d.format || "yolo" }}</el-tag>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="评估范围">
            <el-radio-group v-model="form.scope" class="scope-group">
              <el-radio-button label="all">全量</el-radio-button>
              <el-radio-button label="test">test</el-radio-button>
              <el-radio-button label="val">val</el-radio-button>
              <el-radio-button label="train">train</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item>
            <template slot="label">
              置信度阈值 <span class="slider-value">{{ form.conf.toFixed(2) }}</span>
            </template>
            <el-slider v-model="form.conf" :min="0.01" :max="1" :step="0.01" show-input />
          </el-form-item>

          <el-form-item>
            <template slot="label">
              指标 IoU 阈值 <span class="slider-value">{{ form.iou.toFixed(2) }}</span>
            </template>
            <el-slider v-model="form.iou" :min="0.1" :max="0.95" :step="0.05" show-input />
          </el-form-item>

          <div class="action-row">
            <el-button type="primary" :disabled="!canStart" :loading="starting" @click="startEvaluation">
              <i class="el-icon-video-play"></i> 开始测试
            </el-button>
            <el-button type="danger" plain :disabled="!isRunning" :loading="cancelLoading" @click="cancelCurrent">
              取消任务
            </el-button>
          </div>
        </el-form>
      </el-card>

      <div class="result-column">
        <el-card shadow="never" class="status-card">
          <div class="status-head">
            <div class="status-pill" :class="jobStatus || 'idle'">
              <span class="dot"></span>{{ statusText }}
            </div>
            <span v-if="jobId" class="job-id">#{{ jobId }}</span>
          </div>
          <el-progress :percentage="jobProgress" :status="progressStatus" :stroke-width="14" />
          <div class="status-meta">
            <span>阶段: <b>{{ jobPhase || "-" }}</b></span>
            <span>进度: <b>{{ processed }}</b> / {{ total }}</span>
            <span>范围: <b>{{ form.scope }}</b></span>
          </div>
          <div v-if="wsHint" class="warn-line">{{ wsHint }}</div>
          <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon :closable="false" class="error-box" />
        </el-card>

        <el-card shadow="never" class="metrics-card">
          <div class="card-title">核心指标</div>
          <div v-if="metrics" class="metric-grid">
            <div v-for="item in metricCards" :key="item.key" class="metric-card">
              <span class="metric-label">{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <el-empty v-else description="暂无评估结果" />
        </el-card>

        <el-card shadow="never" class="table-card">
          <div class="table-head">
            <div class="card-title">类别明细</div>
            <el-tag v-if="metrics" size="small" type="info" effect="plain">
              跳过 {{ metrics.skipped_images || 0 }} 张，无标签或不可用
            </el-tag>
          </div>
          <el-table :data="classMetrics" height="300" size="small" border>
            <el-table-column prop="class_name" label="类别" min-width="120">
              <template slot-scope="scope">
                {{ scope.row.class_name || scope.row.class_id }}
              </template>
            </el-table-column>
            <el-table-column prop="gt_count" label="GT" width="70" />
            <el-table-column prop="pred_count" label="预测" width="70" />
            <el-table-column prop="precision" label="P" width="90">
              <template slot-scope="scope">{{ formatPercent(scope.row.precision) }}</template>
            </el-table-column>
            <el-table-column prop="recall" label="Recall" width="90">
              <template slot-scope="scope">{{ formatPercent(scope.row.recall) }}</template>
            </el-table-column>
            <el-table-column prop="ap50" label="AP50" width="90">
              <template slot-scope="scope">{{ formatPercent(scope.row.ap50) }}</template>
            </el-table-column>
            <el-table-column prop="ap50_95" label="AP50-95" width="100">
              <template slot-scope="scope">{{ formatPercent(scope.row.ap50_95) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script>
import { fetchStandardDatasetOptions } from "@/api/standardDatasets";
import {
  cancelModelEvaluation,
  createModelEvaluation,
  fetchActiveModelEvaluation,
  fetchEvaluationModels,
  fetchModelEvaluation,
  openModelEvaluationStream,
} from "@/api/modelEvaluations";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export default {
  name: "ModelEvaluationTool",
  data() {
    return {
      loadingOptions: false,
      modelsLoading: false,
      datasetsLoading: false,
      recovering: false,
      starting: false,
      cancelLoading: false,
      models: [],
      datasets: [],
      form: {
        modelKey: "",
        datasetId: null,
        scope: "all",
        conf: 0.25,
        iou: 0.5,
      },
      jobId: "",
      jobStatus: "",
      jobPhase: "",
      jobProgress: 0,
      processed: 0,
      total: 0,
      errorMessage: "",
      result: null,
      streamHandle: null,
      pollTimer: null,
      wsHint: "",
    };
  },
  computed: {
    selectedModel() {
      return this.models.find((m) => m._key === this.form.modelKey) || null;
    },
    canStart() {
      return !!this.selectedModel && !!this.form.datasetId && !this.isRunning && !this.recovering;
    },
    isRunning() {
      return this.jobStatus === "queued" || this.jobStatus === "running";
    },
    statusText() {
      const map = {
        queued: "排队中",
        running: "评估中",
        completed: "已完成",
        failed: "失败",
        cancelled: "已取消",
      };
      return map[this.jobStatus] || "就绪";
    },
    progressStatus() {
      if (this.jobStatus === "failed") return "exception";
      if (this.jobStatus === "cancelled") return "warning";
      if (this.jobStatus === "completed") return "success";
      return null;
    },
    metrics() {
      return this.result?.metrics || null;
    },
    classMetrics() {
      return Array.isArray(this.metrics?.class_metrics) ? this.metrics.class_metrics : [];
    },
    metricCards() {
      const m = this.metrics || {};
      return [
        { key: "precision", label: "Precision(P)", value: this.formatPercent(m.precision) },
        { key: "recall", label: "Recall", value: this.formatPercent(m.recall) },
        { key: "f1", label: "F1", value: this.formatPercent(m.f1) },
        { key: "map50", label: "mAP50", value: this.formatPercent(m.map50) },
        { key: "map50_95", label: "mAP50-95", value: this.formatPercent(m.map50_95) },
        { key: "images", label: "图片数", value: `${m.evaluated_images || 0}` },
        { key: "targets", label: "目标数", value: `${m.total_targets || 0}` },
        { key: "elapsed", label: "耗时", value: this.formatDuration(m.elapsed_ms) },
      ];
    },
  },
  created() {
    this.bootstrap();
  },
  activated() {
    this.recoverActiveJob({ silent: true });
  },
  beforeDestroy() {
    this.stopStream();
    this.stopPolling();
  },
  methods: {
    makeModelKey(row) {
      if (row.model_version_id != null) return `mv:${row.model_version_id}`;
      return `run:${row.run_id}`;
    },
    async bootstrap() {
      await this.reloadOptions();
      await this.recoverActiveJob({ silent: true });
    },
    async reloadOptions() {
      this.loadingOptions = true;
      try {
        await Promise.all([this.loadModels(), this.loadDatasets()]);
      } finally {
        this.loadingOptions = false;
      }
    },
    async loadModels() {
      this.modelsLoading = true;
      try {
        const rows = await fetchEvaluationModels();
        this.models = (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, _key: this.makeModelKey(r) }));
        if (!this.form.modelKey && this.models.length) this.form.modelKey = this.models[0]._key;
      } catch (e) {
        this.$message.error(`加载模型失败: ${e.message || e}`);
      } finally {
        this.modelsLoading = false;
      }
    },
    async loadDatasets() {
      this.datasetsLoading = true;
      try {
        const rows = await fetchStandardDatasetOptions({ pageSize: 500 });
        this.datasets = (Array.isArray(rows) ? rows : []).filter((d) => String(d.dataset_type || "").toLowerCase() === "detection");
        if (!this.form.datasetId && this.datasets.length) this.form.datasetId = this.datasets[0].standard_dataset_id;
      } catch (e) {
        this.$message.error(`加载数据集失败: ${e.message || e}`);
      } finally {
        this.datasetsLoading = false;
      }
    },
    buildPayload() {
      const payload = {
        standard_dataset_id: Number(this.form.datasetId),
        scope: this.form.scope,
        conf: Number(this.form.conf),
        iou: Number(this.form.iou),
      };
      if (this.selectedModel.model_version_id != null) payload.model_version_id = this.selectedModel.model_version_id;
      else payload.run_id = this.selectedModel.run_id;
      return payload;
    },
    applySnapshot(data) {
      if (!data || typeof data !== "object") return;
      this.jobId = data.job_id || this.jobId;
      this.jobStatus = data.status || this.jobStatus;
      this.jobPhase = data.phase || this.jobPhase;
      this.jobProgress = Number(data.progress || 0);
      this.processed = Number(data.processed || 0);
      this.total = Number(data.total || 0);
      this.errorMessage = data.error_message || "";
      if (data.result && typeof data.result === "object") this.result = data.result;
    },
    hydrateFormFromJob(data) {
      if (!data || typeof data !== "object") return;
      if (data.model_version_id != null) {
        this.form.modelKey = `mv:${data.model_version_id}`;
      } else if (data.run_id) {
        this.form.modelKey = `run:${data.run_id}`;
      }
      if (data.standard_dataset_id != null) this.form.datasetId = Number(data.standard_dataset_id);
      if (data.scope) this.form.scope = String(data.scope);
      if (Number.isFinite(Number(data.conf))) this.form.conf = Number(data.conf);
      if (Number.isFinite(Number(data.iou))) this.form.iou = Number(data.iou);
    },
    async recoverActiveJob({ silent = false } = {}) {
      if (this.recovering || this.isRunning) return;
      this.recovering = true;
      try {
        const job = await fetchActiveModelEvaluation({ includeItems: false });
        if (!job || !job.job_id || TERMINAL.has(String(job.status || ""))) return;
        this.hydrateFormFromJob(job);
        this.applySnapshot(job);
        this.connectStream(job);
        if (!silent) this.$message.info("已恢复正在运行的评估任务");
      } catch (e) {
        if (!silent) this.$message.warning(`恢复评估任务失败: ${e.message || e}`);
      } finally {
        this.recovering = false;
      }
    },
    async startEvaluation() {
      if (!this.canStart) return;
      this.starting = true;
      this.errorMessage = "";
      this.result = null;
      this.stopStream();
      this.stopPolling();
      try {
        const job = await createModelEvaluation(this.buildPayload());
        this.applySnapshot(job);
        this.connectStream(job);
        this.$message.success("评估任务已启动");
      } catch (e) {
        this.errorMessage = e.message || String(e);
        this.$message.error(`启动失败: ${this.errorMessage}`);
      } finally {
        this.starting = false;
      }
    },
    connectStream(job) {
      this.stopStream();
      this.streamHandle = openModelEvaluationStream(
        job.job_id,
        {
          onOpen: () => {
            this.wsHint = "";
          },
          onSnapshot: (data) => this.applySnapshot(data),
          onProgress: (data) => this.applySnapshot(data),
          onDone: (data) => {
            this.applySnapshot(data);
            this.stopStream();
            this.stopPolling();
          },
          onError: (err) => {
            this.wsHint = typeof err === "string" ? err : "实时连接异常";
          },
          onClose: () => {
            if (!TERMINAL.has(this.jobStatus)) this.startPollingFallback();
          },
          onReconnect: () => {
            if (!TERMINAL.has(this.jobStatus)) this.wsHint = "实时连接重连中...";
          },
        },
        { fromSeq: job.seq || 0, fromResultId: job.last_result_id || 0 }
      );
    },
    stopStream() {
      if (this.streamHandle) this.streamHandle.close();
      this.streamHandle = null;
    },
    startPollingFallback() {
      if (!this.jobId || this.pollTimer || TERMINAL.has(this.jobStatus)) return;
      this.wsHint = "实时连接中断，已切换为低频同步";
      this.pollTimer = setInterval(async () => {
        if (!this.jobId || TERMINAL.has(this.jobStatus)) {
          this.stopPolling();
          return;
        }
        try {
          const data = await fetchModelEvaluation(this.jobId, { includeItems: false });
          this.applySnapshot(data);
          if (TERMINAL.has(String(data.status || ""))) this.stopPolling();
        } catch (_) {
          0;
        }
      }, 5000);
    },
    stopPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    },
    async cancelCurrent() {
      if (!this.jobId || !this.isRunning) return;
      this.cancelLoading = true;
      try {
        const data = await cancelModelEvaluation(this.jobId);
        this.applySnapshot(data);
      } catch (e) {
        this.$message.error(`取消失败: ${e.message || e}`);
      } finally {
        this.cancelLoading = false;
      }
    },
    resetState() {
      if (this.isRunning) return;
      this.jobId = "";
      this.jobStatus = "";
      this.jobPhase = "";
      this.jobProgress = 0;
      this.processed = 0;
      this.total = 0;
      this.errorMessage = "";
      this.result = null;
      this.wsHint = "";
    },
    formatPercent(v) {
      const n = Number(v);
      if (!Number.isFinite(n)) return "-";
      return `${(n * 100).toFixed(2)}%`;
    },
    formatDuration(ms) {
      const n = Number(ms);
      if (!Number.isFinite(n) || n <= 0) return "-";
      if (n < 1000) return `${n.toFixed(0)}ms`;
      return `${(n / 1000).toFixed(1)}s`;
    },
  },
};
</script>

<style scoped>
.model-eval-tool {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tool-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.tool-head h3 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-head p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.eval-grid {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.config-card,
.status-card,
.metrics-card,
.table-card {
  border: 1px solid #edf0f4;
  border-radius: 10px;
}
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 12px;
}
.config-card ::v-deep .el-select {
  width: 100%;
}
.option-tag {
  float: right;
  margin-top: 8px;
}
.scope-group {
  width: 100%;
  display: flex;
}
.scope-group ::v-deep .el-radio-button {
  flex: 1;
}
.scope-group ::v-deep .el-radio-button__inner {
  width: 100%;
}
.slider-value {
  color: var(--color-primary);
  font-weight: 700;
  margin-left: 6px;
}
.action-row {
  display: flex;
  gap: 8px;
}
.result-column {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.status-head,
.table-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #334155;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
}
.status-pill.running .dot,
.status-pill.queued .dot {
  background: #3b82f6;
}
.status-pill.completed .dot {
  background: #22c55e;
}
.status-pill.failed .dot {
  background: #ef4444;
}
.status-pill.cancelled .dot {
  background: #f59e0b;
}
.job-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--text-secondary);
  font-size: 12px;
}
.status-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 12px;
}
.warn-line {
  margin-top: 10px;
  color: #d97706;
  font-size: 12px;
}
.error-box {
  margin-top: 10px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 10px;
}
.metric-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.metric-label {
  color: var(--text-secondary);
  font-size: 12px;
}
.metric-card strong {
  font-size: 20px;
  color: var(--text-main);
}
@media (max-width: 1180px) {
  .eval-grid {
    grid-template-columns: 1fr;
  }
  .metric-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
}
</style>
