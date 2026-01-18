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
.ConfigurationPart{
  margin-left: 20px;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  /* 占满可用宽度并避免水平溢出 */
  box-sizing: border-box;
  width: auto;
  max-width: 96%;
  overflow-x: hidden;
}

.ConfigurationPart ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.title{
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #111f68;
}
.ConfigurationPart ul li{
  display: flex;
  justify-content: flex-start; /* 左对齐，右侧值用 margin-left:auto 贴右 */
  align-items: center;
  width: 100%;
  box-sizing: border-box; /* 让 padding 计入宽度，避免溢出 */
  height: 50px;
  font-size: 15px;
  margin: 8px 0;
  padding: 0 20px;
  border-bottom: 1px solid #E4E7ED;
  background-color: #fff;
  border-radius: 4px;
  transition: background-color 0.3s;
  overflow: hidden; /* 确保子元素不会把行撑出容器 */
}

.ConfigurationPart ul li:hover {
  background-color: #F5F7FA;
}

.description{
  font-size: 15px;
  margin-bottom: 20px;
  color: #666;
}

.ConfigurationPart ul li span{
  flex: 1 1 auto; /* 名称占据剩余空间 */
  min-width: 0; /* 允许收缩以启用省略号 */
  line-height: 50px;
  color: #333;
  font-weight: 500;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}

.ConfigurationPart ul li div{
  /* 允许在窄屏时收缩，避免把容器撑破 */
  flex: 0 1 300px;
  margin-left: auto; /* 将值推到容器最右侧（留有行内 padding） */
  width: auto;
  min-width: 30px;
  max-width: 10%;
  height: 32px;
  box-sizing: border-box;
  background-color: #f3f3f3;
  border-radius: 16px;
  line-height: 32px;
  text-align: center;
  padding: 0 12px;
  color: #606266;
  font-weight: 600;
  font-size: 13px;
  border: 1px solid #DCDFE6;
  white-space: nowrap; /* 单行显示，配合省略号 */
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 窄屏优化：进一步限制右侧值的最大宽度 */
@media (max-width: 768px) {
  .ConfigurationPart ul li div {
    max-width: 55%;
  }
}

/* 加载状态样式 */
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.loading-container i {
  font-size: 20px;
  margin-right: 10px;
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
  padding: 40px;
  color: #f56c6c;
}

.error-container i {
  font-size: 20px;
  margin-right: 10px;
}

/* 无数据状态样式 */
.no-data-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #999;
}

.no-data-container i {
  font-size: 20px;
  margin-right: 10px;
}
</style>