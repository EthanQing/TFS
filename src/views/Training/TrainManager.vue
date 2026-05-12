<template>
  <div class="train-manager">
    <section class="tm-hero">
      <div class="tm-hero-left">
        <div class="tm-status" :class="statusClass">{{ statusLabel }}</div>
        <h2 class="tm-title">训练指标</h2>
        <p class="tm-subtitle">此运行的实时损失曲线和性能信号。</p>
      </div>
      <div class="tm-hero-right">
        <div class="tm-stat">
          <span>轮次</span>
          <strong>{{ currentEpoch }}/{{ totalEpochs || '-' }}</strong>
        </div>
        <div class="tm-stat">
          <span>进度</span>
          <strong>{{ progress ? progress + '%' : '-' }}</strong>
        </div>
        <div v-if="canStop" class="tm-stat action-stat">
           <el-button type="danger" size="small" icon="el-icon-video-pause" @click="handleStop" :loading="stopping">停止训练</el-button>
        </div>
        <div v-else class="tm-stat action-stat">
           <el-button type="primary" size="small" icon="el-icon-video-pause" @click="handleContinue" :loading="continueing">继续训练</el-button>
        </div>
        <div class="tm-stat action-stat">
           <el-button size="small" icon="el-icon-setting" @click="showChartConfig = true">图表设置</el-button>
        </div>
        <div v-if="status === 'completed'" class="tm-stat action-stat">
          <el-button type="primary" size="small" icon="el-icon-document" @click="openReport">
            训练报告
          </el-button>
        </div>
        <div v-if="status === 'completed'" class="tm-stat action-stat">
          <el-button
            v-if="!qualifiedStatus?.isQualified"
            type="success"
            size="small"
            icon="el-icon-success"
            :loading="qualifiedStatus?.checking || qualifiedStatus?.loadingMark"
            :disabled="qualifiedStatus?.checking || !qualifiedStatus?.modelVersionId"
            @click="handleMarkQualified"
          >
            {{ qualifiedStatus?.checking ? '检查中...' : '标记为合格' }}
          </el-button>
          <el-tag v-else type="success" effect="dark" size="medium">
            <i class="el-icon-success"></i> 已合格
          </el-tag>
        </div>
      </div>
    </section>

    <section v-if="status" class="tm-progress-card">
      <div class="tm-progress-row">
        <span>轮次 {{ currentEpoch }}/{{ totalEpochs || '-' }}</span>
        <span>状态: {{ statusLabel }}</span>
        <span v-if="progress">进度 {{ progress }}%</span>
      </div>
      <div class="tm-progress-bar">
        <div class="tm-progress-fill" :style="{ width: epochPercent + '%' }"></div>
      </div>
    </section>

    <section class="tm-body">
      <div v-if="!loading && !metrics && !error" class="state-card">
        <i class="el-icon-info"></i>
        <span>暂无可用指标。</span>
      </div>

      <div v-if="loading" class="state-card">
        <i class="el-icon-loading"></i>
        <span>加载指标中...</span>
      </div>

      <div v-if="error" class="state-card error">
        <i class="el-icon-error"></i>
        <span>{{ error }}</span>
      </div>

      <div v-if="metrics" class="metrics-container">
        <div v-if="waitEvalHint" class="wait-eval-note">
          <i class="el-icon-time"></i>
          <span>{{ waitEvalHint }}</span>
        </div>
        <div v-if="metricGroups.length === 0" class="state-card">
          <i class="el-icon-info"></i>
          <span>暂无可用指标。</span>
        </div>
        <div v-else class="metric-grid">
          <div
            v-for="group in metricGroups"
            :key="group.key"
            class="metric-card"
            :class="{ 'is-wide': group.isWide, 'is-half': group.isHalf }"
          >
            <chart
              :metrics="metrics"
              :custom-series="group.series"
              :custom-title="group.title"
              :custom-y-axis-name="group.yAxis"
              :total-epoch="totalEpochs || metrics.total_epochs"
              :chart-type="group.isWide ? 'overview' : 'generic'"
              :empty-text="group.emptyText || '暂无该指标数据。'"
            ></chart>
          </div>
        </div>
      </div>

      <div v-if="refreshHint" class="refresh-note">
        <i class="el-icon-circle-check"></i>
        <span>{{ refreshHint }}</span>
      </div>
      <div v-if="streamNotice" class="stream-note">
        <i class="el-icon-connection"></i>
        <span>{{ streamNotice }}</span>
      </div>

      <!-- Chart Config Dialog -->
      <el-dialog title="图表显示设置" :visible.sync="showChartConfig" width="480px" append-to-body>
        <div v-if="allMetricGroups.length === 0" style="color:#94a3b8;text-align:center;padding:20px 0">暂无可配置的图表</div>
        <div v-else class="chart-config-list">
          <div v-for="group in allMetricGroups" :key="group.key" class="chart-config-item">
            <span class="chart-config-label">{{ group.title }}</span>
            <el-switch v-model="chartVisibility[group.key]" active-color="#3b82f6"></el-switch>
          </div>
        </div>
        <div slot="footer" class="dialog-footer">
          <el-button size="small" @click="resetChartConfig">恢复默认</el-button>
          <el-button size="small" type="primary" @click="handleSaveChartConfig" :loading="savingConfig">保存配置</el-button>
        </div>
      </el-dialog>
    </section>
  </div>
