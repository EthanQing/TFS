<template>
  <div class="performance-page page-container">
    <header class="monitor-hero">
      <div class="hero-main">
        <div class="hero-eyebrow">Single Host Monitor</div>
        <h1 class="hero-title">性能监控</h1>
        <p class="hero-subtitle">
          统一查看当前主机的 CPU、内存、GPU 利用率与显存使用情况，并跟踪最近 {{ historyMinutes }} 分钟的变化趋势。
        </p>
      </div>
      <div class="hero-side">
        <div class="hero-chip">
          <i class="el-icon-data-analysis"></i>
          <span>单机监控</span>
        </div>
        <div class="hero-chip hero-chip-secondary">{{ gpuCountText }}</div>
        <div class="hero-meta">最近更新：{{ lastUpdatedText }}</div>
        <el-button
          type="primary"
          plain
          icon="el-icon-refresh"
          :loading="refreshing"
          @click="handleManualRefresh"
        >
          刷新
        </el-button>
      </div>
    </header>

    <section v-if="initialLoading && !hasAnyData" class="state-panel glass-panel">
      <i class="el-icon-loading"></i>
      <span>正在加载性能数据...</span>
    </section>

    <section v-else-if="error && !hasAnyData" class="state-panel glass-panel state-panel-error">
      <i class="el-icon-warning-outline"></i>
      <div>
        <div class="state-title">暂时无法加载性能监控数据</div>
        <div class="state-desc">{{ error }}</div>
      </div>
    </section>

    <template v-else>
      <section class="summary-grid">
        <article
          v-for="item in resourceItems"
          :key="item.key"
          class="summary-card glass-panel"
          :style="{ '--accent-color': item.color }"
        >
          <div class="summary-header">
            <span class="summary-name">{{ item.label }}</span>
            <span class="summary-tag">{{ item.detailHint }}</span>
          </div>
          <div class="summary-value">{{ item.headlineValue }}</div>
          <div class="summary-detail">{{ item.detailValue }}</div>
        </article>
      </section>

      <section class="detail-panel glass-panel">
        <div class="section-header">
          <div>
            <h2>当前主机资源详情</h2>
            <p>悬浮小面板与详情页保持同一口径，方便快速定位整机资源占用情况。</p>
          </div>
          <div class="section-side">
            <span class="section-chip">CPU / 内存 / GPU / 显存</span>
          </div>
        </div>

        <div class="detail-list">
          <div
            v-for="item in resourceItems"
            :key="`${item.key}-detail`"
            class="detail-item"
          >
            <div class="detail-head">
              <div>
                <div class="detail-label">{{ item.label }}</div>
                <div class="detail-hint">{{ item.detailHint }}</div>
              </div>
              <div class="detail-value">{{ item.detailValue }}</div>
            </div>
            <el-progress
              :percentage="progressValue(item.percent)"
              :show-text="false"
              :stroke-width="10"
              :color="item.color"
            ></el-progress>
          </div>
        </div>

        <div v-if="error" class="inline-error">{{ error }}</div>
      </section>

      <section class="gpu-panel glass-panel">
        <div class="section-header">
          <div>
            <h2>GPU 设备详情</h2>
            <p>单机模式下展示当前主机上所有 GPU 的实时利用率和显存占用。</p>
          </div>
          <div class="section-side">
            <span class="section-chip">{{ gpuCountText }}</span>
          </div>
        </div>

        <div v-if="!gpuDevices.length" class="chart-state">
          <i class="el-icon-data-analysis"></i>
          <span>当前主机未检测到可用 GPU，或暂时无法读取 GPU 指标。</span>
        </div>
        <div v-else class="gpu-grid">
          <article
            v-for="gpu in gpuDevices"
            :key="gpu.key"
            class="gpu-card"
          >
            <div class="gpu-card-header">
              <div>
                <div class="gpu-card-title">{{ gpu.title }}</div>
                <div class="gpu-card-name">{{ gpu.name }}</div>
              </div>
              <div class="gpu-card-meta">{{ gpu.utilizationText }}</div>
            </div>
            <div v-if="gpu.uuid" class="gpu-uuid">{{ gpu.uuid }}</div>

            <div class="gpu-metric-list">
              <div class="gpu-metric-row">
                <div class="gpu-metric-top">
                  <span class="gpu-metric-label">GPU 利用率</span>
                  <span class="gpu-metric-value">{{ gpu.utilizationText }}</span>
                </div>
                <el-progress
                  :percentage="progressValue(gpu.utilizationPercent)"
                  :show-text="false"
                  :stroke-width="8"
                  color="#8b5cf6"
                ></el-progress>
              </div>

              <div class="gpu-metric-row">
                <div class="gpu-metric-top">
                  <span class="gpu-metric-label">显存占用</span>
                  <span class="gpu-metric-value">{{ gpu.memoryText }}</span>
                </div>
                <el-progress
                  :percentage="progressValue(gpu.memoryPercent)"
                  :show-text="false"
                  :stroke-width="8"
                  color="#ec4899"
                ></el-progress>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="trend-panel glass-panel">
        <div class="section-header">
          <div>
            <h2>最近 {{ historyMinutes }} 分钟趋势</h2>
            <p>每 {{ stepSeconds }} 秒采样一次，展示 CPU / 内存 / GPU 利用率 / 显存占比变化。</p>
          </div>
          <div class="section-side">
            <span class="section-chip">{{ historyPoints.length }} 个采样点</span>
          </div>
        </div>

        <div v-if="historyLoading && !historyPoints.length" class="chart-state">
          <i class="el-icon-loading"></i>
          <span>正在加载趋势图...</span>
        </div>
        <div v-else-if="!historyPoints.length" class="chart-state">
          <i class="el-icon-data-analysis"></i>
          <span>暂无趋势数据</span>
        </div>
        <BaseChart
          v-else
          :options="trendOptions"
          height="360px"
        />
      </section>
    </template>
  </div>
