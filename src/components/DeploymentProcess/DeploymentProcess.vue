<template>
    <div class="deployment-process-container">
        <!-- 顶部标题 -->
        <div class="top">
            <h3>部署流程</h3>
            <div class="top-actions">
                <el-button
                    class="custom-default-btn"
                    @click="handleRefreshLogs"
                    :disabled="!currentProcess"
                >
                    <i class="el-icon-refresh"></i> 刷新日志
                </el-button>
                <el-button
                    type="primary"
                    class="custom-primary-btn"
                    @click="dialogFormVisible = true"
                >
                    + 创建流程
                </el-button>
            </div>
        </div>

        <!-- 主内容区域 -->
        <div class="content-wrapper">
            <!-- 左侧：流程列表和步骤配置 -->
            <div class="config-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-document"></i>
                    流程配置
                </h4>

                <div class="filter-area">
                    <el-select
                        v-model="selectedProcessId"
                        placeholder="选择部署流程"
                        @change="handleProcessChange"
                        class="process-select"
                    >
                        <el-option
                            v-for="process in processList"
                            :key="process.id"
                            :label="process.name"
                            :value="process.id"
                        >
                            <span style="float: left">{{ process.name }}</span>
                            <span style="float: right; color: #8e9aaf; font-size: 12px">
                                {{ process.steps.length }} 步骤
                            </span>
                        </el-option>
                    </el-select>
                </div>

                <div v-if="currentProcess" class="config-content">
                    <!-- 流程信息 -->
                    <div class="process-info">
                        <div class="info-row">
                            <span class="label">流程名称:</span>
                            <span class="value">{{ currentProcess.name }}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">创建时间:</span>
                            <span class="value">{{ currentProcess.createTime }}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">状态:</span>
                            <el-tag
                                :type="getStatusType(currentProcess.status)"
                                size="small"
                            >
                                {{ currentProcess.status }}
                            </el-tag>
                        </div>
                    </div>

                    <!-- 触发条件 -->
                    <div class="trigger-section">
                        <div class="trigger-title">
                            <i class="el-icon-bell"></i>
                            触发条件
                        </div>
                        <div class="trigger-list">
                            <div
                                v-for="(trigger, index) in currentProcess.triggers"
                                :key="index"
                                class="trigger-item"
                            >
                                <span class="trigger-icon">
                                    <i :class="getTriggerIcon(trigger.type)"></i>
                                </span>
                                <div class="trigger-content">
                                    <div class="trigger-name">{{ trigger.name }}</div>
                                    <div class="trigger-desc">{{ trigger.condition }}</div>
                                </div>
                                <el-switch
                                    v-model="trigger.enabled"
                                    :active-color="'#10b981'"
                                    :inactive-color="'#ccc'"
                                    size="small"
                                ></el-switch>
                            </div>
                        </div>
                    </div>

                    <!-- 流程步骤 -->
                    <div class="steps-section">
                        <div class="steps-title">
                            <i class="el-icon-menu"></i>
                            流程步骤
                        </div>
                        <div class="steps-list">
                            <div
                                v-for="(step, index) in currentProcess.steps"
                                :key="index"
                                class="step-item"
                                :class="{ 'active': step.status === '执行中', 'completed': step.status === '已完成', 'failed': step.status === '失败' }"
                            >
                                <div class="step-number">{{ index + 1 }}</div>
                                <div class="step-content">
                                    <div class="step-name">{{ step.name }}</div>
                                    <div class="step-desc">{{ step.description }}</div>
                                    <div class="step-meta">
                                        <span class="meta-item">
                                            <i class="el-icon-time"></i>
                                            {{ step.duration || '-' }}
                                        </span>
                                        <el-tag
                                            :type="getStepStatusType(step.status)"
                                            size="mini"
                                        >
                                            {{ step.status }}
                                        </el-tag>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div class="action-buttons">
                        <el-button
                            type="primary"
                            class="custom-primary-btn"
                            @click="handleStartProcess"
                            :loading="isExecuting"
                            :disabled="currentProcess.status === '执行中'"
                        >
                            <i class="el-icon-video-play"></i>
                            {{ isExecuting ? '执行中...' : '开始执行' }}
                        </el-button>
                        <el-button
                            class="custom-danger-btn"
                            @click="handleStopProcess"
                            :disabled="!isExecuting"
                        >
                            <i class="el-icon-video-pause"></i>
                            停止执行
                        </el-button>
                        <el-button
                            @click="handleEditProcess"
                        >
                            <i class="el-icon-edit"></i>
                            编辑流程
                        </el-button>
                    </div>
                </div>

                <div v-else class="empty-state">
                    <i class="el-icon-document"></i>
                    <p>请选择或创建一个部署流程</p>
                </div>
            </div>

            <!-- 右侧：执行进度和日志 -->
            <div class="right-section">
                <!-- 执行进度 -->
                <div class="progress-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-loading"></i>
                        执行进度
                    </h4>

                    <div v-if="currentProcess && currentProcess.status !== '未开始'" class="progress-content">
                        <div class="overall-progress">
                            <div class="progress-header">
                                <span class="label">整体进度</span>
                                <span class="percentage">{{ executionProgress.percentage }}%</span>
                            </div>
                            <el-progress
                                :percentage="executionProgress.percentage"
                                :color="progressColor"
                                :status="executionProgress.percentage === 100 ? 'success' : null"
                            ></el-progress>
                        </div>

                        <div class="progress-stats">
                            <div class="stat-card">
                                <div class="stat-icon total">
                                    <i class="el-icon-document"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">总步骤</div>
                                    <div class="stat-value">{{ executionProgress.total }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon success">
                                    <i class="el-icon-success"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">已完成</div>
                                    <div class="stat-value">{{ executionProgress.completed }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon running">
                                    <i class="el-icon-loading"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">进行中</div>
                                    <div class="stat-value">{{ executionProgress.running }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon failed">
                                    <i class="el-icon-close"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">失败</div>
                                    <div class="stat-value">{{ executionProgress.failed }}</div>
                                </div>
                            </div>
                        </div>

                        <div class="current-step">
                            <div class="current-step-label">当前步骤</div>
                            <div class="current-step-content">
                                <span class="step-name">{{ executionProgress.currentStep }}</span>
                                <span class="step-time">已执行 {{ executionProgress.duration }}</span>
                            </div>
                        </div>
                    </div>

                    <div v-else class="empty-progress">
                        <i class="el-icon-document-copy"></i>
                        <p>等待开始执行</p>
                    </div>
                </div>

                <!-- 执行日志 -->
                <div class="logs-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-document"></i>
                        执行日志
                        <span v-if="executionLogs.length > 0" class="log-count">
                            ({{ executionLogs.length }})
                        </span>
                    </h4>

                    <div class="log-filters">
                        <el-radio-group v-model="logFilter" size="small" @change="handleLogFilterChange">
                            <el-radio-button label="all">全部</el-radio-button>
                            <el-radio-button label="info">信息</el-radio-button>
                            <el-radio-button label="success">成功</el-radio-button>
                            <el-radio-button label="warning">警告</el-radio-button>
                            <el-radio-button label="error">错误</el-radio-button>
                        </el-radio-group>
                        <el-button
                            size="small"
                            @click="handleClearLogs"
                            :disabled="executionLogs.length === 0"
                        >
                            清空日志
                        </el-button>
                    </div>

                    <div v-if="filteredLogs.length > 0" class="logs-container" ref="logsContainer">
                        <div
                            v-for="(log, index) in filteredLogs"
                            :key="index"
                            class="log-item"
                            :class="log.level"
                        >
                            <span class="log-time">{{ log.time }}</span>
                            <span class="log-level">
                                <i :class="getLogIcon(log.level)"></i>
                                {{ getLogLabel(log.level) }}
                            </span>
                            <span class="log-message">{{ log.message }}</span>
                        </div>
                    </div>

                    <div v-else class="empty-logs">
                        <i class="el-icon-document"></i>
                        <p>{{ executionLogs.length === 0 ? '暂无日志' : '没有符合条件的日志' }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 创建流程对话框 -->
        <el-dialog title="创建部署流程" :visible.sync="dialogFormVisible" width="700px">
            <el-form :model="newProcessForm" :rules="rules" ref="formRef" label-width="100px">
                <el-form-item label="流程名称" prop="name">
                    <el-input v-model="newProcessForm.name" placeholder="请输入流程名称"></el-input>
                </el-form-item>
                <el-form-item label="描述" prop="description">
                    <el-input
                        v-model="newProcessForm.description"
                        type="textarea"
                        placeholder="请输入流程描述"
                        rows="3"
                    ></el-input>
                </el-form-item>
                <el-form-item label="触发方式" prop="triggerType">
                    <el-checkbox-group v-model="newProcessForm.triggerType">
                        <el-checkbox label="手动触发"></el-checkbox>
                        <el-checkbox label="定时触发"></el-checkbox>
                        <el-checkbox label="代码提交"></el-checkbox>
                        <el-checkbox label="标签发布"></el-checkbox>
                    </el-checkbox-group>
                </el-form-item>
                <el-form-item label="环境" prop="environment">
                    <el-select v-model="newProcessForm.environment" placeholder="选择部署环境">
                        <el-option label="开发环境" value="dev"></el-option>
                        <el-option label="测试环境" value="test"></el-option>
                        <el-option label="预发布环境" value="staging"></el-option>
                        <el-option label="生产环境" value="production"></el-option>
                    </el-select>
                </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
                <el-button @click="dialogFormVisible = false">取 消</el-button>
                <el-button type="primary" @click="handleCreateProcess">创 建</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
export default {
    name: 'DeploymentProcess',
    data() {
        return {
            selectedProcessId: null,
            isExecuting: false,
            logFilter: 'all',
            dialogFormVisible: false,
            newProcessForm: {
                name: '',
                description: '',
                triggerType: [],
                environment: ''
            },
            rules: {
                name: [{ required: true, message: '请输入流程名称', trigger: 'blur' }],
                description: [{ required: true, message: '请输入流程描述', trigger: 'blur' }],
                triggerType: [{ required: true, message: '请选择触发方式', trigger: 'change' }],
                environment: [{ required: true, message: '请选择部署环境', trigger: 'change' }]
            },
            processList: [
                {
                    id: 1,
                    name: '生产环境部署',
                    createTime: '2026-01-15 10:30:00',
                    status: '已完成',
                    triggers: [
                        { type: 'manual', name: '手动触发', condition: '手动启动部署流程', enabled: true },
                        { type: 'tag', name: '标签发布', condition: 'tag: v1.*', enabled: true }
                    ],
                    steps: [
                        { name: '代码检出', description: '从Git仓库拉取代码', status: '已完成', duration: '12s' },
                        { name: '依赖安装', description: '安装项目依赖包', status: '已完成', duration: '45s' },
                        { name: '代码构建', description: '编译打包应用程序', status: '已完成', duration: '2m 15s' },
                        { name: '运行测试', description: '执行单元测试和集成测试', status: '已完成', duration: '1m 30s' },
                        { name: '部署应用', description: '部署到生产服务器', status: '已完成', duration: '58s' },
                        { name: '健康检查', description: '验证服务运行状态', status: '已完成', duration: '20s' }
                    ]
                },
                {
                    id: 2,
                    name: '测试环境部署',
                    createTime: '2026-01-16 09:15:00',
                    status: '执行中',
                    triggers: [
                        { type: 'manual', name: '手动触发', condition: '手动启动部署流程', enabled: true },
                        { type: 'commit', name: '代码提交', condition: 'branch: develop', enabled: true }
                    ],
                    steps: [
                        { name: '代码检出', description: '从Git仓库拉取代码', status: '已完成', duration: '8s' },
                        { name: '依赖安装', description: '安装项目依赖包', status: '已完成', duration: '32s' },
                        { name: '代码构建', description: '编译打包应用程序', status: '执行中', duration: '1m 5s' },
                        { name: '运行测试', description: '执行单元测试和集成测试', status: '等待中', duration: null },
                        { name: '部署应用', description: '部署到测试服务器', status: '等待中', duration: null }
                    ]
                },
                {
                    id: 3,
                    name: '预发布环境部署',
                    createTime: '2026-01-14 16:20:00',
                    status: '未开始',
                    triggers: [
                        { type: 'manual', name: '手动触发', condition: '手动启动部署流程', enabled: true },
                        { type: 'schedule', name: '定时触发', condition: '每天 02:00', enabled: false }
                    ],
                    steps: [
                        { name: '代码检出', description: '从Git仓库拉取代码', status: '等待中', duration: null },
                        { name: '依赖安装', description: '安装项目依赖包', status: '等待中', duration: null },
                        { name: '代码构建', description: '编译打包应用程序', status: '等待中', duration: null },
                        { name: '运行测试', description: '执行单元测试和集成测试', status: '等待中', duration: null },
                        { name: '部署应用', description: '部署到预发布服务器', status: '等待中', duration: null },
                        { name: '健康检查', description: '验证服务运行状态', status: '等待中', duration: null },
                        { name: '通知相关人员', description: '发送部署成功通知', status: '等待中', duration: null }
                    ]
                }
            ],
            executionLogs: [],
            executionTimer: null,
            startTime: null
        };
    },
    computed: {
        currentProcess() {
            return this.processList.find(p => p.id === this.selectedProcessId) || null;
        },
        executionProgress() {
            if (!this.currentProcess) {
                return { percentage: 0, total: 0, completed: 0, running: 0, failed: 0, currentStep: '-', duration: '0s' };
            }

            const total = this.currentProcess.steps.length;
            const completed = this.currentProcess.steps.filter(s => s.status === '已完成').length;
            const running = this.currentProcess.steps.filter(s => s.status === '执行中').length;
            const failed = this.currentProcess.steps.filter(s => s.status === '失败').length;
            const percentage = total > 0 ? Math.floor((completed / total) * 100) : 0;
            const currentStepObj = this.currentProcess.steps.find(s => s.status === '执行中');
            const currentStep = currentStepObj ? currentStepObj.name : (completed === total ? '全部完成' : '等待开始');

            let duration = '0s';
            if (this.startTime) {
                const elapsed = Math.floor((new Date() - this.startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            }

            return { percentage, total, completed, running, failed, currentStep, duration };
        },
        progressColor() {
            const percentage = this.executionProgress.percentage;
            if (percentage < 50) return '#3b82f6';
            if (percentage < 80) return '#f59e0b';
            return '#10b981';
        },
        filteredLogs() {
            if (this.logFilter === 'all') {
                return this.executionLogs;
            }
            return this.executionLogs.filter(log => log.level === this.logFilter);
        }
    },
    methods: {
        handleProcessChange() {
            // 切换流程时清空日志
            this.executionLogs = [];
        },
        getStatusType(status) {
            const typeMap = {
                '未开始': 'info',
                '执行中': 'warning',
                '已完成': 'success',
                '失败': 'danger'
            };
            return typeMap[status] || 'info';
        },
        getStepStatusType(status) {
            const typeMap = {
                '等待中': 'info',
                '执行中': 'warning',
                '已完成': 'success',
                '失败': 'danger'
            };
            return typeMap[status] || 'info';
        },
        getTriggerIcon(type) {
            const iconMap = {
                'manual': 'el-icon-user',
                'schedule': 'el-icon-time',
                'commit': 'el-icon-upload',
                'tag': 'el-icon-sell'
            };
            return iconMap[type] || 'el-icon-setting';
        },
        getLogIcon(level) {
            const iconMap = {
                'info': 'el-icon-info',
                'success': 'el-icon-success',
                'warning': 'el-icon-warning',
                'error': 'el-icon-error'
            };
            return iconMap[level] || 'el-icon-info';
        },
        getLogLabel(level) {
            const labelMap = {
                'info': 'INFO',
                'success': 'SUCCESS',
                'warning': 'WARN',
                'error': 'ERROR'
            };
            return labelMap[level] || 'INFO';
        },
        handleStartProcess() {
            if (!this.currentProcess) {
                this.$message.warning('请先选择一个部署流程');
                return;
            }

            this.$confirm('确认开始执行此部署流程吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.isExecuting = true;
                this.startTime = new Date();
                this.currentProcess.status = '执行中';
                this.executionLogs = [];

                this.addLog('info', '部署流程开始执行...');
                this.$message.success('部署流程已启动');

                // 模拟执行流程
                this.simulateExecution();
            }).catch(() => {
                this.$message.info('已取消操作');
            });
        },
        handleStopProcess() {
            this.$confirm('确认停止执行此部署流程吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                if (this.executionTimer) {
                    clearInterval(this.executionTimer);
                }
                this.isExecuting = false;
                this.currentProcess.status = '已完成';
                this.addLog('warning', '部署流程已手动停止');
                this.$message.warning('部署流程已停止');
            }).catch(() => {
                this.$message.info('已取消操作');
            });
        },
        simulateExecution() {
            let currentStepIndex = 0;
            const steps = this.currentProcess.steps;

            // 重置所有步骤状态
            steps.forEach(step => {
                step.status = '等待中';
                step.duration = null;
            });

            this.executionTimer = setInterval(() => {
                if (currentStepIndex < steps.length) {
                    const step = steps[currentStepIndex];
                    
                    if (step.status === '等待中') {
                        step.status = '执行中';
                        this.addLog('info', `开始执行: ${step.name}`);
                    } else if (step.status === '执行中') {
                        const isSuccess = Math.random() > 0.1; // 90% 成功率
                        
                        if (isSuccess) {
                            step.status = '已完成';
                            const duration = Math.floor(Math.random() * 120) + 10;
                            step.duration = duration > 60 
                                ? `${Math.floor(duration / 60)}m ${duration % 60}s` 
                                : `${duration}s`;
                            this.addLog('success', `${step.name} 执行成功 (耗时: ${step.duration})`);
                            currentStepIndex++;
                        } else {
                            step.status = '失败';
                            step.duration = '-';
                            this.addLog('error', `${step.name} 执行失败: 连接超时`);
                            clearInterval(this.executionTimer);
                            this.isExecuting = false;
                            this.currentProcess.status = '失败';
                            this.$message.error('部署流程执行失败');
                        }
                    }
                } else {
                    clearInterval(this.executionTimer);
                    this.isExecuting = false;
                    this.currentProcess.status = '已完成';
                    this.addLog('success', '部署流程执行完成！');
                    this.$message.success('部署流程执行完成');
                }
            }, 1500);
        },
        addLog(level, message) {
            const log = {
                time: new Date().toLocaleTimeString(),
                level: level,
                message: message
            };
            this.executionLogs.push(log);

            // 自动滚动到底部
            this.$nextTick(() => {
                if (this.$refs.logsContainer) {
                    this.$refs.logsContainer.scrollTop = this.$refs.logsContainer.scrollHeight;
                }
            });
        },
        handleLogFilterChange() {
            // 日志过滤变化
        },
        handleClearLogs() {
            this.$confirm('确认清空所有日志吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.executionLogs = [];
                this.$message.success('日志已清空');
            });
        },
        handleRefreshLogs() {
            this.addLog('info', '日志已刷新');
            this.$message.success('日志已刷新');
        },
        handleEditProcess() {
            this.$message.info('编辑流程功能');
        },
        handleCreateProcess() {
            this.$refs.formRef.validate(valid => {
                if (valid) {
                    const newProcess = {
                        id: Math.max(...this.processList.map(p => p.id), 0) + 1,
                        name: this.newProcessForm.name,
                        createTime: new Date().toLocaleString(),
                        status: '未开始',
                        triggers: [
                            { type: 'manual', name: '手动触发', condition: '手动启动部署流程', enabled: true }
                        ],
                        steps: [
                            { name: '代码检出', description: '从Git仓库拉取代码', status: '等待中', duration: null },
                            { name: '依赖安装', description: '安装项目依赖包', status: '等待中', duration: null },
                            { name: '代码构建', description: '编译打包应用程序', status: '等待中', duration: null },
                            { name: '部署应用', description: `部署到${this.newProcessForm.environment}环境`, status: '等待中', duration: null }
                        ]
                    };
                    this.processList.push(newProcess);
                    this.$message.success('部署流程创建成功');
                    this.dialogFormVisible = false;
                    this.selectedProcessId = newProcess.id;
                    this.$refs.formRef.resetFields();
                }
            });
        }
    },
    mounted() {
        if (this.processList.length > 0) {
            this.selectedProcessId = this.processList[0].id;
        }
    },
    beforeDestroy() {
        if (this.executionTimer) {
            clearInterval(this.executionTimer);
        }
    }
};
</script>

<style scoped>
.deployment-process-container {
    display: flex;
    flex-direction: column;
    margin-left: 10px;
    box-sizing: border-box;
    width: calc(100% - 20px);
    min-width: 800px;
}

.top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.top h3 {
    font-size: 24px;
    font-weight: bolder;
    color: #111f68;
}

.top-actions {
    display: flex;
    gap: 10px;
}

.top-actions .el-button {
    border-radius: 6px;
}

/* 主内容区域 */
.content-wrapper {
    display: flex;
    gap: 20px;
    width: 100%;
    height: calc(100vh - 150px);
}

/* 左侧：配置 */
.config-section {
    flex: 0 0 40%;
    max-width: 450px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

/* 右侧：进度和日志 */
.right-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 0;
    overflow-y: auto;
}

/* 通用卡片样式 */
.section-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #e8ecef;
    flex-shrink: 0;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #111f68;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-title i {
    font-size: 18px;
}

.log-count {
    font-size: 12px;
    color: #8e9aaf;
    font-weight: normal;
}

/* 过滤区域 */
.filter-area {
    margin-bottom: 16px;
}

.process-select {
    width: 100%;
}

/* 配置内容 */
.config-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    overflow-y: auto;
}

