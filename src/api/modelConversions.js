import { API_BASE } from "@/utils/request";

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
  return `请求失败: ${res?.status || "unknown"}`;
}

export async function createModelConversion({
  file,
  source_format = "pt",
  target_format = "onnx",
  opset = null,
  dynamic = true,
} = {}) {
  if (!file) throw new Error("缺少模型文件");

  const fd = new FormData();
  fd.append("file", file, file.name || "model.pt");
  fd.append("source_format", source_format);
  fd.append("target_format", target_format);
  if (opset != null && Number.isFinite(Number(opset))) fd.append("opset", String(Number(opset)));
  if (dynamic != null) fd.append("dynamic", String(!!dynamic));

  const res = await fetch(`${API_BASE}/api/v2/model-conversions`, {
    method: "POST",
    body: fd,
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data;
}

export async function fetchModelConversion(jobId) {
  const id = String(jobId || "").trim();
  if (!id) throw new Error("缺少 job_id");
  const res = await fetch(`${API_BASE}/api/v2/model-conversions/${encodeURIComponent(id)}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data;
}