</template>

<script>
import chart from "@/components/Chart/TrainingChart.vue";
import { buildMetricGroups, hasAccuracyCurves } from "@/utils/trainingMetricProfiles";
import {
  FetchTrainingJobsStatus,
  FetchTrainingJobsMetrics_detailed,
  CancelTrainingJob,
  ResumeTrainingJob,
  openTrainingRunMetricsStream,
} from "@/api/training";
import { fetchChartConfig, saveChartConfig } from "@/api/chartConfig";
import {
  fetchModelVersionsByRunId,
  registerModelVersionFromRun,
  fetchQualifiedModelsByModelVersionId,
  markModelAsQualified,
} from "@/api/models";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "deleted"]);
const METRIC_ALIAS_GROUPS = [
  {
    target: "metrics/mAP50(B)",
    aliases: ["AP50", "mAP50", "eval/bbox_AP50", "eval/bbox_ap50"],
  },
  {
    target: "metrics/mAP50-95(B)",
    aliases: ["mAP", "eval/bbox_mAP", "eval/bbox_map"],
  },
  {
    target: "metrics/precision(B)",
    aliases: ["precision", "eval/bbox_precision"],
  },
  {
    target: "metrics/recall(B)",
    aliases: ["recall", "eval/bbox_recall"],
  },
];

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function toMetricNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

