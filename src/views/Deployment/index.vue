<template>
    <div class="deployment-page page-container">
        <!-- 顶部标题 -->
        <header class="deploy-hero">
            <div class="deploy-hero-left">
                <div class="deploy-eyebrow">DevOps Center</div>
                <h1 class="deploy-title">Deployment Process</h1>
                <p class="deploy-subtitle">Manage and monitor automatic deployment pipelines.</p>
            </div>
            <div class="deploy-hero-right">
                <el-button
                    class="glass-btn"
                    @click="handleRefreshLogs"
                    :disabled="!currentProcess"
                >
                    <i class="el-icon-refresh"></i> Refresh Logs
                </el-button>
                <el-button
                    type="primary"
                    class="primary-action"
                    @click="dialogFormVisible = true"
                >
                    + Create Pipeline
                </el-button>
            </div>
        </header>

        <!-- 主内容区域 -->
        <div class="content-wrapper">
            <!-- 左侧：流程列表和步骤配置 -->
            <div class="config-section glass-panel">
                <h4 class="section-title">
                    <i class="el-icon-s-operation"></i>
                    Pipeline Configuration
                </h4>

                <div class="filter-area">
                    <el-select
                        v-model="selectedProcessId"
                        placeholder="Select Pipeline"
                        @change="handleProcessChange"
                        class="process-select"
                        popper-class="glass-dropdown"
                    >
                        <el-option
                            v-for="process in processList"
                            :key="process.id"
                            :label="process.name"
                            :value="process.id"
                        >
                            <span style="float: left">{{ process.name }}</span>
                            <span style="float: right; color: var(--text-secondary); font-size: 12px">
                                {{ process.steps.length }} steps
                            </span>
                        </el-option>
                    </el-select>
                </div>

                <div v-if="currentProcess" class="config-content">
                    <!-- 流程信息 -->
                    <div class="process-info">
                        <div class="info-row">
                            <span class="label">Name:</span>
                            <span class="value">{{ currentProcess.name }}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Created:</span>
                            <span class="value">{{ currentProcess.createTime }}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Status:</span>
                            <el-tag
                                :type="getStatusType(currentProcess.status)"
                                size="small"
                                effect="dark"
                            >
                                {{ currentProcess.status }}
                            </el-tag>
                        </div>
                    </div>

                    <!-- 触发条件 -->
                    <div class="trigger-section">
                        <div class="trigger-title">
                            <i class="el-icon-bell"></i>
                            Triggers
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
                                    active-color="var(--color-primary)"
                                    inactive-color="#ccc"
                                    size="small"
                                ></el-switch>
                            </div>
                        </div>
                    </div>

                    <!-- 流程步骤 -->
                    <div class="steps-section">
                        <div class="steps-title">
                            <i class="el-icon-menu"></i>
                            Steps
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
                                            effect="plain"
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
                            {{ isExecuting ? 'Running...' : 'Run Pipeline' }}
                        </el-button>
                        <el-button
                            type="danger"
                            plain
                            @click="handleStopProcess"
                            :disabled="!isExecuting"
                        >
                            <i class="el-icon-video-pause"></i>
                            Stop
                        </el-button>
                        <el-button
                            plain
                            @click="handleEditProcess"
                        >
                            <i class="el-icon-edit"></i>
                            Edit
                        </el-button>
                    </div>
                </div>

                <div v-else class="empty-state">
                    <i class="el-icon-document"></i>
                    <p>Select or create a pipeline</p>
                </div>
            </div>

            <!-- 右侧：执行进度和日志 -->
            <div class="right-section">
                <!-- 执行进度 -->
                <div class="progress-section glass-panel">
                    <h4 class="section-title">
                        <i class="el-icon-loading"></i>
                        Progress
                    </h4>

                    <div v-if="currentProcess && currentProcess.status !== '未开始'" class="progress-content">
                        <div class="overall-progress">
                            <div class="progress-header">
                                <span class="label">Overall Progress</span>
                                <span class="percentage">{{ executionProgress.percentage }}%</span>
                            </div>
                            <el-progress
                                :text-inside="true"
                                :stroke-width="18"
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
                                    <div class="stat-label">Total Steps</div>
                                    <div class="stat-value">{{ executionProgress.total }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon success">
                                    <i class="el-icon-success"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">Completed</div>
                                    <div class="stat-value">{{ executionProgress.completed }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon running">
                                    <i class="el-icon-loading"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">Running</div>
                                    <div class="stat-value">{{ executionProgress.running }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon failed">
                                    <i class="el-icon-close"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">Failed</div>
                                    <div class="stat-value">{{ executionProgress.failed }}</div>
                                </div>
                            </div>
                        </div>

                        <div class="current-step">
                            <div class="current-step-label">Current Step</div>
                            <div class="current-step-content">
                                <span class="step-name">{{ executionProgress.currentStep }}</span>
                                <span class="step-time">Elapsed: {{ executionProgress.duration }}</span>
                            </div>
                        </div>
                    </div>

                    <div v-else class="empty-progress">
                        <i class="el-icon-cpu"></i>
                        <p>Waiting to start...</p>
                    </div>
                </div>

                <!-- 执行日志 -->
                <div class="logs-section glass-panel">
                    <h4 class="section-title">
                        <i class="el-icon-document-copy"></i>
                        Console Output
                        <span v-if="executionLogs.length > 0" class="log-count">
                            ({{ executionLogs.length }})
                        </span>
                    </h4>

                    <div class="log-filters">
                        <el-radio-group v-model="logFilter" size="mini" @change="handleLogFilterChange" fill="var(--color-primary)">
                            <el-radio-button label="all">All</el-radio-button>
                            <el-radio-button label="info">Info</el-radio-button>
                            <el-radio-button label="success">Success</el-radio-button>
                            <el-radio-button label="warning">Warn</el-radio-button>
                            <el-radio-button label="error">Error</el-radio-button>
                        </el-radio-group>
                        <el-button
                            size="mini"
                            class="glass-btn-sm"
                            @click="handleClearLogs"
                            :disabled="executionLogs.length === 0"
                        >
                            Clear
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
                        <i class="el-icon-tickets"></i>
                        <p>{{ executionLogs.length === 0 ? 'No logs available' : 'No logs match filter' }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 创建流程对话框 -->
        <el-dialog title="Create Release Pipeline" :visible.sync="dialogFormVisible" width="600px" custom-class="glass-dialog">
            <el-form :model="newProcessForm" :rules="rules" ref="formRef" label-position="top">
                <el-form-item label="Pipeline Name" prop="name">
                    <el-input v-model="newProcessForm.name" placeholder="e.g. Production Release v2"></el-input>
                </el-form-item>
                <el-form-item label="Description" prop="description">
                    <el-input
                        v-model="newProcessForm.description"
                        type="textarea"
                        placeholder="Brief description of this pipeline"
                        rows="3"
                    ></el-input>
                </el-form-item>
                <el-form-item label="Triggers" prop="triggerType">
                    <el-checkbox-group v-model="newProcessForm.triggerType">
                        <el-checkbox label="Manual"></el-checkbox>
                        <el-checkbox label="Schedule"></el-checkbox>
                        <el-checkbox label="Git Push"></el-checkbox>
                        <el-checkbox label="Git Tag"></el-checkbox>
                    </el-checkbox-group>
                </el-form-item>
                <el-form-item label="Environment" prop="environment">
                    <el-select v-model="newProcessForm.environment" placeholder="Select Target Environment" style="width: 100%">
                        <el-option label="Development" value="dev"></el-option>
                        <el-option label="Testing" value="test"></el-option>
                        <el-option label="Staging" value="staging"></el-option>
                        <el-option label="Production" value="production"></el-option>
                    </el-select>
                </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
                <el-button @click="dialogFormVisible = false">Cancel</el-button>
                <el-button type="primary" @click="handleCreateProcess">Create</el-button>
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
                name: [{ required: true, message: 'Required', trigger: 'blur' }],
                description: [{ required: true, message: 'Required', trigger: 'blur' }],
                triggerType: [{ required: true, message: 'Please select at least one trigger', trigger: 'change' }],
                environment: [{ required: true, message: 'Required', trigger: 'change' }]
            },
            processList: [
                {
                    id: 1,
                    name: 'Production Deploy',
                    createTime: '2026-01-15 10:30:00',
                    status: '已完成',
                    triggers: [
                        { type: 'manual', name: 'Manual', condition: 'User Triggered', enabled: true },
                        { type: 'tag', name: 'Tag Release', condition: 'tag: v1.*', enabled: true }
                    ],
                    steps: [
                        { name: 'Checkout', description: 'Git Fetch', status: '已完成', duration: '12s' },
                        { name: 'Install Deps', description: 'npm install', status: '已完成', duration: '45s' },
                        { name: 'Build', description: 'npm run build', status: '已完成', duration: '2m 15s' },
                        { name: 'Test', description: 'Run unit tests', status: '已完成', duration: '1m 30s' },
                        { name: 'Deploy', description: 'Upload to Prod', status: '已完成', duration: '58s' },
                        { name: 'Health Check', description: 'Ping /health', status: '已完成', duration: '20s' }
                    ]
                },
                {
                    id: 2,
                    name: 'Staging Deploy',
                    createTime: '2026-01-16 09:15:00',
                    status: '执行中',
                    triggers: [
                        { type: 'manual', name: 'Manual', condition: 'User Triggered', enabled: true },
                        { type: 'commit', name: 'Git Commit', condition: 'branch: develop', enabled: true }
                    ],
                    steps: [
                        { name: 'Checkout', description: 'Git Fetch', status: '已完成', duration: '8s' },
                        { name: 'Install Deps', description: 'npm install', status: '已完成', duration: '32s' },
                        { name: 'Build', description: 'npm run build', status: '执行中', duration: '1m 5s' },
                        { name: 'Test', description: 'Run unit tests', status: '等待中', duration: null },
                        { name: 'Deploy', description: 'Upload to Staging', status: '等待中', duration: null }
                    ]
                },
                {
                    id: 3,
                    name: 'Nightly Build',
                    createTime: '2026-01-14 16:20:00',
                    status: '未开始',
                    triggers: [
                        { type: 'manual', name: 'Manual', condition: 'User Triggered', enabled: true },
                        { type: 'schedule', name: 'Schedule', condition: 'Daily 02:00', enabled: false }
                    ],
                    steps: [
                        { name: 'Checkout', description: 'Git Fetch', status: '等待中', duration: null },
                        { name: 'Install Deps', description: 'npm install', status: '等待中', duration: null },
                        { name: 'Build', description: 'npm run build', status: '等待中', duration: null },
                        { name: 'Test', description: 'Run unit tests', status: '等待中', duration: null },
                        { name: 'Deploy', description: 'Upload to Dev', status: '等待中', duration: null },
                        { name: 'Health Check', description: 'Ping /health', status: '等待中', duration: null },
                        { name: 'Notify', description: 'Slack Notification', status: '等待中', duration: null }
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
            const currentStep = currentStepObj ? currentStepObj.name : (completed === total ? 'Completed' : 'Waiting');

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
                this.$message.warning('Select a pipeline first');
                return;
            }

            this.$confirm('Start this deployment pipeline?', 'Confirm', {
                confirmButtonText: 'Start',
                cancelButtonText: 'Cancel',
                type: 'warning'
            }).then(() => {
                this.isExecuting = true;
                this.startTime = new Date();
                this.currentProcess.status = '执行中';
                this.executionLogs = [];

                this.addLog('info', 'Pipeline started...');
                this.$message.success('Pipeline started');

                // 模拟执行流程
                this.simulateExecution();
            }).catch(() => {
                // cancel
            });
        },
        handleStopProcess() {
            this.$confirm('Stop this pipeline?', 'Confirm', {
                confirmButtonText: 'Stop',
                cancelButtonText: 'Cancel',
                type: 'warning'
            }).then(() => {
                if (this.executionTimer) {
                    clearInterval(this.executionTimer);
                }
                this.isExecuting = false;
                this.currentProcess.status = '已完成';
                this.addLog('warning', 'Pipeline stopped manually');
                this.$message.warning('Pipeline stopped');
            }).catch(() => {
                // cancel
            });
        },
        simulateExecution() {
            let currentStepIndex = 0;
            const steps = this.currentProcess.steps;

            // Reset steps
            steps.forEach(step => {
                step.status = '等待中';
                step.duration = null;
            });

            this.executionTimer = setInterval(() => {
                if (currentStepIndex < steps.length) {
                    const step = steps[currentStepIndex];
                    
                    if (step.status === '等待中') {
                        step.status = '执行中';
                        this.addLog('info', `Starting step: ${step.name}`);
                    } else if (step.status === '执行中') {
                        const isSuccess = Math.random() > 0.1; // 90% success
                        
                        if (isSuccess) {
                            step.status = '已完成';
                            const duration = Math.floor(Math.random() * 5) + 2; 
                            step.duration = `${duration}s`;
                            this.addLog('success', `${step.name} completed (${step.duration})`);
                            currentStepIndex++;
                        } else {
                            step.status = '失败';
                            step.duration = '-';
                            this.addLog('error', `${step.name} failed: Connection timeout`);
                            clearInterval(this.executionTimer);
                            this.isExecuting = false;
                            this.currentProcess.status = '失败';
                            this.$message.error('Pipeline failed');
                        }
                    }
                } else {
                    clearInterval(this.executionTimer);
                    this.isExecuting = false;
                    this.currentProcess.status = '已完成';
                    this.addLog('success', 'Pipeline finished successfully!');
                    this.$message.success('Pipeline finished');
                }
            }, 1000);
        },
        addLog(level, message) {
            const log = {
                time: new Date().toLocaleTimeString(),
                level: level,
                message: message
            };
            this.executionLogs.push(log);

            this.$nextTick(() => {
                if (this.$refs.logsContainer) {
                    this.$refs.logsContainer.scrollTop = this.$refs.logsContainer.scrollHeight;
                }
            });
        },
        handleLogFilterChange() {
            // filter change
        },
        handleClearLogs() {
            this.executionLogs = [];
            this.$message.success('Logs cleared');
        },
        handleRefreshLogs() {
            this.addLog('info', 'Logs refreshed');
            this.$message.success('Logs refreshed');
        },
        handleEditProcess() {
            this.$message.info('Edit not implemented in demo');
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
                            { type: 'manual', name: 'Manual', condition: 'User Triggered', enabled: true }
                        ],
                        steps: [
                            { name: 'Checkout', description: 'Git Fetch', status: '等待中', duration: null },
                            { name: 'Install Deps', description: 'npm install', status: '等待中', duration: null },
                            { name: 'Build', description: 'npm run build', status: '等待中', duration: null },
                            { name: 'Deploy', description: `Deploy to ${this.newProcessForm.environment}`, status: '等待中', duration: null }
                        ]
                    };
                    this.processList.push(newProcess);
                    this.$message.success('Pipeline created');
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
.deployment-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* Hero */
.deploy-hero {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 2rem;
    padding: 2rem;
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%);
    box-shadow: var(--shadow-lg);
    color: white;
    position: relative;
    overflow: hidden;
}

.deploy-hero::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, #a78bfa 0%, transparent 70%);
    opacity: 0.25;
    filter: blur(40px);
    pointer-events: none;
}

.deploy-hero-left {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    position: relative;
    z-index: 1;
}

.deploy-eyebrow {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #bfdbfe;
    font-weight: 600;
}

.deploy-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
}