</template>

<script>
import BaseChart from "@/components/Chart/BaseChart.vue";
import { metricsStore, subscribe, unsubscribe, refresh } from "@/store/metricsStore";
import {
  DEFAULT_HISTORY_MINUTES,
  DEFAULT_HISTORY_STEP_SECONDS,
  buildGpuDeviceItems,
  buildResourceItems,
  buildSystemMetricTrendOptions,
  formatMetricDateTime,
  getProgressValue,
} from "@/utils/systemMetrics";

export default {
  name: "PerformanceMonitor",
  components: {
    BaseChart,
  },
  data() {
    return {
      historyMinutes: DEFAULT_HISTORY_MINUTES,
      stepSeconds: DEFAULT_HISTORY_STEP_SECONDS,
    };
  },
  computed: {
    initialLoading() {
      return metricsStore.initialLoading;
    },
    refreshing() {
      return metricsStore.refreshing;
    },
    historyLoading() {
      return metricsStore.historyLoading;
    },
    error() {
      return metricsStore.error;
    },
    summary() {
      return metricsStore.summary;
    },
    historyPoints() {
      return metricsStore.historyPoints;
    },
    hasAnyData() {
      return !!this.summary || this.historyPoints.length > 0;
    },
    resourceItems() {
      return buildResourceItems(this.summary);
    },
    gpuDevices() {
      return buildGpuDeviceItems(this.summary);
    },
    gpuCountText() {
      return this.gpuDevices.length ? `${this.gpuDevices.length} 张 GPU` : "未检测到 GPU";
    },
    lastUpdatedText() {
      if (this.summary?.timestamp) return formatMetricDateTime(this.summary.timestamp);
      if (this.historyPoints.length) return formatMetricDateTime(this.historyPoints[this.historyPoints.length - 1].timestamp);
      return "--";
    },
    trendOptions() {
      return buildSystemMetricTrendOptions(this.historyPoints);
    },
  },
  created() {
    subscribe();
  },
  beforeDestroy() {
    unsubscribe();
  },
  methods: {
    progressValue(value) {
      return getProgressValue(value);
    },
    async handleManualRefresh() {
      await refresh();
    },
  },
};
</script>

<style scoped>
.performance-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.monitor-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
  padding: 2rem;
  border-radius: 22px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid rgba(219, 234, 254, 0.9);
  box-shadow: var(--shadow-md);
}

.hero-main {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hero-eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.hero-title {
  margin: 0;
  font-size: 2rem;
  color: var(--text-main);
}

.hero-subtitle {
  margin: 0;
  max-width: 760px;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.hero-side {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hero-chip,
.section-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 600;
}

.hero-chip-secondary {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.hero-meta {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.summary-card {
  padding: 1.25rem;
  border-radius: 18px;
  border-top: 4px solid var(--accent-color);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.summary-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
}

.summary-tag {
  font-size: 0.72rem;
  color: var(--text-light);
}

.summary-value {
  margin-top: 0.75rem;
  font-size: 1.85rem;
  font-weight: 800;
  color: var(--text-main);
}

.summary-detail {
  margin-top: 0.4rem;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.detail-panel,
.gpu-panel,
.trend-panel {
  padding: 1.5rem;
  border-radius: 22px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.section-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-main);
}

.section-header p {
  margin: 0.35rem 0 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.section-side {
  display: flex;
  align-items: center;
}

.detail-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.detail-item {
  padding: 1rem;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.96) 100%);
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-label {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-main);
}

.detail-hint {
  margin-top: 4px;
  font-size: 0.76rem;
  color: var(--text-light);
}

.detail-value {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: right;
}

.inline-error {
  margin-top: 1rem;
  font-size: 0.82rem;
  color: var(--color-danger);
}

.gpu-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.gpu-card {
  padding: 1.1rem;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.96) 100%);
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.gpu-card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.gpu-card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
}

.gpu-card-name {
  margin-top: 0.25rem;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.gpu-card-meta {
  font-size: 0.82rem;
  font-weight: 600;
  color: #8b5cf6;
}

.gpu-uuid {
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: var(--text-light);
  word-break: break-all;
}

.gpu-metric-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin-top: 1rem;
}

.gpu-metric-row {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.gpu-metric-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.gpu-metric-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-main);
}

.gpu-metric-value {
  font-size: 0.78rem;
  color: var(--text-secondary);
  text-align: right;
}

.chart-state,
.state-panel {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.state-panel {
  border-radius: 22px;
}

.state-panel-error {
  color: var(--color-danger);
}

.state-title {
  font-size: 1rem;
  font-weight: 700;
}

.state-desc {
  margin-top: 4px;
  font-size: 0.88rem;
  color: currentColor;
}

@media (max-width: 1200px) {
  .summary-grid,
  .detail-list,
  .gpu-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .monitor-hero,
  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-side {
    justify-content: flex-start;
  }
}
</style>