/* 流程信息 */
.process-info {
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
}

.info-row .label {
    color: #6c757d;
    font-weight: 500;
}

.info-row .value {
    color: #111f68;
}

/* 触发条件 */
.trigger-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.trigger-title {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
    display: flex;
    align-items: center;
    gap: 6px;
}

.trigger-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.trigger-item {
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e8ecef;
    display: flex;
    align-items: center;
    gap: 10px;
}

.trigger-icon {
    font-size: 18px;
    color: #111f68;
    flex-shrink: 0;
}

.trigger-content {
    flex: 1;
}

.trigger-name {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
    margin-bottom: 2px;
}

.trigger-desc {
    font-size: 12px;
    color: #8e9aaf;
}

/* 流程步骤 */
.steps-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.steps-title {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
    display: flex;
    align-items: center;
    gap: 6px;
}

.steps-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.step-item {
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 6px;
    border-left: 4px solid #e8ecef;
    display: flex;
    gap: 12px;
    transition: all 0.3s;
}

.step-item.completed {
    border-left-color: #10b981;
    background-color: #f0fdf4;
}

.step-item.active {
    border-left-color: #f59e0b;
    background-color: #fffbf0;
}

.step-item.failed {
    border-left-color: #f43f5e;
    background-color: #fef2f2;
}

