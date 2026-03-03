function hasArray(v) {
  return Array.isArray(v);
}

function hasFinitePoint(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.some((v) => Number.isFinite(Number(v)));
}

function pickSeries(metrics, candidates, name) {
  for (const key of candidates || []) {
    const arr = metrics && metrics[key];
    if (hasArray(arr)) {
      return { name, data: arr, key };
    }
  }
  return null;
}

function normalizeEngine(engine) {
  return String(engine || "").trim().toLowerCase();
}

function addGroup(out, group) {
  const validSeries = (group.series || []).filter((s) => hasArray(s.data));
  if (!validSeries.length) return;
  out.push({ ...group, series: validSeries });
}

function buildUltralyticsGroups(metrics) {
  const groups = [];
  addGroup(groups, {
    key: "metrics/mAP50-95(B)",
    title: "mAP50-95(B)",
    yAxis: "",
    isWide: true,
    series: [pickSeries(metrics, ["metrics/mAP50-95(B)"], "指标")].filter(Boolean),
  });
  addGroup(groups, {
    key: "metrics/mAP50(B)",
    title: "mAP50(B)",
    yAxis: "",
    isWide: true,
    series: [pickSeries(metrics, ["metrics/mAP50(B)"], "指标")].filter(Boolean),
  });
  addGroup(groups, {
    key: "metrics/precision(B)",
    title: "Precision(B)",
    yAxis: "",
    isHalf: true,
    series: [pickSeries(metrics, ["metrics/precision(B)"], "指标")].filter(Boolean),
  });
  addGroup(groups, {
    key: "metrics/recall(B)",
    title: "Recall(B)",
    yAxis: "",
    isHalf: true,
    series: [pickSeries(metrics, ["metrics/recall(B)"], "指标")].filter(Boolean),
  });
  addGroup(groups, {
    key: "box_loss",
    title: "Box Loss",
    yAxis: "Loss",
    series: [
      pickSeries(metrics, ["train/box_loss"], "训练集"),
      pickSeries(metrics, ["val/box_loss"], "验证集"),
    ].filter(Boolean),
  });
  addGroup(groups, {
    key: "cls_loss",
    title: "Cls Loss",
    yAxis: "Loss",
    series: [
      pickSeries(metrics, ["train/cls_loss"], "训练集"),
      pickSeries(metrics, ["val/cls_loss"], "验证集"),
    ].filter(Boolean),
  });
  addGroup(groups, {
    key: "dfl_loss",
    title: "Dfl Loss",
    yAxis: "Loss",
    series: [
      pickSeries(metrics, ["train/dfl_loss"], "训练集"),
      pickSeries(metrics, ["val/dfl_loss"], "验证集"),
    ].filter(Boolean),
  });
  addGroup(groups, {
    key: "lr",
    title: "Lr",
    yAxis: "",
    series: [pickSeries(metrics, ["lr", "train/lr", "train/learning_rate"], "value")].filter(Boolean),
  });
  return groups;
}

function buildPaddleGroups(metrics) {
  const groups = [];
  addGroup(groups, {
    key: "metrics/mAP50-95(B)",
    title: "mAP50-95(B)",
    yAxis: "",
    isWide: true,
    series: [
      pickSeries(metrics, ["metrics/mAP50-95(B)", "mAP", "eval/bbox_mAP", "eval/bbox_map"], "指标"),
    ].filter(Boolean),
  });
  addGroup(groups, {
    key: "metrics/mAP50(B)",
    title: "mAP50(B)",
    yAxis: "",
    isWide: true,
    series: [
      pickSeries(metrics, ["metrics/mAP50(B)", "AP50", "mAP50", "eval/bbox_AP50", "eval/bbox_ap50"], "指标"),
    ].filter(Boolean),
  });
  addGroup(groups, {
    key: "metrics/precision(B)",
    title: "Precision(B)",
    yAxis: "",
    isHalf: true,
    series: [
      pickSeries(metrics, ["metrics/precision(B)", "precision", "eval/bbox_precision"], "指标"),
    ].filter(Boolean),
  });
  addGroup(groups, {
    key: "metrics/recall(B)",
    title: "Recall(B)",
    yAxis: "",
    isHalf: true,
    series: [pickSeries(metrics, ["metrics/recall(B)", "recall", "eval/bbox_recall"], "指标")].filter(Boolean),
  });

  const lossDefs = [
    ["loss", "Loss"],
    ["loss_cls", "Loss Cls"],
    ["loss_iou", "Loss Iou"],
    ["loss_dfl", "Loss Dfl"],
    ["loss_l1", "Loss L1"],
    ["lr", "Lr"],
  ];
  lossDefs.forEach(([key, title]) => {
    addGroup(groups, {
      key,
      title,
      yAxis: key === "lr" ? "" : "Loss",
      series: [pickSeries(metrics, [key, `train/${key}`], "value")].filter(Boolean),
    });
  });
  return groups;
}

function formatMetricTitle(name) {
  return String(name || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatSeriesName(name) {
  const n = String(name || "").toLowerCase();
  if (n === "train") return "训练集";
  if (n === "val") return "验证集";
  if (n === "test") return "测试集";
  if (n === "metrics") return "指标";
  return name || "value";
}

function buildFallbackGroups(metrics) {
  const keys = Object.keys(metrics || {});
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
        title: formatMetricTitle(metricName),
        yAxis: "",
        series: [],
      });
    }
    groups.get(groupKey).series.push({
      name: formatSeriesName(prefix),
      data: hasArray(metrics[key]) ? metrics[key] : [],
      key,
    });
  });
  const list = Array.from(groups.values());
  list.forEach((g) => {
    g.series.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh"));
    const k = String(g.key).toLowerCase();
    if (k.includes("map")) g.isWide = true;
    if (k.includes("precision") || k.includes("recall")) g.isHalf = true;
  });
  list.sort((a, b) => String(a.title).localeCompare(String(b.title), "zh"));
  return list;
}

export function buildMetricGroups(engine, metricsMap) {
  const metrics = metricsMap && typeof metricsMap === "object" ? metricsMap : {};
  const engineNorm = normalizeEngine(engine);
  if (engineNorm === "ultralytics-yolo") {
    const groups = buildUltralyticsGroups(metrics);
    return groups.length ? groups : buildFallbackGroups(metrics);
  }
  if (engineNorm === "paddle-det") {
    const groups = buildPaddleGroups(metrics);
    return groups.length ? groups : buildFallbackGroups(metrics);
  }
  return buildFallbackGroups(metrics);
}

export function hasAccuracyCurves(metricsMap) {
  const metrics = metricsMap && typeof metricsMap === "object" ? metricsMap : {};
  const keys = [
    "metrics/mAP50(B)",
    "metrics/mAP50-95(B)",
    "AP50",
    "mAP",
    "mAP50",
    "eval/bbox_AP50",
    "eval/bbox_mAP",
  ];
  return keys.some((k) => hasFinitePoint(metrics[k]));
}

