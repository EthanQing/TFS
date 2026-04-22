export const DEFAULT_MONITOR_NODE_ID = "backend";
export const DEFAULT_MONITOR_NODE_TYPE = "backend";
export const DEFAULT_HISTORY_MINUTES = 10;
export const DEFAULT_HISTORY_STEP_SECONDS = 5;
export const DEFAULT_SUMMARY_REFRESH_MS = 5000;
export const DEFAULT_HISTORY_SYNC_MS = 60000;

const DEFAULT_HISTORY_WINDOW_MS = DEFAULT_HISTORY_MINUTES * 60 * 1000;

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampPercent(value) {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return Math.min(100, Math.max(0, n));
}

function toTimestampMs(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function derivePercent(used, total) {
  const usedNum = toNumberOrNull(used);
  const totalNum = toNumberOrNull(total);
  if (usedNum === null || totalNum === null || totalNum <= 0) return null;
  return clampPercent((usedNum / totalNum) * 100);
}

export function normalizeSystemMetric(raw = {}) {
  const memoryUsedMb = toNumberOrNull(raw.memory_used_mb ?? raw.memoryUsedMb);
  const memoryTotalMb = toNumberOrNull(raw.memory_total_mb ?? raw.memoryTotalMb);
  const gpuUsedMb = toNumberOrNull(raw.gpu_used_mb ?? raw.gpuUsedMb);
  const gpuTotalMb = toNumberOrNull(raw.gpu_total_mb ?? raw.gpuTotalMb);
  const gpuCount = Math.max(0, Number(raw.gpu_count ?? raw.gpuCount) || 0);
  const gpuAvailable = Boolean(
    (raw.gpu_available ?? raw.gpuAvailable) || gpuCount > 0 || (Array.isArray(raw.gpus) && raw.gpus.length)
  );

  return {
    timestamp: raw.timestamp || null,
    timestampMs: toTimestampMs(raw.timestamp),
    nodeId: String(raw.node_id ?? raw.nodeId ?? DEFAULT_MONITOR_NODE_ID),
    nodeType: String(raw.node_type ?? raw.nodeType ?? DEFAULT_MONITOR_NODE_TYPE),
    cpuPercent: clampPercent(raw.cpu_percent ?? raw.cpuPercent),
    memoryPercent: clampPercent(raw.memory_percent ?? raw.memoryPercent) ?? derivePercent(memoryUsedMb, memoryTotalMb),
    memoryUsedMb,
    memoryTotalMb,
    gpuAvailable,
    gpuCount,
    gpuPercent: gpuAvailable
      ? (clampPercent(raw.gpu_percent ?? raw.gpuPercent) ?? derivePercent(gpuUsedMb, gpuTotalMb))
      : null,
    gpuUsedMb,
    gpuTotalMb,
    gpus: Array.isArray(raw.gpus) ? raw.gpus : [],
  };
}

export function normalizeSystemMetricHistory(raw = {}) {
  const points = Array.isArray(raw.points) ? raw.points.map((item) => normalizeSystemMetric(item)) : [];
  return {
    nodeId: String(raw.node_id ?? raw.nodeId ?? DEFAULT_MONITOR_NODE_ID),
    nodeType: String(raw.node_type ?? raw.nodeType ?? DEFAULT_MONITOR_NODE_TYPE),
    windowSeconds: Math.max(0, Number(raw.window_seconds ?? raw.windowSeconds) || DEFAULT_HISTORY_MINUTES * 60),
    stepSeconds: Math.max(1, Number(raw.step_seconds ?? raw.stepSeconds) || DEFAULT_HISTORY_STEP_SECONDS),
    points,
  };
}

export function formatPercent(value, digits = 1) {
  const n = toNumberOrNull(value);
  if (n === null) return "--";
  return `${n.toFixed(digits)}%`;
}

export function formatMetricAmount(valueMb) {
  const n = toNumberOrNull(valueMb);
  if (n === null) return "--";
  if (Math.abs(n) >= 1024) {
    const gb = n / 1024;
    return `${gb.toFixed(Math.abs(gb) >= 100 ? 0 : 1)} GB`;
  }
  return `${n.toFixed(Math.abs(n) >= 100 ? 0 : 1)} MB`;
}

export function formatUsage(usedMb, totalMb) {
  const used = formatMetricAmount(usedMb);
  const total = formatMetricAmount(totalMb);
  if (used === "--" && total === "--") return "--";
  return `${used} / ${total}`;
}

export function formatMetricTime(value) {
  const ms = toTimestampMs(value);
  if (ms === null) return "--";
  return new Date(ms).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatMetricDateTime(value) {
  const ms = toTimestampMs(value);
  if (ms === null) return "--";
  return new Date(ms).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getProgressValue(value) {
  const n = toNumberOrNull(value);
  if (n === null) return 0;
  return Math.min(100, Math.max(0, Number(n.toFixed(1))));
}

function formatGpuCount(count) {
  const n = Math.max(0, Number(count) || 0);
  return `${n} 张 GPU`;
}

export function buildResourceItems(metric) {
  const normalized = metric ? normalizeSystemMetric(metric) : normalizeSystemMetric({});
  const gpuMemoryPercent = normalized.gpuAvailable
    ? derivePercent(normalized.gpuUsedMb, normalized.gpuTotalMb)
    : null;
  return [
    {
      key: "cpu",
      label: "CPU",
      percent: normalized.cpuPercent,
      headlineValue: formatPercent(normalized.cpuPercent),
      detailValue: formatPercent(normalized.cpuPercent),
      available: normalized.cpuPercent !== null,
      color: "#2563eb",
      detailHint: "实时占用",
    },
    {
      key: "memory",
      label: "内存",
      percent: normalized.memoryPercent,
      headlineValue: formatPercent(normalized.memoryPercent),
      detailValue: formatUsage(normalized.memoryUsedMb, normalized.memoryTotalMb),
      available: normalized.memoryTotalMb !== null,
      color: "#10b981",
      detailHint: "已用 / 总量",
    },
    {
      key: "gpu",
      label: "GPU",
      percent: normalized.gpuAvailable ? normalized.gpuPercent : null,
      headlineValue: normalized.gpuAvailable ? formatPercent(normalized.gpuPercent) : "N/A",
      detailValue: normalized.gpuAvailable ? formatGpuCount(normalized.gpuCount) : "不可用",
      available: normalized.gpuAvailable,
      color: "#8b5cf6",
      detailHint: normalized.gpuAvailable ? "平均利用率" : "当前主机无 GPU",
    },
    {
      key: "gpu-memory",
      label: "显存",
      percent: gpuMemoryPercent,
      headlineValue: normalized.gpuAvailable ? formatPercent(gpuMemoryPercent) : "N/A",
      detailValue: normalized.gpuAvailable ? formatUsage(normalized.gpuUsedMb, normalized.gpuTotalMb) : "不可用",
      available: normalized.gpuAvailable,
      color: "#ec4899",
      detailHint: normalized.gpuAvailable ? "已用 / 总量" : "当前主机无 GPU",
    },
  ];
}

export function buildGpuDeviceItems(metric) {
  const normalized = metric ? normalizeSystemMetric(metric) : normalizeSystemMetric({});
  return (Array.isArray(normalized.gpus) ? normalized.gpus : []).map((gpu, index) => {
    const gpuIndex = Math.max(0, Number(gpu.gpu_index ?? gpu.gpuIndex ?? index) || 0);
    const utilizationPercent = clampPercent(gpu.utilization_percent ?? gpu.utilizationPercent);
    const memoryUsedMb = toNumberOrNull(gpu.memory_used_mb ?? gpu.memoryUsedMb);
    const memoryTotalMb = toNumberOrNull(gpu.memory_total_mb ?? gpu.memoryTotalMb);
    const memoryPercent =
      clampPercent(gpu.memory_percent ?? gpu.memoryPercent) ?? derivePercent(memoryUsedMb, memoryTotalMb);

    return {
      key: `gpu-${gpuIndex}`,
      gpuIndex,
      title: `GPU ${gpuIndex}`,
      name: String(gpu.name || `GPU ${gpuIndex}`),
      uuid: gpu.uuid ? String(gpu.uuid) : "",
      utilizationPercent,
      utilizationText: formatPercent(utilizationPercent),
      memoryPercent,
      memoryText: formatUsage(memoryUsedMb, memoryTotalMb),
      progressPercent: utilizationPercent ?? memoryPercent,
    };
  });
}

export function mergeHistoryPoints(...groups) {
  const merged = new Map();
  groups.forEach((group) => {
    if (!Array.isArray(group)) return;
    group
      .map((item) => normalizeSystemMetric(item))
      .filter((item) => item.timestampMs !== null)
      .forEach((item) => {
        merged.set(String(item.timestampMs), item);
      });
  });
  return Array.from(merged.values()).sort((a, b) => a.timestampMs - b.timestampMs);
}

export function trimHistoryPoints(points, windowMs = DEFAULT_HISTORY_WINDOW_MS) {
  const sorted = mergeHistoryPoints(points);
  if (!sorted.length) return [];
  const latest = sorted[sorted.length - 1].timestampMs;
  if (latest === null) return sorted;
  return sorted.filter((item) => item.timestampMs !== null && latest - item.timestampMs <= windowMs);
}

export function buildSystemMetricTrendOptions(points = []) {
  const normalizedPoints = trimHistoryPoints(points);
  const labels = normalizedPoints.map((item) => formatMetricTime(item.timestamp));

  return {
    color: ["#2563eb", "#10b981", "#8b5cf6", "#ec4899"],
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderWidth: 0,
      textStyle: { color: "#fff" },
      formatter(params) {
        const rows = Array.isArray(params) ? params : [params];
        const title = rows[0]?.axisValueLabel || "--";
        const content = rows
          .map((row) => {
            const value = row && row.data != null ? formatPercent(row.data) : "--";
            return `<div style="display:flex;justify-content:space-between;gap:16px;">
              <span>${row.marker}${row.seriesName}</span>
              <strong>${value}</strong>
            </div>`;
          })
          .join("");
        return `<div style="min-width:140px;">
          <div style="margin-bottom:8px;font-weight:600;">${title}</div>
          ${content}
        </div>`;
      },
    },
    legend: {
      top: 0,
      right: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#475569" },
    },
    grid: {
      left: 16,
      right: 24,
      top: 52,
      bottom: 20,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: { color: "#64748b" },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitNumber: 5,
      axisLabel: {
        color: "#64748b",
        formatter(value) {
          return `${value}%`;
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
    },
    series: [
      {
        name: "CPU",
        type: "line",
        smooth: true,
        symbol: "none",
        data: normalizedPoints.map((item) => item.cpuPercent),
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.08 },
      },
      {
        name: "内存",
        type: "line",
        smooth: true,
        symbol: "none",
        data: normalizedPoints.map((item) => item.memoryPercent),
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.08 },
      },
      {
        name: "GPU",
        type: "line",
        smooth: true,
        symbol: "none",
        data: normalizedPoints.map((item) => item.gpuPercent),
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.08 },
      },
      {
        name: "显存",
        type: "line",
        smooth: true,
        symbol: "none",
        data: normalizedPoints.map((item) => derivePercent(item.gpuUsedMb, item.gpuTotalMb)),
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.08 },
      },
    ],
  };
}