.step-number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: #e8ecef;
    color: #6c757d;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
}

.step-item.completed .step-number {
    background-color: #10b981;
    color: #fff;
}

.step-item.active .step-number {
    background-color: #f59e0b;
    color: #fff;
}

.step-item.failed .step-number {
    background-color: #f43f5e;
    color: #fff;
}

.step-content {
    flex: 1;
}

.step-name {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
    margin-bottom: 4px;
}

.step-desc {
    font-size: 12px;
    color: #6c757d;
    margin-bottom: 6px;
}

.step-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #8e9aaf;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

/* 操作按钮 */
.action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.action-buttons .el-button {
    flex: 1;
    min-width: 110px;
    border-radius: 6px;
    font-size: 13px;
}

.custom-primary-btn {
    background-color: #111f68 !important;
    border-color: #111f68 !important;
    color: #fff !important;
}

.custom-primary-btn:hover:not(:disabled) {
    background-color: #0d1554 !important;
    border-color: #0d1554 !important;
}

.custom-primary-btn:disabled {
    background-color: #d5d5d5 !important;
    border-color: #d5d5d5 !important;
    color: #999 !important;
}

.custom-default-btn {
    background-color: #ffffff !important;
    border-color: #111f68 !important;
    color: #111f68 !important;
}

.custom-default-btn:hover {
    background-color: #f0f3f9 !important;
}

