import { API_BASE } from '@/utils/request';

// createTrainingJob 创建训练任务接口
export async function createTrainingJob(trainParameters) {
    try {
        const createResponse = await fetch(`${API_BASE}/api/v2/training-jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(trainParameters)
        });

        const createResult = await createResponse.json();

        if (!createResponse.ok) {
            throw new Error(createResult.detail || '创建训练任务失败');
        }

        return createResult;
    } catch (error) {
        console.error('创建训练任务错误:', error);
        throw error;
    }
}

// startTrainingJob 启动训练任务接口
export async function startTrainingJob(jobId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || '启动训练任务失败');
        }

        return result;
    } catch (error) {
        console.error('启动训练任务错误:', error);
        throw error;
    }
}

// fetchTrainingJobs 获取训练任务列表接口
export async function fetchTrainingJobs() {
    try {
        const response = await fetch(`${API_BASE}/api/v2/training-jobs`);
        const jobs = await response.json();
        return jobs;
    } catch (error) {
        console.error('获取训练任务失败:', error);
        throw error;
    }
}

// FetchTrainingJobsStatus 获取训练任务状态接口
export async function FetchTrainingJobsStatus(jobId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}/status`);
        const status = await response.json();
        return status;
    } catch (error) {
        console.error('获取训练任务状态失败:', error);
        throw error;
    }
}

// FetchTrainingJobsMetrics_detailed 获取训练任务指标接口
export async function FetchTrainingJobsMetrics_detailed(jobId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}/metrics/detailed`);
        const metrics = await response.json();
        return metrics;
    } catch (error) {
        console.error('获取训练任务详细指标失败:', error);
        throw error;
    }
}

// DeleteTrainingJob 删除训练任务接口
export async function DeleteTrainingJob(jobId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}`, {
            method: 'DELETE',
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || '删除训练任务失败');
        }
        return result;
    } catch (error) {
        console.error('删除训练任务失败:', error);
        throw error;
    }
}

// FetchTrainingJobParameters 获取训练任务参数接口
export async function FetchTrainingJobParameters(jobId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}/parameters`);
        const parameters = await response.json();
        return parameters;
    } catch (error) {
        console.error('获取训练任务参数失败:', error);
        throw error;
    }
}

// FetchTrainingJobModelSize 获取训练任务模型大小接口
export async function FetchTrainingJobModelSize(jobId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}/model-size`);
        const size = await response.json();
        return size;
    } catch (error) {
        console.error('获取训练任务模型大小失败:', error);
        throw error;
    }
}

// ExportModel 导出模型接口 (Often related to training job result)
export async function ExportModel(jobId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}/export`);
        const result = await response.json();
        if (!response.ok) {
            const msg = (result && (result.detail || result.message)) || '导出失败';
            throw new Error(msg);
        }
        return result;
    } catch (error) {
        console.error('导出模型失败:', error);
        throw error;
    }
}
