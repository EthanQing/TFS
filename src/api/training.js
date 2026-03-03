import { API_BASE, WS_BASE } from "@/utils/request";

async function safeJson(res) {
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

function pickPageItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function toErrorMessage(data, res) {
  const msg = data && (data.detail || data.message);
  if (typeof msg === "string" && msg.trim()) return msg;
  if (msg && typeof msg === "object") return JSON.stringify(msg);
  return `请求失败: ${res?.status || "unknown"}`;
}

function normStr(v) {
  return String(v ?? "").trim();
}

function normalizeVariant(v) {
  return normStr(v).toLowerCase();
}

function mapRunStatus(status) {
  const s = normalizeVariant(status);
  if (!s) return "pending";
  // Backend: created/queued/running/completed/failed/cancelled/deleted
  if (s === "created") return "pending";
  if (s === "queued") return "queued";
  if (s === "running") return "running";
  if (s === "completed") return "completed";
  if (s === "failed") return "failed";
  if (s === "cancelled") return "cancelled";
  if (s === "deleted") return "deleted";
  return s;
}

function mapParametersOut(p) {
  const obj = p && typeof p === "object" ? p : {};
  const imageSize =
    obj.image_size ?? obj.img_size ?? obj.imgsz ?? obj.imageSize ?? obj.imgSize ?? 640;
  return {
    ...obj,
    image_size: imageSize,
    img_size: imageSize,
    imgsz: imageSize,
  };
}

function inferEvalInterval(parameters) {
  const p = parameters && typeof parameters === "object" ? parameters : {};
  const add = p.additional_params && typeof p.additional_params === "object" ? p.additional_params : {};
  const raw = add.eval_interval ?? add.snapshot_epoch ?? add.save_period;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.floor(n));
}

function mapArchitectureOut(a) {
  if (!a || typeof a !== "object") return null;
  const arch_id = a.arch_id || a.architecture_id || a.id || null;
  return {
    ...a,
    arch_id,
    model_family: a.model_family || a.family || "",
    model_variant: a.model_variant || a.variant || "",
  };
}

function mapProjectOut(p) {
  if (!p || typeof p !== "object") return null;
  return {
    ...p,
    project_id: p.project_id || p.id,
    project_name: p.project_name || p.name || "",
    name: p.name || p.project_name || "",
  };
}

let _archCache = { map: null, at: 0, pending: null };
let _projCache = { map: null, at: 0, pending: null };