.custom-danger-btn {
    background-color: #f43f5e !important;
    border-color: #f43f5e !important;
    color: #fff !important;
}

.custom-danger-btn:hover:not(:disabled) {
    background-color: #e11d48 !important;
    border-color: #e11d48 !important;
}

.custom-danger-btn:disabled {
    background-color: #d5d5d5 !important;
    border-color: #d5d5d5 !important;
    color: #999 !important;
}

/* 空状态 */
.empty-state,
.empty-progress,
.empty-logs {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    color: #8e9aaf;
    font-size: 14px;
}

.empty-state i,
.empty-progress i,
.empty-logs i {
    font-size: 32px;
    color: #d5d5d5;
}

/* 执行进度 */
.progress-section {
    flex: 0 0 auto;
}

.progress-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.overall-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.progress-header .label {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
}

.progress-header .percentage {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

.progress-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
}

.stat-card {
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
}

.stat-icon.total {
    background-color: #e0e7ff;
    color: #3b82f6;
}

.stat-icon.success {
    background-color: #d1fae5;
    color: #10b981;
}

.stat-icon.running {
    background-color: #fef3c7;
    color: #f59e0b;
}

.stat-icon.failed {
    background-color: #fee2e2;
    color: #f43f5e;
}

.stat-content {
    flex: 1;
}

