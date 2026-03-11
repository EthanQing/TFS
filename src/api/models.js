import { API_BASE } from '@/utils/request';

const HIDDEN_ARCH_ENGINES = new Set(["paddle-det"]);

async function safeJson(res) {
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
}


function toErrorMessage(data, res) {
    const msg = data && (data.detail || data.message);
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (msg && typeof msg === 'object') return JSON.stringify(msg);
    return `Request failed: ${res?.status || 'unknown'}`;
}

function pickPageItems(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
}

function normalizeEngine(v) {
    return String(v || "").trim().toLowerCase();
}

function isArchitectureVisible(it) {
    const engine = normalizeEngine(it?.engine);
    if (!engine) return true;
    return !HIDDEN_ARCH_ENGINES.has(engine);
}

// FetchArchitectureDetail 获取架构信息接口
export async function FetchArchitectureDetail() {
    try {
        const response = await fetch(`${API_BASE}/api/v2/architectures`);
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            throw new Error(msg);
        }

        const list = (Array.isArray(data) ? data : []).filter(isArchitectureVisible);
        // 兼容字段：旧前端用 model_family/model_variant/arch_id
        return list.map((it) => ({
            ...it,
            arch_id: it.arch_id || it.architecture_id || it.id,
            model_family: it.model_family || it.family,
            model_variant: it.model_variant || it.variant,
        }));
    } catch (error) {
        console.error('获取架构信息失败:', error);
        throw error;
    }
}


// fetchModelVersionsByRunId ???? run_id ????????
export async function fetchModelVersionsByRunId(runId, page = 1, pageSize = 20) {
    const id = String(runId || '').trim();
    if (!id) throw new Error('Missing run_id');

    const url = `${API_BASE}/api/v2/model-versions?run_id=${encodeURIComponent(id)}&page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`;
    const res = await fetch(url);
    const data = await safeJson(res);
    if (!res.ok) {
        throw new Error(toErrorMessage(data, res));
    }
    return pickPageItems(data);
}

// registerModelVersionFromRun ???? run ???????????
export async function registerModelVersionFromRun({ run_id, version, stage = 'development', description = null } = {}) {
    const payload = {
        run_id: run_id,
        version: version,
        stage: stage,
        description: description || undefined,
    };

    const res = await fetch(`${API_BASE}/api/v2/model-versions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) {
        throw new Error(toErrorMessage(data, res));
    }
    return data;
}

// GetInferenceResult 获取推理结果接口
export async function GetInferenceResult(payload) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/inference-runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            throw new Error(msg);
        }
        return data;
    } catch (error) {
        console.error('获取推理结果失败:', error);
        throw error;
    }
}

// uploadInferenceImage 上传用于推理的单张图片接口
export async function uploadInferenceImage(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_BASE}/api/v2/inference-runs/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `上传推理图片失败: ${response.status}`;
            throw new Error(msg);
        }
        return data;
    } catch (error) {
        console.error('上传推理图片失败:', error);
        throw error;
    }
}