export default {
  name: "TrainPart",
  components: {
    chart
  },
  data() {
    return {
      jobId: null,
      status: null,
      metrics: null,
      error: null,
      loading: false,
      metricsPollingInterval: null,
      metricsPollingMs: 0,
      streamController: null,
      streamConnected: false,
      streamDone: false,
      streamNotice: "",
      fallbackPollingMs: 12000,
      streamLastMetricId: 0,
      streamLastEventId: 0,
      currentEpoch: 0,
      totalEpochs: 0,
      progress: 0,
      engine: null,
      family: null,
      variant: null,
      evalInterval: null,
      stopping: false,
      continueing: false,
      showChartConfig: false,
      chartVisibility: {},
      savingConfig: false,
      configLoaded: false,
      qualifiedStatus: null,
    };
  },
  computed: {
    statusLabel() {
      const s = normalizeStatus(this.status);
      if (!s) return "等待中";
      if (s === "created") return "等待中";
      if (s === "queued") return "排队中";
      if (s === "running") return "运行中";
      if (s === "completed") return "已完成";
      if (s === "failed") return "失败";
      if (s === "cancelled") return "已取消";
      if (s === "deleted") return "已删除";
      return s;
    },
    statusClass() {
      const s = normalizeStatus(this.status || "pending");
      return `status-${s || "pending"}`;
    },
    refreshHint() {
      if (this.isTerminalStatus()) return "训练已结束，指标已停止刷新。";
      if (this.metricsPollingInterval) return "实时连接中断，当前使用低频同步。";
      if (this.streamConnected) return "实时更新中。";
      return "";
    },
    epochPercent() {
      const p = Number(this.progress);
      if (Number.isFinite(p) && p > 0) return Math.max(0, Math.min(100, p));
      const t = Number(this.totalEpochs) || 0;
      const c = Number(this.currentEpoch) || 0;
      if (!t || c <= 0) return 0;
      return Math.max(0, Math.min(100, (c / t) * 100));
    },
    canStop() {
      const s = normalizeStatus(this.status);
      return s === "running" || s === "queued";
    },
    waitEvalHint() {
      if (normalizeStatus(this.status) !== "running") return "";
      if (normalizeStatus(this.engine) !== "paddle-det") return "";
      const interval = Number(this.evalInterval);
      if (!Number.isFinite(interval) || interval <= 1) return "";
      const metricsMap = (this.metrics && this.metrics.metrics) || {};
      if (hasAccuracyCurves(metricsMap)) return "";
      const current = Math.max(0, Number(this.currentEpoch) || 0);
      const nextEvalEpoch = this.nextEvalEpoch(current, interval);
      if (current >= nextEvalEpoch) return "";
      return `当前每 ${interval} 轮验证一次，准确度指标将在第 ${nextEvalEpoch} 轮验证后出现。`;
    },
    allMetricGroups() {
      const data = (this.metrics && this.metrics.metrics) || {};
      return buildMetricGroups(this.engine, data);
    },
    metricGroups() {
      if (!this.configLoaded) return this.allMetricGroups;
      return this.allMetricGroups.filter(g => this.chartVisibility[g.key] !== false);
    }
  },
  watch: {
    allMetricGroups: {
      immediate: true,
      handler(groups) {
        // Pre-populate visibility keys for Vue 2 reactivity
        (groups || []).forEach(g => {
          if (!(g.key in this.chartVisibility)) {
            this.$set(this.chartVisibility, g.key, true);
          }
        });
      }
    },
    "$route.query.jobId": {
      immediate: true,
      handler(newJobId) {
        const id = String(newJobId || "").trim();
        if (!id) return;
        if (this.jobId !== id) this.jobId = id;
        localStorage.setItem("currentJobId", id);
        this.startRealtimeSession();
      }
    }
  },
  activated() {
    const routeJobId = String(this.$route.query.jobId || "").trim();
    const storedJobId = String(localStorage.getItem("currentJobId") || "").trim();
    const nextJobId = routeJobId || this.jobId || storedJobId;
    if (!nextJobId) return;

    if (this.jobId !== nextJobId) {
      this.jobId = nextJobId;
      localStorage.setItem("currentJobId", nextJobId);
      this.startRealtimeSession();
      return;
    }

    if (!this.metrics && !this.loading) {
      this.startRealtimeSession();
      return;
    }

    if (!this.configLoaded) this.loadChartConfig();

    if (!this.isTerminalStatus() && !this.streamConnected && !this.streamController) {
      this.connectMetricsStream();
      if (!this.streamController) this.startFallbackPolling(true);
    }
  },
  deactivated() {
    this.cleanupAllPolling();
  },
  methods: {
    resetMetricsState() {
      this.metrics = null;
      this.error = null;
      this.engine = null;
      this.family = null;
      this.variant = null;
      this.evalInterval = null;
      this.currentEpoch = 0;
      this.totalEpochs = 0;
      this.progress = 0;
      this.streamDone = false;
      this.streamConnected = false;
      this.streamNotice = "";
      this.streamLastMetricId = 0;
      this.streamLastEventId = 0;
      this.qualifiedStatus = null;
    },
    nextEvalEpoch(currentEpoch, evalInterval) {
      const interval = Math.max(1, Math.floor(Number(evalInterval) || 1));
      const current = Math.max(1, Math.floor(Number(currentEpoch) || 1));
      return Math.ceil(current / interval) * interval;
    },
    inferMaxEpoch() {
      const data = (this.metrics && this.metrics.metrics) || {};
      let maxLen = 0;
      Object.keys(data).forEach((k) => {
        const arr = data[k];
        if (Array.isArray(arr)) maxLen = Math.max(maxLen, arr.length);
      });
      return maxLen;
    },
    isTerminalStatus() {
      return TERMINAL_STATUSES.has(normalizeStatus(this.status));
    },
    ensureMetricStore() {
      if (!this.metrics || typeof this.metrics !== "object") {
        this.metrics = { metrics: {}, total_epochs: 0 };
      }
      if (!this.metrics.metrics || typeof this.metrics.metrics !== "object") {
        this.$set(this.metrics, "metrics", {});
      }
    },
    applyStatusPayload(payload = {}) {
      const status = normalizeStatus(payload.status);
      if (status) this.status = status;

      const progress = Number(payload.progress);
      if (Number.isFinite(progress)) {
        this.progress = Math.max(0, Math.min(100, Math.round(progress)));
      }

      const total = Number(payload.total_epochs);
      if (Number.isFinite(total) && total > 0) {
        this.totalEpochs = Math.max(this.totalEpochs || 0, Math.floor(total));
      }

      const epochRaw = Number(payload.current_epoch);
      if (Number.isFinite(epochRaw)) {
        const next = Math.max(0, Math.floor(epochRaw)) + 1;
        this.currentEpoch = Math.max(this.currentEpoch || 0, next);
      }

      if (payload.engine !== undefined) this.engine = payload.engine || null;
      if (payload.family !== undefined) this.family = payload.family || null;
      if (payload.variant !== undefined) this.variant = payload.variant || null;

      if (payload.eval_interval === null) {
        this.evalInterval = null;
      } else if (payload.eval_interval !== undefined) {
        const interval = Number(payload.eval_interval);
        this.evalInterval = Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : null;
      }

      if (this.isTerminalStatus()) {
        this.streamDone = true;
        this.stopFallbackPolling();
        this.closeMetricsStream();
      }
      if (normalizeStatus(this.status) === 'completed') {
        this.$nextTick(() => this.refreshQualifiedStatus());
      }
    },
    normalizeIncomingMetricKeys(metricDict) {
      const source = metricDict && typeof metricDict === "object" ? metricDict : {};
      const normalized = { ...source };

      METRIC_ALIAS_GROUPS.forEach(({ target, aliases }) => {
        if (hasOwn(normalized, target)) return;
        for (const key of aliases) {
          if (hasOwn(normalized, key)) {
            normalized[target] = normalized[key];
            break;
          }
        }
      });

      return normalized;
    },
    normalizeSeriesMap(seriesMap) {
      const raw = seriesMap && typeof seriesMap === "object" ? seriesMap : {};
      const normalized = {};

      Object.keys(raw).forEach((key) => {
        if (!Array.isArray(raw[key])) return;
        normalized[key] = raw[key].map((item) => toMetricNumber(item));
      });

      METRIC_ALIAS_GROUPS.forEach(({ target, aliases }) => {
        if (Array.isArray(normalized[target])) return;
        for (const key of aliases) {
          if (Array.isArray(normalized[key])) {
            normalized[target] = normalized[key].slice();
            break;
          }
        }
      });

      return normalized;
    },
    mergeSeriesSnapshot(key, incoming) {
      if (!Array.isArray(incoming)) return false;
      this.ensureMetricStore();
      const metricsMap = this.metrics.metrics;
      if (!Array.isArray(metricsMap[key])) this.$set(metricsMap, key, []);

      const target = metricsMap[key];
      let changed = false;

      for (let idx = 0; idx < incoming.length; idx += 1) {
        const nextValue = toMetricNumber(incoming[idx]);
        if (idx >= target.length) {
          target.push(nextValue);
          changed = true;
          continue;
        }
        if (target[idx] !== nextValue) {
          this.$set(target, idx, nextValue);
          changed = true;
        }
      }

      return changed;
    },
    mergeMetricsSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== "object") return;
      const normalizedMap = this.normalizeSeriesMap(snapshot.metrics || {});
      let changed = false;

      Object.keys(normalizedMap).forEach((key) => {
        const didChange = this.mergeSeriesSnapshot(key, normalizedMap[key]);
        changed = changed || didChange;
      });

      this.ensureMetricStore();
      const totalFromSnapshot = Number(snapshot.total_epochs);
      if (Number.isFinite(totalFromSnapshot) && totalFromSnapshot > 0) {
        const mergedTotal = Math.max(
          Number(this.metrics.total_epochs) || 0,
          Math.floor(totalFromSnapshot),
        );
        if (mergedTotal !== Number(this.metrics.total_epochs || 0)) {
          this.$set(this.metrics, "total_epochs", mergedTotal);
        }
      }

      this.syncEpochAndProgress();
      return changed;
    },
    upsertMetricEpoch(epoch, metricDict) {
      const idx = Math.floor(Number(epoch));
      if (!Number.isFinite(idx) || idx < 0) return false;

      this.ensureMetricStore();
      const normalized = this.normalizeIncomingMetricKeys(metricDict);
      const metricsMap = this.metrics.metrics;
      let changed = false;

      Object.keys(normalized).forEach((key) => {
        if (!Array.isArray(metricsMap[key])) this.$set(metricsMap, key, []);
        const arr = metricsMap[key];
        while (arr.length < idx) {
          arr.push(null);
          changed = true;
        }
        const nextValue = toMetricNumber(normalized[key]);
        if (idx >= arr.length) {
          arr.push(nextValue);
          changed = true;
          return;
        }
        if (arr[idx] !== nextValue) {
          this.$set(arr, idx, nextValue);
          changed = true;
        }
      });

      const nextTotal = Math.max(Number(this.metrics.total_epochs) || 0, idx + 1);
      if (nextTotal !== Number(this.metrics.total_epochs || 0)) {
        this.$set(this.metrics, "total_epochs", nextTotal);
      }

      this.syncEpochAndProgress();
      return changed;
    },
    syncEpochAndProgress() {
      const maxEpoch = this.inferMaxEpoch();
      if (maxEpoch > this.currentEpoch) this.currentEpoch = maxEpoch;

      const metricsTotal = Number(this.metrics && this.metrics.total_epochs) || 0;
      if (!this.totalEpochs && metricsTotal > 0) {
        this.totalEpochs = metricsTotal;
      }

      const total = Number(this.totalEpochs) || 0;
      if (total > 0 && maxEpoch > 0) {
        const nextProgress = Math.round((maxEpoch / total) * 100);
        if (nextProgress > this.progress) {
          this.progress = Math.min(100, nextProgress);
        }
      }
    },
    async syncSnapshot({ withStatus = true, withMetrics = true } = {}) {
      if (!this.jobId) return;
      let statusErr = null;
      let metricsErr = null;

      if (withStatus) {
        try {
          const statusResponse = await FetchTrainingJobsStatus(this.jobId);
          this.applyStatusPayload(statusResponse);
        } catch (err) {
          statusErr = err;
          console.error("Error fetching status snapshot:", err);
        }
      }

      if (withMetrics) {
        try {
          const metricsResponse = await FetchTrainingJobsMetrics_detailed(this.jobId);
          this.mergeMetricsSnapshot(metricsResponse);
        } catch (err) {
          metricsErr = err;
          console.error("Error fetching metrics snapshot:", err);
        }
      }

      if (statusErr && metricsErr) throw statusErr;
      if (statusErr && !this.status) throw statusErr;
      if (metricsErr && !this.metrics) throw metricsErr;
    },
    async startRealtimeSession() {
      if (!this.jobId) return;
      this.cleanupAllPolling();
      this.resetMetricsState();
      this.loading = true;

      try {
        await this.syncSnapshot({ withStatus: true, withMetrics: true });
        if (normalizeStatus(this.status) === 'completed') {
          this.refreshQualifiedStatus();
        }
        if (this.isTerminalStatus()) return;
        this.connectMetricsStream();
        if (!this.streamController) this.startFallbackPolling(true);
      } catch (err) {
        this.error = "获取训练状态失败。请重试。";
        this.streamNotice = "实时连接未建立，当前使用低频同步。";
        this.startFallbackPolling(true);
        console.error("Error starting realtime session:", err);
      } finally {
        this.loading = false;
      }
    },
    connectMetricsStream() {
      if (!this.jobId || this.isTerminalStatus()) return;
      if (this.streamController) this.closeMetricsStream();

      this.streamDone = false;
      this.streamController = openTrainingRunMetricsStream(
        this.jobId,
        {
          onOpen: () => {
            this.streamConnected = true;
            this.streamNotice = "";
            this.stopFallbackPolling();
          },
          onStatus: (payload) => {
            this.applyStatusPayload(payload || {});
          },
          onMetric: (payload) => {
            const data = payload && typeof payload === "object" ? payload : {};
            const metricId = Number(data.metric_id);
            if (Number.isFinite(metricId)) {
              this.streamLastMetricId = Math.max(this.streamLastMetricId || 0, metricId);
            }
            const progress = Number(data.progress);
            if (Number.isFinite(progress)) {
              this.progress = Math.max(this.progress || 0, Math.min(100, Math.round(progress)));
            }
            this.upsertMetricEpoch(data.epoch, data.metrics || {});
          },
          onEvent: (payload) => {
            const eventId = Number(payload && payload.event_id);
            if (Number.isFinite(eventId)) {
              this.streamLastEventId = Math.max(this.streamLastEventId || 0, eventId);
            }
          },
          onDone: async (payload) => {
            this.streamDone = true;
            this.streamConnected = false;
            if (payload && payload.status) this.status = normalizeStatus(payload.status);
            this.stopFallbackPolling();
            this.closeMetricsStream();
            this.streamNotice = "";
            try {
              await this.syncSnapshot({ withStatus: true, withMetrics: true });
              if (normalizeStatus(this.status) === 'completed') {
                this.refreshQualifiedStatus();
              }
            } catch (err) {
              console.error("Error syncing final metrics snapshot:", err);
            }
          },
          onError: (err) => {
            if (this.isTerminalStatus()) return;
            this.streamConnected = false;
            this.streamNotice = "实时连接中断，当前使用低频同步。";
            this.startFallbackPolling(true);
            console.error("Metrics stream error:", err);
          },
          onClose: () => {
            this.streamConnected = false;
            if (this.streamDone || this.isTerminalStatus()) return;
            if (!this.streamNotice) {
              this.streamNotice = "实时连接已断开，正在自动恢复。";
            }
            this.startFallbackPolling(true);
          },
          onReconnect: ({ delayMs } = {}) => {
            if (this.isTerminalStatus()) return;
            const secs = Math.max(1, Math.round(Number(delayMs || 0) / 1000));
            this.streamNotice = `实时连接中断，将在 ${secs} 秒后重连。`;
            this.startFallbackPolling(true);
          },
        },
        {
          fromMetricId: this.streamLastMetricId || null,
          fromEventId: this.streamLastEventId || null,
          minDelayMs: 1000,
          maxDelayMs: 30000,
          reconnectFactor: 1.8,
          jitterMs: 300,
        }
      );
    },
    closeMetricsStream() {
      if (!this.streamController) return;
      const controller = this.streamController;
      this.streamController = null;
      try {
        controller.close();
      } catch (_) {
        0;
      }
      this.streamConnected = false;
    },
    startFallbackPolling(immediate = false) {
      if (!this.jobId || this.streamConnected || this.streamDone || this.isTerminalStatus()) return;
      if (this.metricsPollingInterval) return;
      this.metricsPollingMs = Math.max(10_000, Number(this.fallbackPollingMs) || 12_000);
      if (immediate) this.fetchFallbackSnapshot();
      this.metricsPollingInterval = setInterval(() => {
        this.fetchFallbackSnapshot();
      }, this.metricsPollingMs);
    },
    stopFallbackPolling() {
      if (!this.metricsPollingInterval) return;
      clearInterval(this.metricsPollingInterval);
      this.metricsPollingInterval = null;
      this.metricsPollingMs = 0;
    },
    async fetchFallbackSnapshot() {
      if (!this.jobId || this.streamConnected || this.isTerminalStatus()) return;
      try {
        await this.syncSnapshot({ withStatus: true, withMetrics: true });
      } catch (err) {
        if (!this.metrics && !this.loading) {
          this.error = "获取指标失败。请重试。";
        }
        console.error("Error fetching fallback metrics snapshot:", err);
      }
    },
    cleanupAllPolling() {
      this.stopFallbackPolling();
      this.closeMetricsStream();
    },
    async handleStop() {
      try {
        await this.$confirm('确定要停止当前训练任务吗？', '确认停止', {
          confirmButtonText: '停止',
          cancelButtonText: '取消',
          type: 'warning'
        });
        
        this.stopping = true;
        await CancelTrainingJob(this.jobId);
        this.$message.success('已发送停止请求');
        await this.syncSnapshot({ withStatus: true, withMetrics: false });
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') {
          this.$message.error('停止失败: ' + (e.message || e));
        }
      } finally {
        this.stopping = false;
      }
    },
    async handleContinue() {
      try {
        await this.$confirm('确定要继续当前训练任务吗？', '确认继续', {
          confirmButtonText: '继续',
          cancelButtonText: '取消',
          type: 'info'
        });
        
        this.continueing = true;
        console.log("Sending resume request for jobId:", this.jobId);
        await ResumeTrainingJob(this.jobId);
        this.$message.success('已发送继续请求');
        await this.syncSnapshot({ withStatus: true, withMetrics: false });
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') {
          this.$message.error('继续失败: ' + (e.message || e));
        }
      } finally {
        this.continueing = false;
      }
    },
    async loadChartConfig() {
      try {
        const config = await fetchChartConfig("training_charts");
        if (config && typeof config === "object" && config.visibility) {
          this.chartVisibility = { ...config.visibility };
        }
        this.configLoaded = true;
      } catch (_) {
        this.configLoaded = true;
      }
    },
    async handleSaveChartConfig() {
      this.savingConfig = true;
      try {
        await saveChartConfig("training_charts", { visibility: this.chartVisibility });
        this.$message.success("\u56fe\u8868\u914d\u7f6e\u5df2\u4fdd\u5b58");
        this.showChartConfig = false;
      } catch (e) {
        this.$message.error("\u4fdd\u5b58\u5931\u8d25: " + (e.message || e));
      } finally {
        this.savingConfig = false;
      }
    },
    resetChartConfig() {
      const vis = {};
      (this.allMetricGroups || []).forEach(g => { vis[g.key] = true; });
      this.chartVisibility = vis;
    },
    openReport() {
      if (!this.jobId) {
        this.$message.warning('缺少训练任务 ID');
        return;
      }
      this.$router.push({ path: '/training-report', query: { runId: this.jobId } });
    },

    // --- Qualified Model Methods ---

    async refreshQualifiedStatus() {
      if (!this.jobId || normalizeStatus(this.status) !== 'completed') return;

      this.qualifiedStatus = {
        isQualified: false,
        modelVersionId: null,
        checking: true,
        loadingMark: false,
      };

      try {
        let modelVersionId = null;
        const versions = await fetchModelVersionsByRunId(this.jobId, 1, 5);
        if (versions.length > 0) {
          modelVersionId = versions[0].model_version_id || versions[0].id || null;
        } else {
          try {
            const registered = await registerModelVersionFromRun({
              run_id: this.jobId,
              version: `run-${String(this.jobId).slice(0, 8)}`,
              stage: 'development',
              description: 'Auto-registered from training run',
            });
            modelVersionId = registered?.model_version_id || registered?.id || null;
          } catch (regErr) {
            console.warn('Failed to auto-register model version:', regErr);
          }
        }

        this.qualifiedStatus.modelVersionId = modelVersionId;

        if (!modelVersionId) {
          this.qualifiedStatus.checking = false;
          return;
        }

        const qualifiedItems = await fetchQualifiedModelsByModelVersionId(modelVersionId);
        const isQualified = Array.isArray(qualifiedItems) && qualifiedItems.length > 0;
        this.qualifiedStatus.isQualified = isQualified;
      } catch (err) {
        console.warn(`Failed to check qualified status for job ${this.jobId}:`, err);
      } finally {
        this.qualifiedStatus.checking = false;
      }
    },

    async handleMarkQualified() {
      if (!this.qualifiedStatus?.modelVersionId) {
        this.$message.warning('未找到模型版本，请稍后重试');
        return;
      }

      try {
        await this.$confirm(
          '确认将该模型标记为合格吗？该操作不会重新训练或修改模型文件。',
          '确认标记',
          {
            confirmButtonText: '确认标记',
            cancelButtonText: '取消',
            type: 'info',
          }
        );
      } catch (_) {
        return;
      }

      this.qualifiedStatus.loadingMark = true;
      try {
        const result = await markModelAsQualified({
          model_version_id: this.qualifiedStatus.modelVersionId,
          qualified_by: '管理员',
          note: '',
        });

        if (result?.created) {
          this.$message.success(result?.message || '模型已标记为合格');
        } else {
          this.$message.success(result?.message || '模型已标记为合格');
        }
        this.qualifiedStatus.isQualified = true;
      } catch (err) {
        const errorMsg = this.getQualifiedErrorMessage(err);
        this.$message.error(errorMsg);
      } finally {
        this.qualifiedStatus.loadingMark = false;
      }
    },

    getQualifiedErrorMessage(err) {
      const msg = (err && err.message) || '';
      if (msg.includes('模型版本不存在')) return '未找到模型版本，请刷新后重试';
      if (msg.includes('训练任务不存在')) return '训练任务不存在或已被删除';
      if (msg.includes('训练任务已失败')) return '训练失败，不能标记为合格';
      if (msg.includes('仅 completed')) return '训练完成后才能标记为合格';
      if (/Network|timeout|fetch|Failed to fetch/i.test(msg)) return '标记失败，请检查网络后重试';
      return msg || '标记失败，请稍后重试';
    },
  },
  beforeDestroy() {
    this.cleanupAllPolling();
  }
};
</script>

