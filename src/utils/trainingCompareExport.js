let xlsxModulePromise = null;

function getXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx").then((mod) => mod.default || mod);
  }
  return xlsxModulePromise;
}

function isFormulaLike(value) {
  if (typeof value !== "string" || !value.length) return false;
  const first = value.charAt(0);
  return first === "=" || first === "+" || first === "-" || first === "@";
}

function toPrimitive(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

export function sanitizeCell(value) {
  const normalized = toPrimitive(value);
  if (typeof normalized === "string" && isFormulaLike(normalized)) {
    return `'${normalized}`;
  }
  return normalized;
}

function sheetName(name, fallback) {
  const raw = String(name || fallback || "Sheet").trim() || "Sheet";
  const cleaned = raw.replace(new RegExp("[:\\\\/?*\\[\\]]", "g"), "_");
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
}

function runColumnLabel(run, idx) {
  const runName = String(run?.name || "").trim();
  const runId = String(run?.runId || "").trim();
  if (runName && runId) return `${runName} (${runId.slice(0, 8)})`;
  if (runName) return runName;
  if (runId) return runId;
  return `Run ${idx + 1}`;
}

function computeBestValue(valuesByRun = {}) {
  const numbers = Object.values(valuesByRun)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
  if (!numbers.length) return "";
  return Math.max(...numbers);
}

export function normalizeSeriesToRows(series = []) {
  const entries = Array.isArray(series) ? series : [];
  const maxLen = entries.reduce((acc, item) => {
    const values = Array.isArray(item?.values) ? item.values : [];
    return Math.max(acc, values.length);
  }, 0);

  const rows = [];
  for (let i = 0; i < maxLen; i += 1) {
    const row = { epoch: i + 1, valuesByRun: {} };
    entries.forEach((item) => {
      const runId = String(item?.runId || "");
      if (!runId) return;
      const values = Array.isArray(item?.values) ? item.values : [];
      row.valuesByRun[runId] = i < values.length ? values[i] : null;
    });
    rows.push(row);
  }
  return rows;
}

function buildSummarySheet(payload, runLabels) {
  const rows = [];
  rows.push(["导出时间", sanitizeCell(payload.exportedAt || new Date().toISOString())]);
  rows.push(["来源页面", sanitizeCell(payload.source || "")]);
  rows.push(["框架", sanitizeCell(payload.frameworkLabel || "")]);
  rows.push(["任务数量", sanitizeCell((payload.runs || []).length)]);
  rows.push(["baseline_run_id", sanitizeCell(payload.baselineRunId || "")]);
  rows.push([]);
  rows.push(["run_id", "name", "status", "engine", "framework"]);
  (payload.runs || []).forEach((run, idx) => {
    rows.push([
      sanitizeCell(run?.runId || ""),
      sanitizeCell(run?.name || runLabels[idx] || ""),
      sanitizeCell(run?.status || ""),
      sanitizeCell(run?.engine || ""),
      sanitizeCell(run?.frameworkLabel || run?.frameworkKey || ""),
    ]);
  });
  return rows;
}

function buildParameterSheet(payload, runLabels, runIds) {
  const rows = [];
  rows.push(["参数", ...runLabels, "是否差异"]);
  (payload.parameterRows || []).forEach((row) => {
    const values = runIds.map((id) => sanitizeCell(row?.valuesByRun?.[id]));
    rows.push([sanitizeCell(row?.key || ""), ...values, row?.isDiff ? "Yes" : "No"]);
  });
  if (rows.length === 1) rows.push(["暂无参数数据"]);
  return rows;
}

function buildMetricsSheet(payload, runLabels, runIds) {
  const includeDelta = !!String(payload?.baselineRunId || "");
  const rows = [];
  const headers = ["指标", ...runLabels, "best"];
  if (includeDelta) {
    runLabels.forEach((label) => {
      headers.push(`delta_vs_baseline(${label})`);
      headers.push(`delta_percent(${label})`);
    });
  }
  rows.push(headers);
  (payload.metricRows || []).forEach((row) => {
    const values = runIds.map((id) => sanitizeCell(row?.valuesByRun?.[id]));
    const best = row?.best !== undefined && row?.best !== null ? row.best : computeBestValue(row?.valuesByRun);
    const line = [sanitizeCell(row?.key || ""), ...values, sanitizeCell(best)];
    if (includeDelta) {
      runIds.forEach((runId) => {
        const deltaAbs = row?.deltaByRun?.[runId]?.delta_abs;
        const deltaPct = row?.deltaByRun?.[runId]?.delta_percent;
        line.push(sanitizeCell(deltaAbs ?? ""));
        line.push(sanitizeCell(deltaPct ?? ""));
      });
    }
    rows.push(line);
  });
  if (rows.length === 1) rows.push(["暂无指标数据"]);
  return rows;
}

function buildCurveSheet(curveSheet, runLabelById) {
  const series = Array.isArray(curveSheet?.series) ? curveSheet.series : [];
  if (!series.length) return [["暂无该曲线数据"]];

  const headers = ["epoch", ...series.map((item) => runLabelById[item.runId] || item.runName || item.runId)];
  const rows = [headers];
  const normalizedRows = normalizeSeriesToRows(series);
  normalizedRows.forEach((item) => {
    const row = [item.epoch];
    series.forEach((s) => {
      row.push(sanitizeCell(item.valuesByRun[s.runId]));
    });
    rows.push(row);
  });
  if (rows.length === 1) rows.push(["暂无该曲线数据"]);
  return rows;
}

/**
 * @typedef {Object} CompareExportPayload
 * @property {'deployment'|'training'} source
 * @property {string} frameworkLabel
 * @property {string=} exportedAt
 * @property {string=} baselineRunId
 * @property {Array<{runId:string,name:string,status?:string,engine?:string,frameworkKey?:string,frameworkLabel?:string}>} runs
 * @property {Array<{key:string,valuesByRun:Record<string, any>,isDiff?:boolean}>} parameterRows
 * @property {Array<{key:string,valuesByRun:Record<string, any>,best?:any,deltaByRun?:Record<string,{delta_abs?:number,delta_percent?:number}>}>} metricRows
 * @property {Array<{name:string,series:Array<{runId:string,runName?:string,values:any[]}>}>} curveSheets
 */

export async function buildWorkbook(payload) {
  const XLSX = await getXlsx();
  const workbook = XLSX.utils.book_new();

  const runs = Array.isArray(payload?.runs) ? payload.runs : [];
  const runIds = runs.map((run) => String(run?.runId || ""));
  const runLabels = runs.map((run, idx) => runColumnLabel(run, idx));
  const runLabelById = {};
  runIds.forEach((id, idx) => {
    if (!id) return;
    runLabelById[id] = runLabels[idx];
  });

  const summaryRows = buildSummarySheet(payload || {}, runLabels);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  const parameterRows = buildParameterSheet(payload || {}, runLabels, runIds);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(parameterRows), "Parameters");

  const metricsRows = buildMetricsSheet(payload || {}, runLabels, runIds);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(metricsRows), "Metrics");

  const curves = Array.isArray(payload?.curveSheets) ? payload.curveSheets : [];
  if (!curves.length) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["暂无曲线数据"]]), "Curves");
  } else {
    curves.forEach((curve, index) => {
      const rows = buildCurveSheet(curve, runLabelById);
      const tabName = sheetName(`Curves_${curve?.name || index + 1}`, `Curves_${index + 1}`);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), tabName);
    });
  }

  return workbook;
}

export async function downloadWorkbook(workbook, filename = "compare_export.xlsx") {
  if (!workbook) throw new Error("Workbook is required");
  const XLSX = await getXlsx();
  const name = String(filename || "compare_export.xlsx").trim() || "compare_export.xlsx";
  const finalName = name.toLowerCase().endsWith(".xlsx") ? name : `${name}.xlsx`;
  XLSX.writeFile(workbook, finalName);
}
