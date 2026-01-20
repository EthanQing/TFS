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
            ></chart>
          </div>
        </div>
      </div>

      <div v-if="refreshHint" class="refresh-note">
        <i class="el-icon-circle-check"></i>
        <span>{{ refreshHint }}</span>
      </div>
    </section>
  </div>
</template>

<script>
import chart from "@/components/Chart/TrainingChart.vue";
import {
  FetchTrainingJobsStatus,
  FetchTrainingJobsMetrics_detailed
} from "@/api/training";

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
      statusPollingInterval: null,
      metricsPollingInterval: null,
      metricsPollingMs: 0,
      currentEpoch: 0,
      totalEpochs: 0,
      progress: 0,
      metricsStableCount: 0,
      lastMetricsSignature: "",
      terminalMode: false,
      terminalPolls: 0,
      maxTerminalPolls: 3
    };
  },
  computed: {
    statusLabel() {
      const s = String(this.status || "").toLowerCase();
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
      const s = String(this.status || "pending").toLowerCase();
      return `status-${s || "pending"}`;
    },
    refreshLabel() {
      if (this.metricsPollingInterval) {
        return this.isTerminalStatus() ? "正在完成" : "实时";
      }
      if (this.isTerminalStatus()) return "已停止";
      return "空闲";
    },
    refreshHint() {
      if (this.isTerminalStatus() && !this.metricsPollingInterval && this.metrics) {
        return "完成后自动刷新已停止。";
      }
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
    metricGroups() {
      const data = (this.metrics && this.metrics.metrics) || {};
      const keys = Object.keys(data || {});
      if (!keys.length) return [];

      const groups = new Map();
      keys.forEach((key) => {
        const parts = String(key).split("/");
        let prefix = "value";
        let metricName = String(key);
        if (parts.length > 1) {
          prefix = parts.slice(0, -1).join("/") || "value";
          metricName = parts[parts.length - 1] || key;
        }

        const groupKey = metricName;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            key: groupKey,
            title: this.formatMetricTitle(metricName),
            yAxis: "",
            series: []
          });
        }

        groups.get(groupKey).series.push({
          name: this.formatSeriesName(prefix),
          data: Array.isArray(data[key]) ? data[key] : []
        });
      });

      const list = Array.from(groups.values());
      
      // Define priority for sorting: mAP first, then others
      const getPriority = (key) => {
        const k = String(key).toLowerCase();
        if (k.includes("map")) return 3; // Highest priority
        if (k.includes("precision") || k.includes("recall")) return 2;
        if (k.includes("loss")) return 1;
        return 0;
      };

      list.forEach((g) => {
        g.series.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh"));
        const k = String(g.key).toLowerCase();
        // Layout: first 2 rows are 2-up (mAP + Precision/Recall), third row is 3-up (losses).
        if (k.includes("map")) g.isWide = true;
        if (k.includes("precision") || k.includes("recall")) g.isHalf = true;
      });

      list.sort((a, b) => {
        const pA = getPriority(a.key);
        const pB = getPriority(b.key);
        if (pA !== pB) return pB - pA; // Descending priority
        return String(a.title).localeCompare(String(b.title), "zh");
      });

      return list;
    }
  },
  watch: {
    "$route.query.jobId": {
      immediate: true,
      handler(newJobId) {
        if (newJobId) {
          this.jobId = newJobId;
          this.resetMetricsState();
          this.cleanupAllPolling();
          this.startStatusPolling();
          localStorage.setItem("currentJobId", newJobId);
        }
      }
    }
  },
  activated() {
    const storedJobId = localStorage.getItem("currentJobId");
    const routeJobId = this.$route.query.jobId;

    if (!this.jobId && storedJobId) {
      this.jobId = storedJobId;
      this.resetMetricsState();
      this.cleanupAllPolling();
      this.startStatusPolling();
    } else if (routeJobId && this.jobId !== routeJobId) {
      this.jobId = routeJobId;
      this.resetMetricsState();
      this.cleanupAllPolling();
      this.startStatusPolling();
    }
  },
  methods: {
    resetMetricsState() {
      this.metrics = null;
      this.error = null;
      this.metricsStableCount = 0;
      this.lastMetricsSignature = "";
      this.terminalMode = false;
      this.terminalPolls = 0;
    },
    formatMetricTitle(name) {
      return String(name || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
    },
    formatSeriesName(name) {
      const n = String(name || "").toLowerCase();
      if (n === "train") return "训练集";
      if (n === "val") return "验证集";
      if (n === "test") return "测试集";
      if (n === "metrics") return "指标";
      return name || "值";
    },
    computeMetricsSignature() {
      const data = (this.metrics && this.metrics.metrics) || {};
      const keys = Object.keys(data).sort();
      const parts = keys.map((k) => {
        const arr = Array.isArray(data[k]) ? data[k] : [];
        const len = arr.length;
        const last = len ? arr[len - 1] : null;
        return `${k}:${len}:${last}`;
      });
      return parts.join("|");
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
      return ["completed", "failed", "cancelled", "deleted"].includes(String(this.status || "").toLowerCase());
    },
    startStatusPolling() {
      if (!this.jobId) return;
      this.fetchStatus();
      this.statusPollingInterval = setInterval(this.fetchStatus, 12000);
    },
    async fetchStatus() {
      if (!this.jobId) return;
      this.loading = true;
      try {
        const statusResponse = await FetchTrainingJobsStatus(this.jobId);
        this.status = statusResponse.status;
        if (Number.isFinite(Number(statusResponse.progress))) this.progress = Number(statusResponse.progress);
        if (Number.isFinite(Number(statusResponse.total_epochs))) {
          this.totalEpochs = Number(statusResponse.total_epochs) || this.totalEpochs || 0;
        }
        if (Number.isFinite(Number(statusResponse.current_epoch))) {
          this.currentEpoch = Number(statusResponse.current_epoch) + 1;
        }

        if (this.status === "running") {
          this.startMetricsPolling(4000);
        } else if (this.isTerminalStatus()) {
          if (!this.terminalMode) {
            this.terminalMode = true;
            this.cleanupStatusPolling();
          }
          this.startMetricsPolling(2000);
        } else {
          this.startMetricsPolling(8000);
        }
      } catch (err) {
        this.error = "获取训练状态失败。请重试。";
        console.error("Error fetching status:", err);
        this.cleanupAllPolling();
      } finally {
        this.loading = false;
      }
    },
    startMetricsPolling(intervalMs = 4000) {
      if (!this.jobId) return;
      const ms = Math.max(1500, Number(intervalMs) || 4000);
      if (this.metricsPollingInterval && this.metricsPollingMs === ms) return;
      this.stopMetricsPolling();
      this.metricsPollingMs = ms;
      this.fetchMetrics();
      this.metricsPollingInterval = setInterval(this.fetchMetrics, ms);
    },
    stopMetricsPolling() {
      if (this.metricsPollingInterval) {
        clearInterval(this.metricsPollingInterval);
        this.metricsPollingInterval = null;
        this.metricsPollingMs = 0;
      }
    },
    isMetricsComplete() {
      const total = Number(this.totalEpochs) || Number(this.metrics?.total_epochs) || 0;
      const maxLen = this.inferMaxEpoch();
      if (!total) return maxLen > 0;
      return maxLen >= total;
    },
    async fetchMetrics() {
      if (!this.jobId) return;
      this.loading = true;
      try {
        const metricsResponse = await FetchTrainingJobsMetrics_detailed(this.jobId);
        this.metrics = metricsResponse;
        
        // Sync currentEpoch with actual metrics data length
        const metricsEpoch = this.inferMaxEpoch();
        if (metricsEpoch > this.currentEpoch) {
          this.currentEpoch = metricsEpoch;
        }
        // Update progress based on metrics if total epochs is known
        if (this.totalEpochs > 0 && metricsEpoch > 0) {
          const metricsProgress = Math.round((metricsEpoch / this.totalEpochs) * 100);
          if (metricsProgress > this.progress) {
            this.progress = metricsProgress;
          }
        }
        
        const signature = this.computeMetricsSignature();
        if (signature && signature === this.lastMetricsSignature) {
          this.metricsStableCount += 1;
        } else {
          this.metricsStableCount = 0;
          this.lastMetricsSignature = signature;
        }

        if (this.terminalMode) {
          this.terminalPolls += 1;
          const shouldStop =
            this.metricsStableCount >= 2 ||
            this.isMetricsComplete() ||
            this.terminalPolls >= this.maxTerminalPolls;
          if (shouldStop) {
            this.stopMetricsPolling();
          }
        }
      } catch (err) {
        console.error("Error fetching metrics:", err);
        if (!this.metrics) {
          this.error = "获取指标失败。请重试。";
        }
      } finally {
        this.loading = false;
      }
    },
    cleanupStatusPolling() {
      if (this.statusPollingInterval) {
        clearInterval(this.statusPollingInterval);
        this.statusPollingInterval = null;
      }
    },
    cleanupAllPolling() {
      this.cleanupStatusPolling();
      this.stopMetricsPolling();
    }
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
</style>