<style scoped>
.train-manager {
  padding: 8px 12px 24px;
  font-family: "Space Grotesk", "Sora", "Manrope", "Segoe UI", sans-serif;
  color: var(--text-main);
}

.tm-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid #e2e8f0;
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
}

.tm-hero-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tm-status {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  background: #eff6ff;
  color: var(--color-primary);
  border: 1px solid #bfdbfe;
}

.tm-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: var(--text-main);
}

.tm-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.tm-hero-right {
  display: grid;
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: 12px;
}

.tm-stat {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--bg-body);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tm-stat span {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  font-weight: 600;
}

.tm-stat strong {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}

.tm-stat.action-stat {
    border: none;
    background: transparent;
    padding: 0;
    justify-content: center;
}

.tm-progress-card {
  margin-top: 20px;
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid #e2e8f0;
  box-shadow: var(--shadow-sm);
}

.tm-progress-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  font-weight: 500;
}

.tm-progress-bar {
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}

.tm-progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
  border-radius: 999px;
}

.tm-body {
  margin-top: 24px;
}

.state-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px dashed #cbd5e1;
  color: var(--text-secondary);
  font-size: 14px;
  box-shadow: none;
}

.state-card.error {
  color: #ef4444;
  border-color: #fca5a5;
  background: #fef2f2;
}

