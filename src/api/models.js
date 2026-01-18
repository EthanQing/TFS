import { API_BASE } from '@/utils/request';

async function safeJson(res) {
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
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

        const list = Array.isArray(data) ? data : [];
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

// GetInferenceResult 获取推理结果接口
export async function GetInferenceResult(payload) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/inference/run`, {
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
        const response = await fetch(`${API_BASE}/api/v2/inference/upload`, {
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