async function getArchitectureMap({ force = false } = {}) {
  const ttlMs = 60_000;
  if (!force && _archCache.map && Date.now() - _archCache.at < ttlMs) return _archCache.map;
  if (!force && _archCache.pending) return _archCache.pending;

  _archCache.pending = (async () => {
    const res = await fetch(`${API_BASE}/api/v2/architectures`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    const list = Array.isArray(data) ? data : [];
    const map = new Map();
    list.forEach((it) => {
      const a = mapArchitectureOut(it);
      const id = a && a.arch_id != null ? Number(a.arch_id) : null;
      if (id != null && Number.isFinite(id)) map.set(id, a);
    });
    _archCache.map = map;
    _archCache.at = Date.now();
    _archCache.pending = null;
    return map;
  })();

  return _archCache.pending;
}

async function getProjectMap({ force = false } = {}) {
  const ttlMs = 60_000;
  if (!force && _projCache.map && Date.now() - _projCache.at < ttlMs) return _projCache.map;
  if (!force && _projCache.pending) return _projCache.pending;

  _projCache.pending = (async () => {
    const res = await fetch(`${API_BASE}/api/v2/projects?page=1&page_size=500`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    const items = pickPageItems(data);
    const map = new Map();
    items.forEach((it) => {
      const p = mapProjectOut(it);
      const id = p && p.project_id != null ? Number(p.project_id) : null;
      if (id != null && Number.isFinite(id)) map.set(id, p);
    });
    _projCache.map = map;
    _projCache.at = Date.now();
    _projCache.pending = null;
    return map;
  })();

  return _projCache.pending;
}

async function resolveArchitectureId({ architecture_id, model_architecture, model_variant } = {}) {
  const direct = architecture_id ?? null;
  if (direct != null && Number.isFinite(Number(direct))) return Number(direct);

  const want = normalizeVariant(model_architecture || model_variant);
  if (!want) return null;

  const map = await getArchitectureMap();
  for (const [id, a] of map.entries()) {
    const v = normalizeVariant(a?.model_variant);
    if (v && v === want) return Number(id);
  }

  return null;
}

async function mapTrainingRunToJob(run) {
  const obj = run && typeof run === "object" ? run : {};
  const archMap = await getArchitectureMap().catch(() => new Map());
  const projMap = await getProjectMap().catch(() => new Map());

  const archId = obj.architecture_id != null ? Number(obj.architecture_id) : null;
  const projectId = obj.project_id != null ? Number(obj.project_id) : null;

  const architecture = archId != null && archMap.has(archId) ? archMap.get(archId) : null;
  const project = projectId != null && projMap.has(projectId) ? projMap.get(projectId) : null;

  const modelSizeMb =
    (obj.result && obj.result.model_size_mb != null ? Number(obj.result.model_size_mb) : null) ??
    (obj.model_size_mb != null ? Number(obj.model_size_mb) : null);

  return {
    ...obj,
    // Legacy field names used by the front-end UI
    job_id: obj.job_id || obj.run_id || obj.id,
    job_name: obj.job_name || obj.name || "",
    status: mapRunStatus(obj.status),
    parameters: mapParametersOut(obj.parameters),
    model_size_mb: Number.isFinite(modelSizeMb) ? modelSizeMb : null,

    // Helpful nested objects for display
    architecture,
    project,
  };
}

// createTrainingJob 创建训练任务接口（v2: training-runs）
export async function createTrainingJob(trainParameters) {
  try {
    const tp = trainParameters && typeof trainParameters === "object" ? trainParameters : {};
    const project_id = tp.project_id != null ? Number(tp.project_id) : null;
    if (!project_id || !Number.isFinite(project_id)) {
      throw new Error("缺少 project_id（请先选择项目）");
    }

    const architecture_id = await resolveArchitectureId({
      architecture_id: tp.architecture_id,
      model_architecture: tp.model_architecture,
      model_variant: tp.model_variant,
    });
    if (!architecture_id) {
      throw new Error("无法解析 architecture_id（请重新选择模型架构）");
    }

    const params = {
      epochs: Number(tp.epochs ?? 100) || 100,
      batch_size: Number(tp.batch_size ?? 16) || 16,
      image_size: Number(tp.image_size ?? tp.img_size ?? tp.imgsz ?? 640) || 640,
      learning_rate: Number(tp.learning_rate ?? 0.01) || 0.01,
      patience: Number(tp.patience ?? 50) || 50,
      device: normStr(tp.device || "auto") || "auto",
      workers: Number(tp.workers ?? 8) || 8,
      use_pretrained: tp.use_pretrained !== undefined ? !!tp.use_pretrained : true,
      optimizer: normStr(tp.optimizer || "AdamW") || "AdamW",
    };

    // Put remaining "advanced" options into additional_params to keep extensibility.
    const known = new Set([
      "project_id",
      "project_name",
      "dataset_name",
      "dataset_id",
      "dataset_version_id",
      "name",
      "job_name",
      "architecture_id",
      "model_architecture",
      "model_variant",
      "epochs",
      "batch_size",
      "image_size",
      "img_size",
      "imgsz",
      "learning_rate",
      "patience",
      "device",
      "workers",
      "use_pretrained",
      "optimizer",
    ]);
    const additional = {};
    Object.keys(tp).forEach((k) => {
      if (known.has(k)) return;
      additional[k] = tp[k];
    });
    if (Object.keys(additional).length) params.additional_params = additional;

    const payload = {
      project_id,
      architecture_id,
      dataset_version_id: tp.dataset_version_id != null ? Number(tp.dataset_version_id) : undefined,
      name: normStr(tp.name || tp.job_name) || undefined,
      parameters: params,
    };

    const res = await fetch(`${API_BASE}/api/v2/training-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));

    return await mapTrainingRunToJob(data);
  } catch (error) {
    console.error("创建训练任务错误:", error);
    throw error;
  }
}

// startTrainingJob 启动训练任务接口（v2: queue）
export async function startTrainingJob(jobId) {
  try {
    const id = normStr(jobId);
    const res = await fetch(`${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    return await mapTrainingRunToJob(data);
  } catch (error) {
    console.error("启动训练任务错误:", error);
    throw error;
  }
}

// uploadPretrainedWeights 上传预训练权重文件（用于微调）
export async function uploadPretrainedWeights(file) {
  try {
    if (!file) throw new Error("Missing file");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/v2/pretrain-models/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    return data;
  } catch (error) {
    console.error("上传预训练权重失败:", error);
    throw error;
  }
}

// fetchTrainingJobs 获取训练任务列表接口（v2: Page{items}）
export async function fetchTrainingJobs(page = 1, pageSize = 500) {
  try {
    const data = await fetchTrainingJobsPage(page, pageSize);
    return data.items;
  } catch (error) {
    console.error("获取训练任务失败:", error);
    throw error;
  }
}

// fetchTrainingJobsPage 获取分页训练任务（返回 { items, meta }）
export async function fetchTrainingJobsPage(page = 1, pageSize = 20, filters = {}) {
  try {
    let url = `${API_BASE}/api/v2/training-runs?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`;
    if (filters.project_id) url += `&project_id=${encodeURIComponent(filters.project_id)}`;
    if (filters.status) url += `&status=${encodeURIComponent(filters.status)}`;
    if (filters.search) {
      // Note: The backend currently doesn't support search query parameter generically, only specific fields. 
      // If backend doesn't support search, we might need to filter client side or just ignore. 
      // Assuming backend doesn't support 'search' param yet based on previous file reads.
      // However, to implementing full server side search we would need backend changes.
      // For now, let's just pass what we can. 
    }

    const res = await fetch(url);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));

    const rawItems = pickPageItems(data);
    const items = [];
    for (const run of rawItems) {
      items.push(await mapTrainingRunToJob(run));
    }

    return {
      items,
      meta: data.meta || { page, page_size: pageSize, total: items.length } // Fallback
    };
  } catch (error) {
    console.error("获取分页训练任务失败:", error);
    throw error;
  }
}

// FetchTrainingJobsStatus 获取训练任务状态接口（v2: GET run）
export async function FetchTrainingJobsStatus(jobId) {
  try {
    const id = normStr(jobId);
    const res = await fetch(`${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    const job = await mapTrainingRunToJob(data);
    return {
      status: job.status,
      current_epoch: job.current_epoch ?? 0,
      total_epochs: job.total_epochs ?? job.parameters?.epochs ?? null,
      progress: job.progress ?? 0,
      engine: job.architecture?.engine || null,
      family: job.architecture?.family || job.architecture?.model_family || null,
      variant: job.architecture?.variant || job.architecture?.model_variant || null,
      eval_interval: inferEvalInterval(job.parameters),
    };
  } catch (error) {
    console.error("获取训练任务状态失败:", error);
    throw error;
  }
}

// FetchTrainingJobsMetrics_detailed 获取训练任务指标接口（v2: epoch metrics list -> series map）
export async function FetchTrainingJobsMetrics_detailed(jobId) {
  try {
    const id = normStr(jobId);
    const res = await fetch(
      `${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}/metrics/epochs?limit=5000`
    );
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    const rows = Array.isArray(data) ? data : [];

    const series = {};
    let maxEpoch = 0;
    rows.forEach((row) => {
      const epoch = Number(row?.epoch);
      // Backend Ultralytics epoch is 0-based.
      if (!Number.isFinite(epoch) || epoch < 0) return;
      const idx = Math.max(0, Math.floor(epoch));
      maxEpoch = Math.max(maxEpoch, idx + 1);
      const metrics = row?.metrics && typeof row.metrics === "object" ? row.metrics : {};
      Object.keys(metrics).forEach((k) => {
        if (!series[k]) series[k] = [];
        while (series[k].length < idx) series[k].push(null);
        const v = metrics[k];
        const n = Number(v);
        series[k][idx] = Number.isFinite(n) ? n : null;
      });
    });

    // Ensure arrays align in length.
    Object.keys(series).forEach((k) => {
      while (series[k].length < maxEpoch) series[k].push(null);
    });

    return { metrics: series, total_epochs: maxEpoch || null };
  } catch (error) {
    console.error("获取训练任务详细指标失败:", error);
    throw error;
  }
}

function buildWsUrl(runId, query = {}) {
  const rid = encodeURIComponent(normStr(runId));
  const qs = new URLSearchParams();
  Object.keys(query || {}).forEach((k) => {
    const v = query[k];
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    qs.set(k, s);
  });
  const base = String(WS_BASE || API_BASE || "").replace(/\/+$/, "");
  const tail = qs.toString();
  return `${base}/api/v2/training-runs/${rid}/metrics/stream${tail ? `?${tail}` : ""}`;
}

export function openTrainingRunMetricsStream(runId, handlers = {}, options = {}) {
  const id = normStr(runId);
  if (!id) throw new Error("Missing run id");

  const onStatus = typeof handlers.onStatus === "function" ? handlers.onStatus : () => {};
  const onMetric = typeof handlers.onMetric === "function" ? handlers.onMetric : () => {};
  const onEvent = typeof handlers.onEvent === "function" ? handlers.onEvent : () => {};
  const onDone = typeof handlers.onDone === "function" ? handlers.onDone : () => {};
  const onError = typeof handlers.onError === "function" ? handlers.onError : () => {};
  const onOpen = typeof handlers.onOpen === "function" ? handlers.onOpen : () => {};
  const onClose = typeof handlers.onClose === "function" ? handlers.onClose : () => {};
  const onReconnect = typeof handlers.onReconnect === "function" ? handlers.onReconnect : () => {};

  const minDelayMs = Math.max(300, Number(options.minDelayMs ?? 1000) || 1000);
  const maxDelayMs = Math.max(minDelayMs, Number(options.maxDelayMs ?? 30000) || 30000);
  const reconnectFactor = Math.max(1.1, Number(options.reconnectFactor ?? 1.8) || 1.8);
  const jitterMs = Math.max(0, Number(options.jitterMs ?? 300) || 0);

  let ws = null;
  let reconnectTimer = null;
  let closedManually = false;
  let reconnectAttempt = 0;
  let lastFromMetricId = options.fromMetricId ?? null;
  let lastFromEventId = options.fromEventId ?? null;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closedManually) return;
    reconnectAttempt += 1;
    const baseDelay = Math.min(maxDelayMs, Math.round(minDelayMs * Math.pow(reconnectFactor, reconnectAttempt - 1)));
    const delay = baseDelay + (jitterMs ? Math.floor(Math.random() * jitterMs) : 0);
    onReconnect({ attempt: reconnectAttempt, delayMs: delay });
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (closedManually) return;
    clearReconnectTimer();

    const query = {
      from_metric_id: lastFromMetricId,
      from_event_id: lastFromEventId,
    };
    const url = buildWsUrl(id, query);

    try {
      ws = new WebSocket(url);
    } catch (e) {
      onError(e);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectAttempt = 0;
      onOpen({ url });
    };

    ws.onmessage = (evt) => {
      let payload = null;
      try {
        payload = JSON.parse(evt.data || "{}");
      } catch (_) {
        return;
      }
      const type = String(payload?.type || "");
      const data = payload?.data || {};

      if (type === "cursor") {
        if (Number.isFinite(Number(data.last_metric_id))) lastFromMetricId = Number(data.last_metric_id);
        if (Number.isFinite(Number(data.last_event_id))) lastFromEventId = Number(data.last_event_id);
        return;
      }
      if (type === "status") {
        onStatus(data);
        return;
      }
      if (type === "metric") {
        if (Number.isFinite(Number(data.metric_id))) lastFromMetricId = Number(data.metric_id);
        onMetric(data);
        return;
      }
      if (type === "event") {
        if (Number.isFinite(Number(data.event_id))) lastFromEventId = Number(data.event_id);
        onEvent(data);
        return;
      }
      if (type === "done") {
        onDone(data);
        return;
      }
      if (type === "error") {
        onError(data?.message || "metrics stream error");
        return;
      }
      if (type === "ping") {
        return;
      }
    };

    ws.onerror = (err) => {
      onError(err);
    };

    ws.onclose = (evt) => {
      onClose(evt);
      if (!closedManually) scheduleReconnect();
    };
  };

  connect();

  return {
    close() {
      closedManually = true;
      clearReconnectTimer();
      if (ws) {
        try {
          ws.close();
        } catch (_) {
          0;
        }
        ws = null;
      }
    },
    reconnect() {
      if (closedManually) return;
      if (ws) {
        try {
          ws.close();
        } catch (_) {
          0;
        }
      } else {
        scheduleReconnect();
      }
    },
    setCursor({ metricId, eventId } = {}) {
      if (metricId != null) lastFromMetricId = Number(metricId);
      if (eventId != null) lastFromEventId = Number(eventId);
    },
  };
}

// DeleteTrainingJob 删除训练任务接口（v2: request_delete -> DELETE run）
export async function DeleteTrainingJob(jobId, { force = false } = {}) {
  try {
    const id = normStr(jobId);
    const url = `${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}?force=${force ? "1" : "0"}`;
    const res = await fetch(url, {
      method: "DELETE",
    });
    const data = await safeJson(res);
    if (!res.ok) {
      const err = new Error(toErrorMessage(data, res));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return await mapTrainingRunToJob(data);
  } catch (error) {
    console.error("删除训练任务失败:", error);
    throw error;
  }
}

// CancelTrainingJob 取消训练任务接口（v2: request_cancel -> POST run/cancel）
export async function CancelTrainingJob(jobId) {
  try {
    const id = normStr(jobId);
    const res = await fetch(`${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    return await mapTrainingRunToJob(data);
  } catch (error) {
    console.error("取消训练任务失败:", error);
    throw error;
  }
}

// ResumeTrainingJob 恢复训练任务接口（v2: POST run/resume）
export async function ResumeTrainingJob(jobId) {
  try {
    const id = normStr(jobId);
    const res = await fetch(`${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    return await mapTrainingRunToJob(data);
  } catch (error) {
    console.error("恢复训练任务失败:", error);
    throw error;
  }
}

// FetchTrainingJobParameters 获取训练任务参数接口（v2: GET run -> parameters）
export async function FetchTrainingJobParameters(jobId) {
  try {
    const id = normStr(jobId);
    const res = await fetch(`${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    return mapParametersOut(data && data.parameters);
  } catch (error) {
    console.error("获取训练任务参数失败:", error);
    throw error;
  }
}

// FetchTrainingJobModelSize 获取训练任务模型大小接口（v2: from result.model_size_mb）
export async function FetchTrainingJobModelSize(jobId) {
  try {
    const id = normStr(jobId);
    const res = await fetch(`${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));

    const size = data?.result?.model_size_mb;
    return {
      model_size_mb: size != null ? Number(size) : null,
    };
  } catch (error) {
    console.error("获取训练任务模型大小失败:", error);
    throw error;
  }
}

// ExportModel 导出模型（v2: artifacts -> 返回可下载的静态文件 URL）
export async function ExportModel(jobId, options = {}) {
  try {
    const id = normStr(jobId);

    const fmt = normStr(options.format || options.target_format || options.targetFormat || "pt").toLowerCase();
    const weights = normStr(options.weights || options.checkpoint || "best").toLowerCase();

    const payload = {
      format: fmt || "pt",
      weights: weights || "best",
      opset: options.opset != null ? Number(options.opset) : undefined,
      dynamic: options.dynamic != null ? !!options.dynamic : undefined,
      imgsz: options.imgsz != null ? Number(options.imgsz) : undefined,
    };

    const res = await fetch(`${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));

    return data;
  } catch (error) {
    console.error("导出模型失败:", error);
    throw error;
  }
}

// CompareTrainingRuns 对比训练任务接口（v2: training-runs/compare）
export async function CompareTrainingRuns(runIds) {
  try {
    const payload = { run_ids: Array.isArray(runIds) ? runIds : [] };
    const res = await fetch(`${API_BASE}/api/v2/training-runs/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErrorMessage(data, res));
    return data;
  } catch (error) {
    console.error("对比训练任务失败:", error);
    throw error;
  }
}