.metrics-container {
  margin-top: 16px;
}

.wait-eval-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
  border-radius: var(--radius-md);
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 20px;
}

.metric-card {
  position: relative;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 12px 0 16px;
  border: 1px solid #e2e8f0;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  grid-column: span 2;
  transition: all var(--transition-normal);
}

.metric-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.metric-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: #f1f5f9;
}

.refresh-note {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
}

.stream-note {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #b45309;
  font-size: 12px;
  font-weight: 500;
}

/* Status variants */
.status-running {
  background: #ecfdf5 !important;
  color: #059669 !important;
  border-color: #a7f3d0 !important;
}

.status-completed {
  background: #f0f9ff !important;
  color: #0284c7 !important;
  border-color: #bae6fd !important;
}

.status-failed,
.status-cancelled,
.status-deleted {
  background: #fef2f2 !important;
  color: #dc2626 !important;
  border-color: #fecaca !important;
}

.status-queued,
.status-created,
.status-pending {
  background: #fffbeb !important;
  color: #d97706 !important;
  border-color: #fde68a !important;
}

@media (max-width: 960px) {
  .tm-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .tm-hero-right {
    width: 100%;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card {
    grid-column: span 1;
  }
}

@media (max-width: 720px) {
  .tm-hero {
    padding: 18px;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }
}

.metric-card.is-wide {
  grid-column: span 3;
}

.metric-card.is-half {
  grid-column: span 3;
}

@media (max-width: 960px) {
  .metric-card.is-wide {
    grid-column: span 2;
  }

  .metric-card.is-half {
    grid-column: span 1;
  }
}

@media (max-width: 720px) {
  .metric-card.is-wide {
    grid-column: span 1;
  }
}

.chart-config-list {
  max-height: 400px;
  overflow-y: auto;
}

.chart-config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 8px;
  border-bottom: 1px solid #f1f5f9;
}

.chart-config-item:last-child {
  border-bottom: none;
}

.chart-config-label {
  font-size: 14px;
  color: var(--text-main, #1e293b);
}
</style>
