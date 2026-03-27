/**
 * 共享的系统性能指标 Store
 *
 * 使用引用计数管理单一轮询循环,确保悬浮面板与监控页面
 * 展示完全相同的数据和更新时间。
 */
import Vue from "vue";
import {
  fetchSystemMetricsSummary,
  fetchSystemMetricsHistory,
} from "@/api/systemMetrics";
import {
  DEFAULT_MONITOR_NODE_ID,
  DEFAULT_MONITOR_NODE_TYPE,
  DEFAULT_SUMMARY_REFRESH_MS,
  DEFAULT_HISTORY_SYNC_MS,
  DEFAULT_HISTORY_MINUTES,
  DEFAULT_HISTORY_STEP_SECONDS,
  normalizeSystemMetric,
  normalizeSystemMetricHistory,
  mergeHistoryPoints,
  trimHistoryPoints,
} from "@/utils/systemMetrics";

const HISTORY_WINDOW_MS = DEFAULT_HISTORY_MINUTES * 60 * 1000;

export const metricsStore = Vue.observable({
  /** 当前快照（已 normalize） */
  summary: null,
  /** 历史采样点数组 */
  historyPoints: [],
  /** 首次加载中 */
  initialLoading: false,
  /** 正在刷新中 */
  refreshing: false,
  /** 历史数据加载中 */
  historyLoading: false,
  /** 错误信息 */
  error: "",
});

/* ---------- 内部状态 ---------- */
let _refCount = 0;
let _summaryTimer = null;
let _historyTimer = null;
let _bootstrapped = false;

function _trimPoints(points) {
  return trimHistoryPoints(points, HISTORY_WINDOW_MS);
}

/* ---------- 数据获取 ---------- */

async function _loadSummary({ silent = false, appendToHistory = true } = {}) {
  if (!silent) metricsStore.refreshing = true;
  try {
    const data = await fetchSystemMetricsSummary({
      nodeId: DEFAULT_MONITOR_NODE_ID,
      nodeType: DEFAULT_MONITOR_NODE_TYPE,
    });
    const metric = normalizeSystemMetric(data);
    metricsStore.summary = metric;
    metricsStore.error = "";
    if (appendToHistory) {
      metricsStore.historyPoints = _trimPoints(
        mergeHistoryPoints(metricsStore.historyPoints, [metric])
      );
    }
    return metric;
  } catch (e) {
    const message = e?.message || "获取性能概览失败";
    if (!metricsStore.summary || !silent) metricsStore.error = message;
    throw e;
  } finally {
    if (!silent) metricsStore.refreshing = false;
  }
}

async function _loadHistory({ silent = false } = {}) {
  if (!silent) metricsStore.historyLoading = true;
  try {
    const raw = await fetchSystemMetricsHistory({
      minutes: DEFAULT_HISTORY_MINUTES,
      node: DEFAULT_MONITOR_NODE_ID,
      nodeType: DEFAULT_MONITOR_NODE_TYPE,
      stepSeconds: DEFAULT_HISTORY_STEP_SECONDS,
    });
    const history = normalizeSystemMetricHistory(raw);
    metricsStore.historyPoints = _trimPoints(
      mergeHistoryPoints(history.points, metricsStore.summary ? [metricsStore.summary] : [])
    );
    if (!metricsStore.summary && metricsStore.historyPoints.length) {
      metricsStore.summary = metricsStore.historyPoints[metricsStore.historyPoints.length - 1];
    }
    return metricsStore.historyPoints;
  } catch (e) {
    const message = e?.message || "获取趋势数据失败";
    if (!metricsStore.historyPoints.length || !silent) {
      metricsStore.error = metricsStore.summary ? (metricsStore.error || message) : message;
    }
    throw e;
  } finally {
    if (!silent) metricsStore.historyLoading = false;
  }
}

/* ---------- 定时器管理 ---------- */

function _startTimers() {
  _stopTimers();
  _summaryTimer = window.setInterval(() => {
    _loadSummary({ silent: true, appendToHistory: true }).catch(() => {});
  }, DEFAULT_SUMMARY_REFRESH_MS);
  _historyTimer = window.setInterval(() => {
    _loadHistory({ silent: true }).catch(() => {});
  }, DEFAULT_HISTORY_SYNC_MS);
}

function _stopTimers() {
  if (_summaryTimer) {
    clearInterval(_summaryTimer);
    _summaryTimer = null;
  }
  if (_historyTimer) {
    clearInterval(_historyTimer);
    _historyTimer = null;
  }
}

/* ---------- 公开 API ---------- */

/**
 * 订阅轮询 — 引用计数 +1。
 * 首次订阅时立即拉取数据并启动定时器。
 */
export async function subscribe() {
  _refCount++;
  if (_refCount === 1) {
    if (!_bootstrapped) {
      metricsStore.initialLoading = true;
      const [sRes, hRes] = await Promise.allSettled([
        _loadSummary({ silent: true, appendToHistory: false }),
        _loadHistory({ silent: true }),
      ]);
      if (sRes.status === "rejected" && hRes.status === "rejected") {
        metricsStore.error = sRes.reason?.message || hRes.reason?.message || "获取性能监控数据失败";
      }
      metricsStore.initialLoading = false;
      _bootstrapped = true;
    }
    _startTimers();
  }
}

/**
 * 取消订阅 — 引用计数 -1。
 * 所有订阅者都退出后停止定时器。
 */
export function unsubscribe() {
  _refCount = Math.max(0, _refCount - 1);
  if (_refCount === 0) {
    _stopTimers();
  }
}

/**
 * 手动刷新 — 立即拉取摘要 + 历史。
 */
export async function refresh() {
  await Promise.allSettled([
    _loadSummary({ silent: false, appendToHistory: true }),
    _loadHistory({ silent: false }),
  ]);
}
