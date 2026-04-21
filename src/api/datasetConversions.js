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

export async function createDatasetConversion({ file, targetFormat } = {}) {
  if (!file) throw new Error("缺少zip文件");
  const fd = new FormData();
  fd.append("file", file, file.name || "dataset.zip");

  let url = `${API_BASE}/api/v3/dataset-conversions`;
  if (targetFormat) {
    url += `?target_format=${encodeURIComponent(targetFormat)}`;
  }

  const res = await fetch(url, {
    method: "POST",
    body: fd,
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data;
}

export async function fetchDatasetConversion(jobId) {
  const id = String(jobId || "").trim();
  if (!id) throw new Error("缺少 job_id");
  const res = await fetch(`${API_BASE}/api/v3/dataset-conversions/${encodeURIComponent(id)}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data;
}

