<template>
    <div class="hyperparameter-container">
        <!-- 顶部标题 -->
        <div class="top">
            <h3>超参数搜索</h3>
            <el-button
                type="primary"
                class="custom-primary-btn"
                @click="dialogFormVisible = true"
                :disabled="isSearching"
            >
                + 新建搜索任务
            </el-button>
        </div>

        <!-- 主内容区域 -->
        <div class="content-wrapper">
            <!-- 左侧：配置搜索参数 -->
            <div class="config-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-setting"></i>
                    配置搜索参数
                </h4>
                
                <div class="config-content">
                    <!-- 搜索策略选择 -->
                    <div class="config-group">
                        <label class="group-label">搜索策略</label>
                        <el-radio-group v-model="searchConfig.strategy" class="radio-group">
                            <el-radio label="grid">网格搜索</el-radio>
                            <el-radio label="random">随机搜索</el-radio>
                            <el-radio label="bayesian">贝叶斯优化</el-radio>
                        </el-radio-group>
                    </div>

                    <!-- 参数范围配置 -->
                    <div class="config-group">
                        <label class="group-label">参数范围</label>
                        <div class="param-items">
                            <div v-for="param in searchConfig.parameters" :key="param.id" class="param-item">
                                <span class="param-name">{{ param.name }}</span>
                                <span class="param-range">{{ param.min }} - {{ param.max }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 搜索空间大小 -->
                    <div class="config-group">
                        <label class="group-label">搜索次数</label>
                        <el-input-number 
                            v-model="searchConfig.iterations" 
                            :min="10" 
                            :max="1000"
                            :step="10"
                            class="input-number"
                        ></el-input-number>
                        <span class="param-description">（最小10次，最大1000次）</span>
                    </div>

                    <!-- 验证集划分 -->
                    <div class="config-group">
                        <label class="group-label">验证集比例</label>
                        <el-slider
                            v-model="searchConfig.valSplit"
                            :min="0.1"
                            :max="0.5"
                            :step="0.05"
                            :format-tooltip="formatTooltip"
                            class="slider"
                        ></el-slider>
                        <span class="param-description">当前：{{ (searchConfig.valSplit * 100).toFixed(0) }}%</span>
                    </div>

                    <!-- 早停配置 -->
                    <div class="config-group">
                        <label class="group-label">早停轮数</label>
                        <el-input-number 
                            v-model="searchConfig.earlyStop" 
                            :min="5" 
                            :max="50"
                            :step="1"
                            class="input-number"
                        ></el-input-number>
                        <span class="param-description">（无改进时停止训练）</span>
                    </div>

                    <!-- 启动按钮 -->
                    <div class="action-buttons">
                        <el-button 
                            type="primary"
                            class="custom-primary-btn"
                            @click="handleStartSearch"
                            :disabled="isSearching"
                            :loading="isSearching"
                        >
                            {{ isSearching ? '搜索中...' : '启动搜索' }}
                        </el-button>
                        <el-button 
                            v-if="isSearching"
                            class="custom-danger-btn"
                            @click="handleStopSearch"
                        >
                            停止搜索
                        </el-button>
                    </div>
                </div>
            </div>

            <!-- 右侧：搜索进度和最优参数 -->
            <div class="right-section">
                <!-- 搜索进度 -->
                <div class="progress-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-s-promotion"></i>
                        搜索进度
                    </h4>
                    
                    <div class="progress-content" v-if="isSearching || searchProgress.completed">
                        <!-- 整体进度 -->
                        <div class="progress-item">
                            <div class="progress-header">
                                <span class="label">整体进度</span>
                                <span class="percentage">{{ searchProgress.percentage }}%</span>
                            </div>
                            <el-progress 
                                :percentage="searchProgress.percentage"
                                :color="progressColor"
                                class="progress-bar"
                            ></el-progress>
                        </div>

                        <!-- 统计信息 -->
                        <div class="stats-grid">
                            <div class="stat-card">
                                <span class="stat-label">已完成</span>
                                <span class="stat-value">{{ searchProgress.completed }}/{{ searchConfig.iterations }}</span>
                            </div>
                            <div class="stat-card">
                                <span class="stat-label">最佳得分</span>
                                <span class="stat-value" style="color: #10b981;">{{ searchProgress.bestScore }}</span>
                            </div>
                            <div class="stat-card">
                                <span class="stat-label">平均得分</span>
                                <span class="stat-value" style="color: #3b82f6;">{{ searchProgress.avgScore }}</span>
                            </div>
                            <div class="stat-card">
                                <span class="stat-label">耗时</span>
                                <span class="stat-value">{{ searchProgress.duration }}</span>
                            </div>
                        </div>

                        <!-- 实时趋势 -->
                        <div class="trend-chart">
                            <div class="chart-title">最优得分趋势</div>
                            <svg viewBox="0 0 500 150" class="trend-svg">
                                <!-- 背景网格 -->
                                <defs>
                                    <pattern id="grid-pattern" width="50" height="15" patternUnits="userSpaceOnUse">
                                        <path d="M 50 0 L 0 0 0 15" fill="none" stroke="#e8ecef" stroke-width="0.5"/>
                                    </pattern>
                                </defs>
                                <rect width="500" height="150" fill="url(#grid-pattern)" />
                                
                                <!-- Y轴标签 -->
                                <text x="15" y="15" font-size="11" fill="#8e9aaf">1.0</text>
                                <text x="15" y="80" font-size="11" fill="#8e9aaf">0.5</text>
                                <text x="15" y="145" font-size="11" fill="#8e9aaf">0.0</text>

                                <!-- 趋势线 -->
                                <polyline
                                    points="40,130 80,110 120,95 160,75 200,65 240,55 280,50 320,48 360,45 400,42 440,40 480,38"
                                    fill="none"
                                    stroke="#111f68"
                                    stroke-width="2"
                                />
                                
                                <!-- 数据点 -->
                                <circle cx="40" cy="130" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="80" cy="110" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="120" cy="95" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="160" cy="75" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="200" cy="65" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="240" cy="55" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="280" cy="50" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="320" cy="48" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="360" cy="45" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="400" cy="42" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="440" cy="40" r="3" fill="#111f68" opacity="0.6"/>
                                <circle cx="480" cy="38" r="3" fill="#111f68" opacity="0.6"/>

                                <!-- 坐标轴 -->
                                <line x1="35" y1="140" x2="485" y2="140" stroke="#111f68" stroke-width="1.5"/>
                                <line x1="35" y1="10" x2="35" y2="140" stroke="#111f68" stroke-width="1.5"/>

                                <!-- 轴标签 -->
                                <text x="250" y="155" text-anchor="middle" font-size="11" fill="#111f68">迭代次数</text>
                                <text x="10" y="75" text-anchor="middle" font-size="11" fill="#111f68" transform="rotate(-90 10 75)">得分</text>
                            </svg>
                        </div>
                    </div>

                    <div class="empty-state" v-else>
                        <i class="el-icon-s-promotion"></i>
                        <p>点击"启动搜索"开始超参数优化</p>
                    </div>
                </div>

                <!-- 推荐最优参数 -->
                <div class="best-params-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-star-on"></i>
                        推荐最优参数
                    </h4>
                    
                    <div class="best-params-content" v-if="bestParameters">
                        <!-- 综合得分 -->
                        <div class="score-card">
                            <div class="score-display">
                                <span class="score-label">最优得分</span>
                                <span class="score-value">{{ bestParameters.score }}</span>
                            </div>
                            <div class="score-info">
                                <div class="info-item">
                                    <span class="label">mAP:</span>
                                    <span class="value">{{ bestParameters.metrics.mAP }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">准确率:</span>
                                    <span class="value">{{ bestParameters.metrics.accuracy }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">F1-Score:</span>
                                    <span class="value">{{ bestParameters.metrics.f1Score }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- 参数详情 -->
                        <div class="params-table">
                            <div v-for="(value, key) in bestParameters.params" :key="key" class="param-row">
                                <span class="param-key">{{ formatParamName(key) }}</span>
                                <span class="param-value">{{ value }}</span>
                            </div>
                        </div>

                        <!-- 操作按钮 -->
                        <div class="action-buttons">
                            <el-button 
                                type="primary"
                                class="custom-primary-btn"
                                @click="handleApplyParams"
                            >
                                应用这些参数
                            </el-button>
                            <el-button 
                                class="custom-default-btn"
                                @click="handleExportParams"
                            >
                                导出参数
                            </el-button>
                        </div>
                    </div>

                    <div class="empty-state" v-else>
                        <i class="el-icon-star-on"></i>
                        <p>暂无最优参数推荐</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 新建搜索任务对话框 -->
        <el-dialog title="新建搜索任务" :visible.sync="dialogFormVisible" width="600px">
            <el-form :model="newTaskForm" :rules="rules" ref="formRef">
                <el-form-item label="任务名称" label-width="100px" prop="taskName">
                    <el-input 
                        v-model="newTaskForm.taskName" 
                        placeholder="例如: 超参搜索任务1"
                        autocomplete="off"
                    ></el-input>
                </el-form-item>
                <el-form-item label="选择数据集" label-width="100px" prop="dataset">
                    <el-select 
                        v-model="newTaskForm.dataset" 
                        placeholder="请选择数据集"
                        clearable
                    >
                        <el-option label="数据集A" value="datasetA"></el-option>
                        <el-option label="数据集B" value="datasetB"></el-option>
                        <el-option label="数据集C" value="datasetC"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="选择模型" label-width="100px" prop="model">
                    <el-select 
                        v-model="newTaskForm.model" 
                        placeholder="请选择模型"
                        clearable
                    >
                        <el-option label="YOLOv8" value="yolov8"></el-option>
                        <el-option label="YOLOv7" value="yolov7"></el-option>
                        <el-option label="Faster R-CNN" value="fasterrcnn"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="任务描述" label-width="100px" prop="description">
                    <el-input 
                        v-model="newTaskForm.description" 
                        type="textarea"
                        rows="3"
                        placeholder="描述搜索的目标和期望"
                        autocomplete="off"
                    ></el-input>
                </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
                <el-button @click="dialogFormVisible = false">取 消</el-button>
                <el-button type="primary" @click="handleCreateTask">创 建</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
export default {
    name: 'Hyperparameter',
    data() {
        return {
            isSearching: false,
            dialogFormVisible: false,
            searchConfig: {
                strategy: 'bayesian',
                iterations: 100,
                valSplit: 0.2,
                earlyStop: 10,
                parameters: [
                    { id: 1, name: '学习率 (lr)', min: '0.0001', max: '0.01' },
                    { id: 2, name: '批大小 (batch_size)', min: '16', max: '128' },
                    { id: 3, name: '动量 (momentum)', min: '0.8', max: '0.99' },
                    { id: 4, name: '权重衰减 (weight_decay)', min: '0.0', max: '0.001' },
                    { id: 5, name: '热身轮数 (warmup_epochs)', min: '0', max: '10' }
                ]
            },
            searchProgress: {
                percentage: 0,
                completed: 0,
                bestScore: 0.850,
                avgScore: 0.758,
                duration: '0h 0m'
            },
            bestParameters: {
                score: 0.8947,
                metrics: {
                    mAP: '0.8752',
                    accuracy: '94.2%',
                    f1Score: '0.8921'
                },
                params: {
                    lr: '0.0015',
                    batch_size: '64',
                    momentum: '0.937',
                    weight_decay: '0.0005',
                    warmup_epochs: '3',
                    img_size: '640',
                    epochs: '100'
                }
            },
            newTaskForm: {
                taskName: '',
                dataset: '',
                model: '',
                description: ''
            },
            rules: {
                taskName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
                dataset: [{ required: true, message: '请选择数据集', trigger: 'change' }],
                model: [{ required: true, message: '请选择模型', trigger: 'change' }],
                description: [{ required: true, message: '请输入任务描述', trigger: 'blur' }]
            },
            searchTimer: null
        };
    },
    computed: {
        progressColor() {
            const percentage = this.searchProgress.percentage;
            if (percentage < 33) return '#3b82f6';
            if (percentage < 66) return '#f59e0b';
            return '#10b981';
        }
    },
    methods: {
        formatTooltip(value) {
            return `${(value * 100).toFixed(0)}%`;
        },
        handleStartSearch() {
            this.$message.success('超参数搜索已启动！');
            this.isSearching = true;
            this.searchProgress.completed = 0;
            this.searchProgress.percentage = 0;
            
            // 模拟搜索进度
            this.searchTimer = setInterval(() => {
                if (this.searchProgress.completed < this.searchConfig.iterations) {
                    this.searchProgress.completed++;
                    this.searchProgress.percentage = Math.floor(
                        (this.searchProgress.completed / this.searchConfig.iterations) * 100
                    );
                    
                    // 模拟分数变化
                    this.searchProgress.bestScore = Math.min(
                        0.95,
                        0.75 + (this.searchProgress.completed / this.searchConfig.iterations) * 0.2
                    ).toFixed(4);
                    
                    this.searchProgress.avgScore = (
                        0.70 + Math.random() * 0.1
                    ).toFixed(4);
                    
                    // 更新耗时
                    const minutes = Math.floor(this.searchProgress.completed / 10);
                    this.searchProgress.duration = `0h ${minutes}m`;
                } else {
                    clearInterval(this.searchTimer);
                    this.isSearching = false;
                    this.$message.success('搜索完成！已找到最优参数');
                }
            }, 500);
        },
        handleStopSearch() {
            this.$confirm('确认停止搜索吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                clearInterval(this.searchTimer);
                this.isSearching = false;
                this.$message.info('搜索已停止');
            });
        },
        handleApplyParams() {
            this.$message.success('最优参数已应用到新的训练任务');
        },
        handleExportParams() {
            const paramStr = JSON.stringify(this.bestParameters.params, null, 2);
            const blob = new Blob([paramStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `best_hyperparameters_${new Date().getTime()}.json`;
            link.click();
            this.$message.success('参数已导出');
        },
        formatParamName(name) {
            const nameMap = {
                'lr': '学习率',
                'batch_size': '批大小',
                'momentum': '动量',
                'weight_decay': '权重衰减',
                'warmup_epochs': '热身轮数',
                'img_size': '图像大小',
                'epochs': '训练轮数'
            };
            return nameMap[name] || name;
        },
        handleCreateTask() {
            this.$refs.formRef.validate(valid => {
                if (valid) {
                    this.$message.success(`任务 "${this.newTaskForm.taskName}" 已创建`);
                    this.dialogFormVisible = false;
                    this.$refs.formRef.resetFields();
                }
            });
        }
    },
    beforeDestroy() {
        if (this.searchTimer) {
            clearInterval(this.searchTimer);
        }
    }
};
</script>

<style scoped>
.hyperparameter-container {
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

/* 主内容区域 */
.content-wrapper {
    display: flex;
    gap: 20px;
    width: 100%;
    height: calc(100vh - 150px);
}

/* 左侧：配置搜索参数 */
.config-section {
    flex: 0 0 35%;
    max-width: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

/* 右侧：进度和最优参数 */
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

/* 配置内容 */
.config-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    overflow-y: auto;
}

.config-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.group-label {
    font-size: 16px;
    font-weight: 500;
    color: #111f68;
    margin-bottom: 5px;
}

.radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.radio-group .el-radio {
    font-size: 13px;
}

.param-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.param-item {
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #e8ecef;
}

.param-name {
    font-size: 13px;
    color: #111f68;
    font-weight: 500;
}

.param-range {
    font-size: 12px;
    color: #8e9aaf;
}

.input-number {
    width: 100%;
}

.slider {
    width: 100%;
}

.param-description {
    font-size: 12px;
    color: #8e9aaf;
    display: block;
    margin-top: 4px;
}

.action-buttons {
    display: flex;
    gap: 10px;
    flex-direction: column;
}

.action-buttons .el-button {
    width: 100%;
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
    cursor: not-allowed !important;
}

.custom-default-btn {
    background-color: #ffffff !important;
    border-color: #111f68 !important;
    color: #111f68 !important;
    margin-left: 0px;
}

.custom-default-btn:hover {
    background-color: #f0f3f9 !important;
}

.custom-danger-btn {
    background-color: #f43f5e !important;
    border-color: #f43f5e !important;
    color: #fff !important;
}

.custom-danger-btn:hover {
    background-color: #e11d48 !important;
    border-color: #e11d48 !important;
}

/* 搜索进度 */
.progress-section {
    flex: 0 0 auto;
    min-height: 0;
    max-height: 50%;
    overflow-y: auto;
}

.progress-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.progress-item {
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

.progress-bar {
    width: 100%;
}

/* 统计信息 */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.stat-card {
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e8ecef;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.stat-label {
    font-size: 12px;
    color: #8e9aaf;
}

.stat-value {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

/* 趋势图 */
.trend-chart {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
}

.chart-title {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
}

.trend-svg {
    width: 100%;
    height: 180px;
}

/* 最优参数 */
.best-params-section {
    flex: 0 0 auto;
    min-height: 0;
    max-height: 50%;
    overflow-y: auto;
}

.best-params-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.score-card {
    padding: 16px;
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%);
    border-radius: 8px;
    color: #fff;
    display: flex;
    gap: 16px;
}

.score-display {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 0 0 100px;
}

.score-label {
    font-size: 12px;
    opacity: 0.9;
}

.score-value {
    font-size: 24px;
    font-weight: 700;
}

.score-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
}

.info-item {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
}

.info-item .label {
    opacity: 0.9;
}

.info-item .value {
    font-weight: 600;
}

.params-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.param-row {
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #e8ecef;
}

.param-key {
    font-size: 13px;
    color: #111f68;
    font-weight: 500;
}

.param-value {
    font-size: 13px;
    color: #6c757d;
    font-family: monospace;
    background-color: #ffffff;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #e8ecef;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    color: #8e9aaf;
    font-size: 14px;
}

.empty-state i {
    font-size: 32px;
    color: #d5d5d5;
}

/* 对话框样式 */
.el-dialog {
    width: 600px !important;
}

.dialog-footer {
    padding: 10px 20px !important;
}

/* 滚动条样式 */
.config-content::-webkit-scrollbar,
.config-section::-webkit-scrollbar,
.right-section::-webkit-scrollbar {
    width: 6px;
}

.config-content::-webkit-scrollbar-track,
.config-section::-webkit-scrollbar-track,
.right-section::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.config-content::-webkit-scrollbar-thumb,
.config-section::-webkit-scrollbar-thumb,
.right-section::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.config-content::-webkit-scrollbar-thumb:hover,
.config-section::-webkit-scrollbar-thumb:hover,
.right-section::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
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
        max-height: 400px;
    }

    .right-section {
        flex: 1;
    }

    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 1024px) {
    .hyperparameter-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .stats-grid {
        grid-template-columns: 1fr;
    }

    .score-card {
        flex-direction: column;
    }

    .score-display {
        flex: 0 0 auto;
    }
}
</style>