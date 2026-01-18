<template>
<div class="ModelsStep2">
    <div class="ModelTitle">训练配置</div>
    <div class="InputPart">
        <div class="trainConfig">
            <div class="trainTitle">训练项目: {{ selectedProject ? selectedProject.project_name : '未选择项目' }}</div>
        </div>
    </div>
    
    <div class="choosePart">
        <div class="OfficialPart" :class="{ active: activeTab === 'official' }" @click="switchTab('official')">
            官方
        </div>
    </div>
    
    <!-- 开始训练按钮 -->
    <div class="train-action">
        <el-button 
            type="primary" 
            size="large" 
            @click="addTrainingTask"
            :loading="isAdding"
            :disabled="!selectedProject || !selectedModel"
            class="add-task-btn"
        >
            {{ isAdding ? '添加中...' : '添加训练任务' }}
        </el-button>
    </div>
    
    <Official 
        @model-selected="handleModelSelected"
        @config-changed="handleConfigChanged"
        :selected-project="selectedProject"
    />
</div>
</template>

<script>
import { createTrainingJob } from "@/api/training";
import Official from "@/views/Models/Official.vue";

export default {
    name: "ModelsStep2",
    components: { Official },
    props: {
        project: {
            type: Object,
            default: null
        }
    },
    data() {
        return {
            value: "",
            activeTab: "official", // 新增：默认选中官方标签
            selectedProject: null, // 添加选中的项目数据
            selectedModel: null, // 当前选择的模型
            isTraining: false, // 训练状态
            isCreating: false, // 创建状态
            isAdding: false,
            trainParams: {
                project_name: this.selectedProject ? this.selectedProject.project_name : '',
                dataset_name: this.selectedProject ? this.selectedProject.dataset.dataset_name : '',
                model_architecture: "",
                epochs: 100,
                batch_size: 16,
                learning_rate: 0.01,
                img_size: 640,
                optimizer: "auto",
                device: "cpu",
                workers: 8,
                patience: 50,
                use_pretrained: true,
                pretrained_model_path: "",
                resume_training: false,
                resume_job_id: "",
                resume_from_epoch: 0,
                momentum: 0.937,
                weight_decay: 0.0005,
                warmup_epochs: 3,
                warmup_momentum: 0.8,
                warmup_bias_lr: 0.1
            }
        };
    },
    methods: {
        // 切换标签的方法
        switchTab(tab) {
            this.activeTab = tab;
            // 清除之前的模型选择
            this.selectedModel = null;
            this.trainParams.model_architecture = "";
        },
        goCustom() {},
        goOfficial() {},
        // 处理子组件的模型选择事件
        handleModelSelected(modelData) {
            this.selectedModel = modelData.model;
            this.trainParams.model_architecture = modelData.model;
            console.log('接收到模型选择:', modelData);
        },
        // 处理子组件的配置变化事件
        handleConfigChanged(configData) {
            this.trainParams = { ...this.trainParams, ...configData };
            console.log('接收到配置变化:', configData);
        },
        // 开始训练方法
        async startTraining() {
            if (!this.selectedProject) {
                this.$message.error('请先选择一个项目');
                return;
            }
            
            if (!this.selectedModel) {
                this.$message.error('请先选择模型架构');
                return;
            }
            console.log("当前选择的数据集名称:", this.trainParams);
            // 验证数据集名称（从项目关联的数据集获取）
            if (!this.trainParams.dataset_name) {
                this.$message.error('项目未关联数据集，请检查项目配置');
                return;
            }
            
            this.isTraining = true;
            
            try {
                // 准备训练参数
                const trainingData = {
                    ...this.trainParams,
                    project_name: this.selectedProject.project_name,
                    model_architecture: this.selectedModel
                };
                
                console.log('提交训练参数:', trainingData);
                
                // 调用训练接口
                const result = await startTraining(trainingData);
                
                this.$message.success('训练任务已成功提交！');
                console.log('训练结果:', result);
                
                // 可以在这里添加跳转到训练状态页面的逻辑
                // this.$router.push('/training-status');
                
            } catch (error) {
                console.error('训练提交失败:', error);
                this.$message.error('训练提交失败: ' + (error.message || '未知错误'));
            } finally {
                this.isTraining = false;
            }
        },
        async addTrainingTask() {
            if (!this.selectedProject) {
                this.$message.error('请先选择一个项目');
                return;
            }
            if (!this.selectedModel) {
                this.$message.error('请先选择模型架构');
                return;
            }
            if (!this.trainParams.dataset_name) {
                this.$message.error('项目未关联数据集，请检查项目配置');
                return;
            }
            this.isAdding = true;
            try {
                const trainingData = {
                    ...this.trainParams,
                    project_name: this.selectedProject.project_name,
                    model_architecture: this.selectedModel
                };
                console.log('提交添加参数:', trainingData);
                const result = await createTrainingJob(trainingData);
                this.$message.success('训练任务已成功添加！(状态: pending)');
                this.EventBus && this.EventBus.$emit('taskAdded', result);
                this.$emit('task-added', result);
                this.$emit('close');
            } catch (error) {
                console.error('添加失败:', error);
                this.$message.error('添加失败: ' + (error.message || '未知错误'));
            } finally {
                this.isAdding = false;
            }
        },
        // 更新项目信息时同步训练参数
        updateProjectInfo(project) {
            this.selectedProject = project;
            this.value = project.project_name;
            this.trainParams.project_name = project.project_name;
            
            // 如果项目关联了数据集，自动填充数据集名称
            if (project.dataset.dataset_name) {
                this.trainParams.dataset_name = project.dataset.dataset_name;
            }
            
            console.log('Step2 接收到项目:', project);
        }
    },
    mounted() {
        this.EventBus && this.EventBus.$on('projectSelected', (project) => {
            this.updateProjectInfo(project);
        });
        if (this.project) {
            this.updateProjectInfo(this.project);
        } else {
            const projectId = this.$route && this.$route.query && this.$route.query.projectId;
            if (projectId) {
                try {
                    const stored = localStorage.getItem('currentProject');
                    if (stored) {
                        const p = JSON.parse(stored);
                        if (p && (p.project_id === projectId || p.project_id === Number(projectId))) {
                            this.updateProjectInfo(p);
                        }
                    }
                } catch (e) {}
            }
        }
    },
    watch: {
        project: {
            handler(p) {
                if (p) this.updateProjectInfo(p);
            },
            immediate: true
        }
    },
    beforeDestroy() {
        this.EventBus && this.EventBus.$off('projectSelected');
    },
};
</script>

