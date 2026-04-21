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

export async function fetchInferableModels({ projectId } = {}) {
  let url = `${API_BASE}/api/v3/inference-jobs/models`;
  if (projectId != null && Number.isFinite(Number(projectId))) {
    url += `?project_id=${encodeURIComponent(Number(projectId))}`;
  }
  const res = await fetch(url);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return Array.isArray(data) ? data : [];
}

export async function createInferenceJob(payload) {
  const res = await fetch(`${API_BASE}/api/v3/inference-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data;
}

export async function fetchInferenceJob(jobId, { includeItems = true } = {}) {
  const id = normStr(jobId);
  if (!id) throw new Error("Missing job id");
  const qs = includeItems ? "1" : "0";
  const res = await fetch(`${API_BASE}/api/v3/inference-jobs/${encodeURIComponent(id)}?include_items=${qs}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data;
}

export async function cancelInferenceJob(jobId) {
  const id = normStr(jobId);
  if (!id) throw new Error("Missing job id");
  const res = await fetch(`${API_BASE}/api/v3/inference-jobs/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data;
}

function buildWsUrl(jobId, query = {}) {
  const id = encodeURIComponent(normStr(jobId));
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
  return `${base}/api/v3/inference-jobs/${id}/stream${tail ? `?${tail}` : ""}`;
}

export function openInferenceJobStream(jobId, handlers = {}, options = {}) {
  const id = normStr(jobId);
  if (!id) throw new Error("Missing job id");

  const onSnapshot = typeof handlers.onSnapshot === "function" ? handlers.onSnapshot : () => {};
  const onProgress = typeof handlers.onProgress === "function" ? handlers.onProgress : () => {};
  const onItem = typeof handlers.onItem === "function" ? handlers.onItem : () => {};
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
  let fromSeq = options.fromSeq ?? null;
  let fromResultId = options.fromResultId ?? null;

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
    const url = buildWsUrl(id, {
      from_seq: fromSeq,
      from_result_id: fromResultId,
    });
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
        if (Number.isFinite(Number(data.seq))) fromSeq = Number(data.seq);
        if (Number.isFinite(Number(data.last_result_id))) fromResultId = Number(data.last_result_id);
        onSnapshot(data);
        return;
      }
      if (type === "progress") {
        if (Number.isFinite(Number(data.seq))) fromSeq = Number(data.seq);
        if (Number.isFinite(Number(data.last_result_id))) fromResultId = Number(data.last_result_id);
        onProgress(data);
        return;
      }
      if (type === "item") {
        if (Number.isFinite(Number(data.result_id))) fromResultId = Number(data.result_id);
        onItem(data);
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
    setCursor({ seq, resultId } = {}) {
      if (seq != null && Number.isFinite(Number(seq))) fromSeq = Number(seq);
      if (resultId != null && Number.isFinite(Number(resultId))) fromResultId = Number(resultId);
    },
  };
}