.deploy-subtitle {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
}

.deploy-hero-right {
    display: flex;
    gap: 1rem;
    position: relative;
    z-index: 1;
}

.glass-btn {
    background: rgba(255, 255, 255, 0.2) !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
    color: white !important;
    backdrop-filter: blur(4px);
}

.glass-btn:hover {
    background: rgba(255, 255, 255, 0.3) !important;
}

.primary-action {
    border-radius: var(--radius-full) !important;
    font-weight: 600;
}

/* Main Content */
.content-wrapper {
    flex: 1;
    display: flex;
    gap: 1.5rem;
    min-height: 0;
}

.config-section {
    flex: 0 0 400px;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
}

.right-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-width: 0;
}

.section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* Config List */
.process-select {
    width: 100%;
}

.config-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
    padding-right: 0.5rem;
}

.process-info {
    padding: 1rem;
    background: rgba(0,0,0,0.02);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.info-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
}

.info-row .label {
    color: var(--text-secondary);
}

.info-row .value {
    color: var(--text-main);
    font-weight: 500;
}

/* Triggers */
.trigger-section, .steps-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.trigger-title, .steps-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.trigger-item {
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0,0,0,0.05);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.trigger-icon {
    width: 32px;
    height: 32px;
    background: rgba(59, 130, 246, 0.1);
    color: var(--color-primary);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
}