<style scoped>
.ModelsStep2 {
    margin: 0 12px 12px 12px;
    color: #111f68;
    width: 100%;
    /* max-width: 100%; */
}

.InputPart {
    display: flex;
    margin-left: 3px;
    margin-bottom: 20px;
}

.ModelTitle {
    font-size: 20px;
    color: #111f68;
    margin-bottom: 15px;
}

.choosePart {
    display: flex;
    font-size: 16px;
    margin-bottom: 24px;
}

.OfficialPart,
.CustomPart {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 40px;
    cursor: pointer;
}

/* 修改为只在 active 类存在时显示下划线 */
.OfficialPart.active,
.CustomPart.active {
    border-bottom: 2px solid #111f68;
}

.OfficialPart {
    margin-right: 15px;
}

/* 训练按钮样式 */
.train-action {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
}

.add-task-btn {
    background-color: #111f68 !important;
    border-color: #111f68 !important;
    color: #fff !important;
    font-size: 16px;
    padding: 12px 36px;
    border-radius: 8px;
    font-weight: 600;
}

.add-task-btn:hover,
.add-task-btn:focus {
    background-color: #324293 !important;
    border-color: #324293 !important;
}

.add-task-btn:disabled {
    background-color: #c0c4cc !important;
    border-color: #c0c4cc !important;
    cursor: not-allowed;
}
</style>