.stat-label {
    font-size: 11px;
    color: #8e9aaf;
    margin-bottom: 2px;
}

.stat-value {
    font-size: 16px;
    font-weight: 600;
    color: #111f68;
}

.current-step {
    padding: 12px;
    background-color: #f0f9ff;
    border-radius: 6px;
    border-left: 4px solid #3b82f6;
}

.current-step-label {
    font-size: 12px;
    color: #6c757d;
    margin-bottom: 4px;
}

.current-step-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.current-step-content .step-name {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

.current-step-content .step-time {
    font-size: 12px;
    color: #8e9aaf;
}

/* 执行日志 */
.logs-section {
    flex: 1;
    min-height: 0;
}

.log-filters {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    gap: 10px;
}

.logs-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 400px;
    overflow-y: auto;
    padding: 12px;
    background-color: #1e293b;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
}

.log-item {
    display: flex;
    gap: 10px;
    font-size: 12px;
    line-height: 1.6;
    padding: 4px 8px;
    border-radius: 4px;
}

.log-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
}

.log-time {
    color: #94a3b8;
    flex-shrink: 0;
    min-width: 80px;
}

.log-level {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    min-width: 70px;
    font-weight: 600;
}

.log-item.info .log-level {
    color: #3b82f6;
}

.log-item.success .log-level {
    color: #10b981;
}

