import { API_BASE } from '@/utils/request';

// fetchDatasets 数据集接口
export async function fetchDatasets() {
    try {
        const response = await fetch(`${API_BASE}/api/v2/datasets`);
        const datasets = await response.json();

        // 提取列表数据
        let list = [];
        if (Array.isArray(datasets)) {
            list = datasets;
        } else if (datasets && Array.isArray(datasets.items)) {
            list = datasets.items;
        } else if (datasets && Array.isArray(datasets.data)) {
            list = datasets.data;
        } else if (datasets && Array.isArray(datasets.datasets)) {
            list = datasets.datasets;
        } else {
            console.warn('API返回的数据集格式异常:', datasets);
            return [];
        }

        // 字段映射适配
        return list.map(item => ({
            ...item,
            dataset_name: item.dataset_name || item.name,
            dataset_type: item.dataset_type || item.type,
            dataset_id: item.dataset_id || item.id
        }));
    } catch (error) {
        console.error('获取数据集失败:', error);
        return [];
    }
}

// uploadDataset 上传数据集的接口
export async function uploadDataset(file, datasetName, datasetType) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', datasetName);
        formData.append('type', datasetType);
        formData.append('dataset_name', datasetName);
        formData.append('dataset_type', datasetType);

        console.log('上传数据集:', datasetName, datasetType);

        const response = await fetch(`${API_BASE}/api/v2/datasets/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            return result;
        } else {
            const errorMsg = typeof result.detail === 'object'
                ? JSON.stringify(result.detail)
                : (result.detail || '上传失败');
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('上传错误:', error);
        throw error;
    }
}

// deleteDataset 删除数据集接口
export async function deleteDataset(datasetId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/datasets/${datasetId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok) {
            return true;
        } else {
            throw new Error(result.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除错误:', error);
        throw error;
    }
}

// FetchDatasetStatistics 获取数据集统计信息接口
export async function FetchDatasetStatistics(datasetId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/datasets/${datasetId}/statistics`);
        const statistics = await response.json();
        return statistics;
    } catch (error) {
        console.error('获取数据集统计信息失败:', error);
        throw error;
    }
}

// FetchDatasetDetail 获取数据集详细信息接口
export async function FetchDatasetDetail(datasetId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/datasets/${datasetId}/detail`);
        const dataset = await response.json();
        return dataset;
    } catch (error) {
        console.error('获取数据集详细信息失败:', error);
        throw error;
    }
}

// FetchDatasetType 获取数据集类型接口
export async function FetchDatasetType(jobId) {
    try {
        const url = `${API_BASE}/api/v2/statistics/dataset-type?job_id=${encodeURIComponent(jobId)}`;
        const response = await fetch(url);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            throw new Error(msg);
        }
        return data;
    } catch (error) {
        console.error('获取数据集类型失败:', error);
        throw error;
    }
}
