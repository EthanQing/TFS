
// 统一后端基础地址，便于 WebSocket/HTTP 共用
// export const API_BASE = window.__API_BASE__ || 'http://192.168.2.102:8000';
export const API_BASE = window.__API_BASE__ || 'http://192.168.2.112:18001';
const __IS_HTTPS__ = API_BASE.startsWith('https://');
export const WS_BASE = window.__WS_BASE__ || (
  __IS_HTTPS__ ? API_BASE.replace('https://', 'wss://') : API_BASE.replace('http://', 'ws://')
);

//fetchDatasets 数据集接口
export async function fetchDatasets() {
  try {
    const response = await fetch(`${API_BASE}/api/v2/datasets`);
    const datasets = await response.json();
    // console.log("datasets",datasets);
    
    // 提取列表数据
    let list = [];
    if (Array.isArray(datasets)) {
      list = datasets;
    } else if (datasets && Array.isArray(datasets.items)) {
      // 适配 { items: [], meta: {} } 结构
      list = datasets.items;
    } else if (datasets && Array.isArray(datasets.data)) {
      list = datasets.data;
    } else if (datasets && Array.isArray(datasets.datasets)) {
      list = datasets.datasets;
    } else {
      console.warn('API返回的数据集格式异常:', datasets);
      return [];
    }
    
    // 字段映射适配，兼容前端组件使用的 dataset_name
    return list.map(item => ({
      ...item,
      dataset_name: item.dataset_name || item.name,
      // 确保 dataset_type 存在
      dataset_type: item.dataset_type || item.type,
      // 确保 dataset_id 存在
      dataset_id: item.dataset_id || item.id
    }));
  } catch (error) {
    console.error('获取数据集失败:', error);
    return [];
  }
}

//uploadDataset 上传数据集的接口
export async function uploadDataset(file, datasetName, datasetType) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    // 尝试同时支持两种常见的参数命名方式，或者根据后端文档修正
    // 假设后端可能使用 'name' 和 'type' 这种简化命名
    formData.append('name', datasetName);
    formData.append('type', datasetType);
    // 同时也保留原来的，以防后端真的需要这个（通常多传参数不会报错，除非后端开启了 strict 模式）
    formData.append('dataset_name', datasetName);
    formData.append('dataset_type', datasetType);
    
    console.log('上传数据集:', datasetName, datasetType);

    const response = await fetch(`${API_BASE}/api/v2/datasets/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.ok) {
      // console.log('上传成功:', result);
      return result;
    } else {
      // 尝试解析详细的错误信息
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
      // console.log('删除成功:', result.message);
      return true;
    } else {
      throw new Error(result.detail || '删除失败');
    }
  } catch (error) {
    console.error('删除错误:', error);
    throw error;
  }
}

//fetchProjects 项目接口
export async function fetchProjects() {
  try {
    const response = await fetch(`${API_BASE}/api/v2/projects`);
    const projects = await response.json();
    // console.log("projects",projects);
    return projects;
  } catch (error) {
    console.error('获取项目失败:', error);
  }
}

//createProject 创建项目接口
export async function createProject(projectData) {
  try {
    const response = await fetch(`${API_BASE}/api/v2/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData)
    });

    const result = await response.json();

    if (response.ok) {
      // console.log('创建项目成功:', result);
      return result;
    } else {
      throw new Error(result.detail || '创建项目失败');
    }
  } catch (error) {
    console.error('创建项目错误:', error);
    throw error;
  }
}

//createTrainingJob 创建训练任务接口
export async function createTrainingJob(trainParameters){
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

    // console.log('训练任务已创建:', createResult);
    return createResult;
  } catch (error) {
    console.error('创建训练任务错误:', error);
    throw error;
  }
}

//startTrainingJob 启动训练任务接口
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

//fetchTrainingJobs 获取训练任务列表接口
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

//fetchTrainingJobsStatus 获取训练任务状态接口
export async function FetchTrainingJobsStatus(jobId) {
  try{
    const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}/status`);
    const status = await response.json();
    return status;
  } catch (error) {
    console.error('获取训练任务状态失败:', error);
    throw error;
  }
}

//FetchTrainingJobsMetrics 获取训练任务指标接口
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

//DeleteTrainingJob 删除训练任务接口
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

//FetchTrainingJobParameters 获取训练任务参数接口
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

//FetchProjectsDetail 获取项目详细信息接口
export async function FetchProjectsDetail(projectId) {
  try {
    const response = await fetch(`${API_BASE}/api/v2/projects/${projectId}`);
    const projects = await response.json();
    return projects;
  } catch (error) {
    console.error('获取项目失败:', error);
    throw error;
  }
}

//FetchProjectModelsSize 获取项目模型大小接口
export async function FetchProjectModelsSize(projectId){
  try{
    const response = await fetch(`${API_BASE}/api/v2/projects/${projectId}/model-size`);
    const size = await response.json();
    return size;
  }catch(error){
    console.error('获取项目模型大小失败:', error);
    throw error;
  }
}

//FetchDatasetStatistics 获取数据集统计信息接口
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

//FetchDatasetDetail 获取数据集详细信息接口
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

//GetInferenceResult 获取推理结果接口
export async function GetInferenceResult(payload){
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

//FetchDatasetType 获取数据集类型接口
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

//uploadInferenceImage 上传用于推理的单张图片接口
// 上传用于推理的单张图片，返回后端可访问的 URL（如 http(s) 或 /static/...）
export async function uploadInferenceImage(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    // 这里的上传路径根据你的后端实际路由调整，例如 /api/v2/inference/upload
    const response = await fetch(`${API_BASE}/api/v2/inference/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = (data && (data.detail || data.message)) || `上传推理图片失败: ${response.status}`;
      throw new Error(msg);
    }
    // 期望返回形如 { image_url: 'http://.../xxx.jpg' } 或 { path: '/static/xxx.jpg' }
    return data;
  } catch (error) {
    console.error('上传推理图片失败:', error);
    throw error;
  }
}

//FetchArchitectureDetail 获取架构信息接口
export async function FetchArchitectureDetail() {
  try {
    const response = await fetch(`${API_BASE}/api/v2/architectures`);
    const architecture = await response.json();
    console.log(' architecture',architecture);
    return architecture;
  } catch (error) {
    console.error('获取架构信息失败:', error);
    throw error;
  }
}

//ExportModel 导出模型接口
export async function ExportModel(jobId) {
  try {
    const response = await fetch(`${API_BASE}/api/v2/training-jobs/${jobId}/export`);
    console.log('response',response);
    const result = await response.json();
    console.log('result',result);
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

//FetchTrainingJobModelSize 获取训练任务模型大小接口
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