.trigger-content {
    flex: 1;
}

.trigger-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-main);
}

.trigger-desc {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

/* Steps */
.step-item {
    position: relative;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.5);
    border-radius: var(--radius-md);
    display: flex;
    gap: 1rem;
    border-left: 3px solid transparent;
    transition: all 0.3s;
}

.step-item.active {
    background: #fff;
    border-left-color: var(--color-primary);
    box-shadow: var(--shadow-md);
}

.step-item.completed {
    border-left-color: #10b981;
}

.step-item.failed {
    border-left-color: #ef4444;
}

.step-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0,0,0,0.1);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
}

.step-item.active .step-number {
    background: var(--color-primary);
    color: white;
}

.step-item.completed .step-number {
    background: #10b981;
    color: white;
}

.step-content {
    flex: 1;
}

.step-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-main);
}

.step-desc {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.step-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.step-meta .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

/* Action Buttons */
.action-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid rgba(0,0,0,0.05);
}

.action-buttons .el-button {
    flex: 1;
}

/* Progress Section */
.progress-section {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.overall-progress {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-main);
}

.progress-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
}

.stat-card {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.5);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.stat-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
}

.stat-icon.total { background: #dbeafe; color: #3b82f6; }
.stat-icon.success { background: #d1fae5; color: #10b981; }
.stat-icon.running { background: #fef3c7; color: #f59e0b; }
.stat-icon.failed { background: #fee2e2; color: #ef4444; }

.stat-content {
    display: flex;
    flex-direction: column;
}

.stat-label { font-size: 0.7rem; color: var(--text-secondary); }
.stat-value { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }

.current-step {
    padding: 1rem;
    background: linear-gradient(to right, rgba(59, 130, 246, 0.1), transparent);
    border-left: 4px solid var(--color-primary);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.current-step-label { font-size: 0.75rem; color: var(--text-secondary); }
.current-step-content { display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: var(--text-main); }
.current-step-content .step-time { font-weight: 400; font-size: 0.8rem; color: var(--text-secondary); }

/* Logs Section */
.logs-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    min-height: 0;
}

.log-filters {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
}

.logs-container {
    flex: 1;
    background: #0f172a; /* Slate 900 */
    border-radius: var(--radius-md);
    padding: 1rem;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.log-item {
    display: flex;
    gap: 1rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.log-item:hover { background: rgba(255,255,255,0.05); }

.log-time { color: #64748b; min-width: 80px; }
.log-level { min-width: 80px; font-weight: 700; display: flex; align-items: center; gap: 0.25rem; }

.log-item.info .log-level { color: #60a5fa; }
.log-item.success .log-level { color: #34d399; }
.log-item.warning .log-level { color: #fbbf24; }
.log-item.error .log-level { color: #f87171; }

.log-message { color: #e2e8f0; word-break: break-all; }

/* Responsive */
@media (max-width: 1200px) {
    .content-wrapper { flex-direction: column; }
    .config-section { flex: none; height: 500px; width: 100%; }
}
</style>