.log-item.warning .log-level {
    color: #f59e0b;
}

.log-item.error .log-level {
    color: #f43f5e;
}

.log-message {
    color: #e2e8f0;
    flex: 1;
    word-break: break-word;
}

/* 对话框样式 */
.el-dialog {
    width: 700px !important;
}

.dialog-footer {
    padding: 10px 20px !important;
}

/* 滚动条样式 */
.config-content::-webkit-scrollbar,
.config-section::-webkit-scrollbar,
.right-section::-webkit-scrollbar,
.logs-container::-webkit-scrollbar {
    width: 6px;
}

.config-content::-webkit-scrollbar-track,
.config-section::-webkit-scrollbar-track,
.right-section::-webkit-scrollbar-track,
.logs-container::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.logs-container::-webkit-scrollbar-track {
    background: #0f172a;
}

.config-content::-webkit-scrollbar-thumb,
.config-section::-webkit-scrollbar-thumb,
.right-section::-webkit-scrollbar-thumb,
.logs-container::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.logs-container::-webkit-scrollbar-thumb {
    background: #475569;
}

.config-content::-webkit-scrollbar-thumb:hover,
.config-section::-webkit-scrollbar-thumb:hover,
.right-section::-webkit-scrollbar-thumb:hover,
.logs-container::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

.logs-container::-webkit-scrollbar-thumb:hover {
    background: #64748b;
}

/* 响应式设计 */
@media (max-width: 1400px) {
    .content-wrapper {
        height: auto;
        flex-direction: column;
    }

    .config-section {
        flex: 0 0 auto;
        max-width: none;
        max-height: 500px;
    }

    .right-section {
        flex: 1;
    }

    .progress-stats {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 1024px) {
    .deployment-process-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .progress-stats {
        grid-template-columns: repeat(2, 1fr);
    }

    .log-filters {
        flex-direction: column;
        align-items: stretch;
    }

    .current-step-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }
}
</style>