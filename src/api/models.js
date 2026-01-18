import { API_BASE } from '@/utils/request';

// FetchArchitectureDetail 获取架构信息接口
export async function FetchArchitectureDetail() {
    try {
        const response = await fetch(`${API_BASE}/api/v2/architectures`);
        const architecture = await response.json();
        return architecture;
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
