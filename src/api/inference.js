import { API_BASE } from "@/utils/request";

async function safeJson(res) {
    try { return await res.json(); } catch (_) { return null; }
}

function toErr(data, res) {
    const m = data && (data.detail || data.message);
    if (typeof m === "string" && m.trim()) return m;
    return `Request failed: ${res?.status || "unknown"}`;
}

// Upload a single file (image or video) for inference
export async function uploadInferenceFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/v3/inference-runs/upload`, {
        method: "POST",
        body: formData,
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErr(data, res));
    return data; // { token, path }
}

// Run single-image inference
export async function runSingleInference(payload) {
    const res = await fetch(`${API_BASE}/api/v3/inference-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErr(data, res));
    return data;
}

// Run batch inference on multiple uploaded images
export async function runBatchInference(payload) {
    const res = await fetch(`${API_BASE}/api/v3/inference-runs/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErr(data, res));
    return data;
}

// Run video inference
export async function runVideoInference(payload) {
    const res = await fetch(`${API_BASE}/api/v3/inference-runs/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(toErr(data, res));
    return data;
}
