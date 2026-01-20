<template>
  <div class="ConfigurationPart">
      <div class="title">配置</div>
      
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <i class="el-icon-loading"></i>
        <span>正在加载配置参数...</span>
      </div>
      
      <!-- 错误状态 -->
      <div v-else-if="error" class="error-container">
        <i class="el-icon-warning"></i>
        <span>{{ error }}</span>
        <el-button size="mini" @click="getJobId()" style="margin-left: 10px;">重试</el-button>
      </div>
      
      <!-- 配置参数列表 -->
      <ul v-else-if="configItems.length > 0">
        <li v-for="(item, index) in configItems" :key="index">
          <span>{{ displayName(item.name) }}</span>
          <div>{{ item.value }}</div>
        </li>
      </ul>
      
      <!-- 无数据状态 -->
      <div v-else class="no-data-container">
        <i class="el-icon-info"></i>
        <span>暂无配置参数数据</span>
      </div>
  </div>
</template>

<script>
import { FetchTrainingJobParameters } from '@/api/training';

export default {
    name:'ConfigurationPart',
    data() {
        return {
            jobId: null,
            configItems: [],
            loading: false,
            error: null
        }
    },
    mounted() {
        // 获取当前的jobId
        this.getJobId();
    },
    activated() {
        // 当使用keep-alive缓存的组件被激活时，检查jobId
        this.getJobId();
    },
    watch: {
        '$route.query.jobId': {
            handler(newJobId) {
                if (newJobId && newJobId !== this.jobId) {
                    this.jobId = newJobId;
                    this.loadConfigurationData(newJobId);
                }
            },
            immediate: true
        }
    },
    methods: {
        getJobId() {
            // 优先从路由参数获取
            const routeJobId = this.$route.query.jobId;
            if (routeJobId) {
                this.jobId = routeJobId;
                this.loadConfigurationData(routeJobId);
            } else {
                // 从localStorage获取
                const storedJobId = localStorage.getItem('currentJobId');
                if (storedJobId) {
                    this.jobId = storedJobId;
                    this.loadConfigurationData(storedJobId);
                }
            }
        },
        
        async loadConfigurationData(jobId) {
            if (!jobId) return;
            
            this.loading = true;
            this.error = null;
            
            try {
                const parameters = await FetchTrainingJobParameters(jobId);
                
                // 将参数对象转换为配置项数组
                this.configItems = this.convertParametersToConfigItems(parameters);
                
            } catch (error) {
                console.error('获取配置参数失败:', error);
                this.error = '加载配置参数失败，请稍后重试';
                // 设置默认配置项以防止页面显示为空
                this.setDefaultConfigItems();
            } finally {
                this.loading = false;
            }
        },
        
        convertParametersToConfigItems(parameters) {
            // 将API返回的参数对象转换为配置项数组
            const configItems = [];
            
            // 遍历参数对象的所有属性
            for (const [key, value] of Object.entries(parameters)) {
                // 跳过可能的嵌套对象或数组，只处理基本类型
                if (typeof value !== 'object' || value === null) {
                    configItems.push({
                        name: key,
                        value: this.formatValue(value)
                    });
                } else if (typeof value === 'object' && !Array.isArray(value)) {
                    // 如果是对象，则展开其属性
                    for (const [subKey, subValue] of Object.entries(value)) {
                        if (typeof subValue !== 'object' || subValue === null) {
                            configItems.push({
                                name: `${key}.${subKey}`,
                                value: this.formatValue(subValue)
                            });
                        }
                    }
                }
            }
            
            return configItems;
        },
        
        formatValue(value) {
      // 格式化值的显示（空值统一显示“暂无”）
      if (value === null || value === undefined) return '暂无';
      if (typeof value === 'string') {
        const t = value.trim();
        return t === '' ? '暂无' : t;
      }
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'number') return value.toString();
      return String(value);
        },
        
        setDefaultConfigItems() {
            // 设置默认配置项
            this.configItems = [
                { name: "agnostic_nms", value: "false" },
                { name: "batch", value: "128" },
                { name: "device", value: "GPU" },
                { name: "epochs", value: "600" },
                { name: "imgsz", value: "640" },
                { name: "optimizer", value: "SGD" },
                { name: "patience", value: "100" },
                { name: "pretrained", value: "No" }
            ];
        },
        displayName(name){
            if(!name) return '';
            const key = String(name).replace(/[，,]$/,'');
            const map = {
              project_name: '项目名称',
              dataset_name: '数据集名称',
              model_architecture: '模型架构',
              epochs: '训练轮数',
              batch_size: '批大小',
              learning_rate: '学习率',
              img_size: '图像尺寸',
              optimizer: '优化器',
              device: '设备',
              workers: '数据加载进程',
              patience: '早停耐心',
              use_pretrained: '使用预训练',
              pretrained_model_path: '预训练模型路径',
              resume_training: '断点续训',
              resume_job_id: '续训任务ID',
              resume_from_epoch: '起始轮次',
              momentum: '动量',
              weight_decay: '权重衰减',
              warmup_epochs: '预热轮数',
              warmup_momentum: '预热动量',
              warmup_bias_lr: '预热偏置学习率'
            };
            return map[key] ? `${key}(${map[key]})` : key;
        }
    }
}
</script>

<style scoped>
.ConfigurationPart {
  padding: 20px 24px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.ConfigurationPart ul {
  list-style: none;
  padding: 0;
  margin: 0;
  /* 固定两列布局，更加整齐 */
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 24px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #111f68;
}

.ConfigurationPart ul li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  height: 44px;
  font-size: 14px;
  padding: 0 16px;
  background-color: #f9fafb;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
  overflow: hidden;
}

.ConfigurationPart ul li:hover {
  background-color: #f3f4f6;
  border-color: #d1d5db;
}

.ConfigurationPart ul li span {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 44px;
  color: #374151;
  font-weight: 500;
  font-size: 13px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}

.ConfigurationPart ul li div {
  flex: 0 0 auto;
  min-width: 50px;
  max-width: 140px;
  height: 28px;
  box-sizing: border-box;
  background-color: #fff;
  border-radius: 6px;
  line-height: 26px;
  text-align: center;
  padding: 0 12px;
  color: #111f68;
  font-weight: 600;
  font-size: 13px;
  border: 1px solid #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 中等屏幕保持两列 */
@media (max-width: 1200px) {
  .ConfigurationPart ul {
    gap: 10px 16px;
  }
}

/* 小屏幕改为单列 */
@media (max-width: 768px) {
  .ConfigurationPart ul {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

/* 加载状态样式 */
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #6b7280;
  font-size: 13px;
}

.loading-container i {
  font-size: 18px;
  margin-right: 8px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误状态样式 */
.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #ef4444;
  font-size: 13px;
}

.error-container i {
  font-size: 18px;
  margin-right: 8px;
}

/* 无数据状态样式 */
.no-data-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #9ca3af;
  font-size: 13px;
}

.no-data-container i {
  font-size: 18px;
  margin-right: 8px;
}
</style>