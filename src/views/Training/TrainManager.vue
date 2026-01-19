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
        <div class="tm-stat">
          <span>图表</span>
          <strong>{{ metricGroups.length }}</strong>
        </div>
        <div class="tm-stat">
          <span>状态</span>
          <strong>{{ refreshLabel }}</strong>
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
          <div v-for="group in metricGroups" :key="group.key" class="metric-card" :class="{ 'is-wide': group.isWide }">
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
        // Mark mAP metrics as wide
        if (String(g.key).toLowerCase().includes("map")) {
          g.isWide = true;
          // Use a slightly better title if needed, but keeping existing logic is fine
        }
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
  --ink-900: #111315;
  --ink-700: #3e4a5b;
  --ink-500: #6a7482;
  --line-200: #e4e7ee;
  --brand-700: #2b3a67;
  --brand-500: #4f63c7;
  --brand-300: #9bb0ff;
  --card-shadow: 0 18px 35px rgba(16, 18, 24, 0.12);
  padding: 8px 12px 24px;
  font-family: "Space Grotesk", "Sora", "Manrope", "Segoe UI", sans-serif;
  color: var(--ink-900);
}

.tm-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  padding: 20px 24px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: var(--text-main);
  box-shadow: none;
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
  color: #3b82f6;
  border: 1px solid #dbeafe;
}

.tm-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
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
  padding: 10px 12px;
  border-radius: 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tm-stat span {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
}

.tm-stat strong {
  font-size: 16px;
  font-weight: 700;
}

.tm-progress-card {
  margin-top: 18px;
  padding: 16px 20px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid var(--line-200);
  box-shadow: 0 8px 18px rgba(16, 18, 24, 0.08);
}

.tm-progress-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  color: var(--ink-500);
  margin-bottom: 10px;
}

.tm-progress-bar {
  height: 10px;
  background: #edf0f6;
  border-radius: 999px;
  overflow: hidden;
}

.tm-progress-fill {
  height: 100%;
  background: #9ca3af;
  transition: width 0.3s ease;
}

.tm-body {
  margin-top: 20px;
}

.state-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--line-200);
  color: var(--ink-500);
  font-size: 14px;
  box-shadow: 0 8px 18px rgba(16, 18, 24, 0.08);
}

.state-card.error {
  color: #e11d48;
  border-color: rgba(225, 29, 72, 0.2);
}

.metrics-container {
  margin-top: 10px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 18px;
}

.metric-card {
  position: relative;
  background: #ffffff;
  border-radius: 18px;
  padding: 8px 0 14px;
  border: 1px solid #eef0f6;
  box-shadow: 0 12px 30px rgba(17, 19, 21, 0.1);
  overflow: hidden;
}

.metric-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: #e5e7eb;
}

.refresh-note {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2563eb;
  font-size: 12px;
}

.status-running {
  background: rgba(34, 197, 94, 0.22);
}

.status-completed {
  background: rgba(34, 197, 94, 0.22);
}

.status-failed,
.status-cancelled,
.status-deleted {
  background: rgba(225, 29, 72, 0.2);
}

.status-queued,
.status-created,
.status-pending {
  background: rgba(249, 216, 110, 0.25);
  color: #1f2937;
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
  grid-column: span 2;
}

@media (max-width: 960px) {
  .metric-card.is-wide {
    grid-column: span 1;
  }
}
</style>
