import { API_BASE, WS_BASE } from "@/utils/request";

async function safeJson(res) {
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

function toErrorMessage(data, res) {
  const msg = data && (data.detail || data.message);
  if (typeof msg === "string" && msg.trim()) return msg;
  if (msg && typeof msg === "object") return JSON.stringify(msg);
  return `Request failed: ${res?.status || "unknown"}`;
}

function normStr(v) {
  return String(v ?? "").trim();
}

export async function executeDeployment(deploymentId, payload = {}) {
  const id = Number(deploymentId);
  if (!Number.isFinite(id)) throw new Error("Missing deployment id");
  const res = await fetch(`${API_BASE}/api/v3/deployments/${encodeURIComponent(String(id))}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

export async function fetchDeploymentRun(runId) {
  const id = normStr(runId);
  if (!id) throw new Error("Missing run id");
  const res = await fetch(`${API_BASE}/api/v3/deployment-runs/${encodeURIComponent(id)}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

export async function retryDeploymentRun(runId, payload = {}) {
  const id = normStr(runId);
  if (!id) throw new Error("Missing run id");
  const res = await fetch(`${API_BASE}/api/v3/deployment-runs/${encodeURIComponent(id)}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

export async function cancelDeploymentRun(runId) {
  const id = normStr(runId);
  if (!id) throw new Error("Missing run id");
  const res = await fetch(`${API_BASE}/api/v3/deployment-runs/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

export async function fetchDeploymentRunLogs(runId, { fromSeq = 0, limit = 1000 } = {}) {
  const id = normStr(runId);
  if (!id) throw new Error("Missing run id");
  const qs = new URLSearchParams();
  qs.set("from_seq", String(Math.max(0, Number(fromSeq) || 0)));
  qs.set("limit", String(Math.min(5000, Math.max(1, Number(limit) || 1000))));
  const res = await fetch(`${API_BASE}/api/v3/deployment-runs/${encodeURIComponent(id)}/logs?${qs.toString()}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return Array.isArray(data) ? data : [];
}

function buildWsUrl(runId, query = {}) {
  const id = encodeURIComponent(normStr(runId));
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
  return `${base}/api/v3/deployment-runs/${id}/stream${tail ? `?${tail}` : ""}`;
}

export function openDeploymentRunStream(runId, handlers = {}, options = {}) {
  const id = normStr(runId);
  if (!id) throw new Error("Missing run id");

  const onSnapshot = typeof handlers.onSnapshot === "function" ? handlers.onSnapshot : () => {};
  const onProgress = typeof handlers.onProgress === "function" ? handlers.onProgress : () => {};
  const onLog = typeof handlers.onLog === "function" ? handlers.onLog : () => {};
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
  let fromSeq = Number(options.fromSeq || 0) || 0;

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
    const url = buildWsUrl(id, { from_seq: fromSeq });
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
      if (type === "snapshot") {
        onSnapshot(data);
        return;
      }
      if (type === "progress") {
        onProgress(data);
        return;
      }
      if (type === "log") {
        if (Number.isFinite(Number(data.seq))) fromSeq = Number(data.seq);
        onLog(data);
        return;
      }
      if (type === "done") {
        onDone(data);
        return;
      }
      if (type === "error") {
        onError(data?.message || "stream error");
        return;
      }
      if (type === "ping") return;
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
    setCursor({ seq } = {}) {
      if (seq != null && Number.isFinite(Number(seq))) fromSeq = Number(seq);
    },
  };
}

export async function callServingInfer(deploymentId, payload = {}) {
  const id = Number(deploymentId);
  if (!Number.isFinite(id)) throw new Error("Missing deployment id");
  const apiKey = normStr(payload.apiKey);
  if (!apiKey) throw new Error("Missing deployment API key");

  const headers = { "X-Deployment-Key": apiKey };
  const conf = payload.conf != null ? Number(payload.conf) : 0.5;
  const iou = payload.iou != null ? Number(payload.iou) : 0.45;
  const showLabels = payload.showLabels !== false;
  const showConfidence = payload.showConfidence !== false;

  let res = null;
  if (payload.file) {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("conf", String(conf));
    form.append("iou", String(iou));
    form.append("show_labels", showLabels ? "1" : "0");
    form.append("show_confidence", showConfidence ? "1" : "0");
    res = await fetch(`${API_BASE}/api/v3/serving/deployments/${encodeURIComponent(String(id))}/infer`, {
      method: "POST",
      headers,
      body: form,
    });
  } else {
    const body = {
      image_url: normStr(payload.imageUrl) || null,
      conf,
      iou,
      show_labels: showLabels,
      show_confidence: showConfidence,
    };
    res = await fetch(`${API_BASE}/api/v3/serving/deployments/${encodeURIComponent(String(id))}/infer`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

