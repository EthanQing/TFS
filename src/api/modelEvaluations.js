import { API_BASE, WS_BASE, createReconnectingWs, getJson, postJson } from "./apiUtils";

const PREFIX = `${API_BASE}/api/v3/model-evaluations`;

function normStr(v) {
  return String(v ?? "").trim();
}

export async function fetchEvaluationModels({ projectId } = {}) {
  const params = new URLSearchParams();
  if (projectId != null && Number.isFinite(Number(projectId))) {
    params.set("project_id", String(Number(projectId)));
  }
  const qs = params.toString();
  const data = await getJson(`${PREFIX}/models${qs ? `?${qs}` : ""}`);
  return Array.isArray(data) ? data : [];
}

export async function createModelEvaluation(payload) {
  return postJson(PREFIX, payload || {});
}

export async function fetchModelEvaluation(jobId, { includeItems = true } = {}) {
  const id = normStr(jobId);
  if (!id) throw new Error("缺少评估任务 ID");
  const qs = includeItems ? "1" : "0";
  return getJson(`${PREFIX}/${encodeURIComponent(id)}?include_items=${qs}`);
}

export async function fetchActiveModelEvaluation({ includeItems = false } = {}) {
  const qs = includeItems ? "1" : "0";
  return getJson(`${PREFIX}/active?include_items=${qs}`);
}

export async function cancelModelEvaluation(jobId) {
  const id = normStr(jobId);
  if (!id) throw new Error("缺少评估任务 ID");
  return postJson(`${PREFIX}/${encodeURIComponent(id)}/cancel`, {});
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
  return `${base}/api/v3/model-evaluations/${id}/stream${tail ? `?${tail}` : ""}`;
}

export function openModelEvaluationStream(jobId, handlers = {}, options = {}) {
  const id = normStr(jobId);
  if (!id) throw new Error("缺少评估任务 ID");

  const onSnapshot = typeof handlers.onSnapshot === "function" ? handlers.onSnapshot : () => {};
  const onProgress = typeof handlers.onProgress === "function" ? handlers.onProgress : () => {};
  const onItem = typeof handlers.onItem === "function" ? handlers.onItem : () => {};
  const onDone = typeof handlers.onDone === "function" ? handlers.onDone : () => {};
  const onError = typeof handlers.onError === "function" ? handlers.onError : () => {};

  let fromSeq = options.fromSeq ?? null;
  let fromResultId = options.fromResultId ?? null;

  return createReconnectingWs(
    () => buildWsUrl(id, { from_seq: fromSeq, from_result_id: fromResultId }),
    {
      onOpen: handlers.onOpen,
      onClose: handlers.onClose,
      onError,
      onReconnect: handlers.onReconnect,
      onMessage: (payload, helpers) => {
        const type = String(payload?.type || "");
        const data = payload?.data || {};
        if (type === "snapshot") {
          if (Number.isFinite(Number(data.seq))) fromSeq = Number(data.seq);
          if (Number.isFinite(Number(data.last_result_id))) fromResultId = Number(data.last_result_id);
          onSnapshot(data);
        } else if (type === "progress") {
          if (Number.isFinite(Number(data.seq))) fromSeq = Number(data.seq);
          if (Number.isFinite(Number(data.last_result_id))) fromResultId = Number(data.last_result_id);
          onProgress(data);
        } else if (type === "item") {
          if (Number.isFinite(Number(data.result_id))) {
            fromResultId = Number(data.result_id);
          }
          onItem(data);
        } else if (type === "done") {
          onDone(data);
          helpers.close();
        } else if (type === "error") {
          onError(data?.message || "评估流异常");
        }
      },
    },
    options
  );
}
