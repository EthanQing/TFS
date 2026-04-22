<template>
  <transition name="panel-fade">
    <div v-if="visible" class="performance-hover-panel glass-panel">
      <div class="panel-header">
        <div>
          <div class="panel-title">性能监控</div>
          <div class="panel-subtitle">当前主机资源概览</div>
        </div>
        <div class="panel-time">更新 {{ updatedText }}</div>
      </div>

      <div v-if="loading && !hasMetric" class="panel-state">
        <i class="el-icon-loading"></i>
        <span>正在获取性能数据...</span>
      </div>

      <div v-else-if="error && !hasMetric" class="panel-state panel-state-error">
        <i class="el-icon-warning-outline"></i>
        <span>{{ error }}</span>
      </div>

      <template v-else>
        <div class="summary-grid">
          <div
            v-for="item in resourceItems"
            :key="item.key"
            class="summary-card"
            :style="{ '--accent-color': item.color }"
          >
            <div class="summary-label">{{ item.label }}</div>
            <div class="summary-value">{{ item.headlineValue }}</div>
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
              :stroke-width="8"
              :color="item.color"
            ></el-progress>
          </div>
        </div>

        <div v-if="error" class="inline-error">{{ error }}</div>

        <div class="panel-footer">
          点击按钮进入本机性能监控页面
        </div>
      </template>
    </div>
  </transition>
</template>

<script>
import {
  buildResourceItems,
  formatMetricTime,
  getProgressValue,
} from "@/utils/systemMetrics";

export default {
  name: "PerformanceHoverPanel",
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    metric: {
      type: Object,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
      default: "",
    },
  },
  computed: {
    hasMetric() {
      return !!this.metric;
    },
    resourceItems() {
      return buildResourceItems(this.metric);
    },
    updatedText() {
      return this.metric?.timestamp ? formatMetricTime(this.metric.timestamp) : "--";
    },
  },
  methods: {
    progressValue(value) {
      return getProgressValue(value);
    },
  },
};
</script>

<style scoped>
.performance-hover-panel {
  position: absolute;
  left: calc(100% + 14px);
  bottom: 0;
  width: 340px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.panel-subtitle,
.panel-time {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.summary-card {
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.9) 100%);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-top: 3px solid var(--accent-color);
}

.summary-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.summary-value {
  margin-top: 8px;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-item {
  padding: 12px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.detail-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
}

.detail-hint {
  font-size: 0.72rem;
  color: var(--text-light);
}

.detail-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: right;
}

.panel-state {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.panel-state-error,
.inline-error {
  color: var(--color-danger);
}

.inline-error {
  margin-top: 12px;
  font-size: 0.78rem;
}

.panel-footer {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.panel-fade-enter,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
