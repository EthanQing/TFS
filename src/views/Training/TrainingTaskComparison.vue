<template>
    <div class="compare-container">
        <!-- 顶部标题和选择区域 -->
        <div class="top">
            <h3>训练任务对比</h3>
        </div>

        <!-- 对比任务选择区域 -->
        <div class="compare-selector">
            <div class="selector-group">
                <label>选择任务进行对比：</label>
                <el-select
                    v-model="selectedTasks"
                    multiple
                    placeholder="请选择2-4个任务"
                    class="task-select"
                    @change="handleTaskSelect"
                    :collapse-tags="true"
                >
                    <el-option
                        v-for="task in availableTasks"
                        :key="task.id"
                        :label="task.name"
                        :value="task.id"
                    >
                    </el-option>
                </el-select>
                <el-button 
                    type="primary"
                    class="custom-primary-btn"
                    @click="handleCompare"
                    :disabled="selectedTasks.length < 2"
                >
                    开始对比
                </el-button>
            </div>
        </div>

        <!-- 对比内容区域 -->
        <div class="compare-content" v-if="comparingTasks.length > 0">
            <!-- 参数对比表 -->
            <div class="compare-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-document-copy"></i>
                    参数对比表
                </h4>
                <div class="parameters-table">
                    <table>
                        <thead>
                            <tr>
                                <th class="param-col">参数名称</th>
                                <th v-for="task in comparingTasks" :key="task.id" class="task-col">
                                    <span class="task-badge" :style="{ backgroundColor: task.color }">{{ task.name }}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(param, index) in parameterData" :key="index">
                                <td class="param-name">{{ param.name }}</td>
                                <td v-for="task in comparingTasks" :key="task.id" class="param-value">
                                    <span :class="{ 'highlight': isHighestValue(param.values, task.id) }">
                                        {{ param.values[task.id] }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 指标对比表 -->
            <div class="compare-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-data-analysis"></i>
                    指标对比表
                </h4>
                <div class="metrics-table">
                    <table>
                        <thead>
                            <tr>
                                <th class="metric-col">评估指标</th>
                                <th v-for="task in comparingTasks" :key="task.id" class="task-col">
                                    <span class="task-badge" :style="{ backgroundColor: task.color }">{{ task.name }}</span>
                                </th>
                                <th class="best-col">最优值</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(metric, index) in metricsData" :key="index" :class="{ 'high-importance': metric.importance === 'high' }">
                                <td class="metric-name">
                                    <span class="metric-label">{{ metric.name }}</span>
                                    <span v-if="metric.importance === 'high'" class="importance-badge">重要</span>
                                </td>
                                <td v-for="task in comparingTasks" :key="task.id" class="metric-value">
                                    <span :class="{ 'best-metric': isBestMetric(metric.values, task.id) }">
                                        {{ metric.values[task.id] }}
                                    </span>
                                </td>
                                <td class="best-value">
                                    <strong>{{ metric.best }}</strong>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 曲线对比图 -->
            <div class="compare-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-s-line"></i>
                    曲线对比图
                </h4>
                <div class="charts-container">
                    <!-- 选项卡切换不同指标的曲线 -->
                    <div class="chart-tabs">
                        <div 
                            v-for="chart in availableCharts" 
                            :key="chart.id"
                            :class="['chart-tab', { 'active': activeChart === chart.id }]"
                            @click="activeChart = chart.id"
                        >
                            {{ chart.name }}
                        </div>
                    </div>

                    <!-- 图表显示区域 -->
                    <div class="chart-display">
                        <div class="chart-placeholder">
                            <div class="chart-content">
                                <!-- 模拟的曲线图 -->
                                <svg viewBox="0 0 600 300" class="chart-svg">
                                    <!-- 背景网格 -->
                                    <defs>
                                        <pattern id="grid" width="50" height="30" patternUnits="userSpaceOnUse">
                                            <path d="M 50 0 L 0 0 0 30" fill="none" stroke="#e8ecef" stroke-width="0.5"/>
                                        </pattern>
                                    </defs>
                                    <rect width="600" height="300" fill="url(#grid)" />

                                    <!-- Y轴标签 -->
                                    <text x="35" y="20" font-size="12" fill="#8e9aaf">100%</text>
                                    <text x="35" y="155" font-size="12" fill="#8e9aaf">50%</text>
                                    <text x="42" y="290" font-size="12" fill="#8e9aaf">0%</text>

                                    <!-- 曲线1 -->
                                    <polyline
                                        points="60,240 120,200 180,160 240,130 300,110 360,95 420,85 480,82 540,85"
                                        fill="none"
                                        stroke="#3b82f6"
                                        stroke-width="2"
                                    />
                                    <!-- 曲线1的点 -->
                                    <circle cx="60" cy="240" r="4" fill="#3b82f6" opacity="0.8"/>
                                    <circle cx="120" cy="200" r="4" fill="#3b82f6" opacity="0.8"/>
                                    <circle cx="180" cy="160" r="4" fill="#3b82f6" opacity="0.8"/>
                                    <circle cx="240" cy="130" r="4" fill="#3b82f6" opacity="0.8"/>
                                    <circle cx="300" cy="110" r="4" fill="#3b82f6" opacity="0.8"/>
                                    <circle cx="360" cy="95" r="4" fill="#3b82f6" opacity="0.8"/>
                                    <circle cx="420" cy="85" r="4" fill="#3b82f6" opacity="0.8"/>
                                    <circle cx="480" cy="82" r="4" fill="#3b82f6" opacity="0.8"/>
                                    <circle cx="540" cy="85" r="4" fill="#3b82f6" opacity="0.8"/>

                                    <!-- 曲线2 -->
                                    <polyline
                                        points="60,260 120,225 180,185 240,155 300,135 360,120 420,110 480,105 540,108"
                                        fill="none"
                                        stroke="#10b981"
                                        stroke-width="2"
                                    />
                                    <!-- 曲线2的点 -->
                                    <circle cx="60" cy="260" r="4" fill="#10b981" opacity="0.8"/>
                                    <circle cx="120" cy="225" r="4" fill="#10b981" opacity="0.8"/>
                                    <circle cx="180" cy="185" r="4" fill="#10b981" opacity="0.8"/>
                                    <circle cx="240" cy="155" r="4" fill="#10b981" opacity="0.8"/>
                                    <circle cx="300" cy="135" r="4" fill="#10b981" opacity="0.8"/>
                                    <circle cx="360" cy="120" r="4" fill="#10b981" opacity="0.8"/>
                                    <circle cx="420" cy="110" r="4" fill="#10b981" opacity="0.8"/>
                                    <circle cx="480" cy="105" r="4" fill="#10b981" opacity="0.8"/>
                                    <circle cx="540" cy="108" r="4" fill="#10b981" opacity="0.8"/>

                                    <!-- 曲线3 -->
                                    <polyline
                                        points="60,270 120,235 180,200 240,170 300,150 360,135 420,125 480,120 540,125"
                                        fill="none"
                                        stroke="#f59e0b"
                                        stroke-width="2"
                                    />
                                    <!-- 曲线3的点 -->
                                    <circle cx="60" cy="270" r="4" fill="#f59e0b" opacity="0.8"/>
                                    <circle cx="120" cy="235" r="4" fill="#f59e0b" opacity="0.8"/>
                                    <circle cx="180" cy="200" r="4" fill="#f59e0b" opacity="0.8"/>
                                    <circle cx="240" cy="170" r="4" fill="#f59e0b" opacity="0.8"/>
                                    <circle cx="300" cy="150" r="4" fill="#f59e0b" opacity="0.8"/>
                                    <circle cx="360" cy="135" r="4" fill="#f59e0b" opacity="0.8"/>
                                    <circle cx="420" cy="125" r="4" fill="#f59e0b" opacity="0.8"/>
                                    <circle cx="480" cy="120" r="4" fill="#f59e0b" opacity="0.8"/>
                                    <circle cx="540" cy="125" r="4" fill="#f59e0b" opacity="0.8"/>

                                    <!-- X轴 -->
                                    <line x1="50" y1="280" x2="580" y2="280" stroke="#111f68" stroke-width="1.5"/>
                                    <!-- Y轴 -->
                                    <line x1="50" y1="10" x2="50" y2="280" stroke="#111f68" stroke-width="1.5"/>

                                    <!-- 轴标签 -->
                                    <text x="300" y="295" text-anchor="middle" font-size="12" fill="#111f68">Epoch</text>
                                    <text x="15" y="150" text-anchor="middle" font-size="12" fill="#111f68" transform="rotate(-90 15 150)">{{ activeChart === 'loss' ? 'Loss' : activeChart === 'accuracy' ? 'Accuracy' : 'mAP' }}</text>
                                </svg>
                            </div>
                        </div>

                        <!-- 图表图例 -->
                        <div class="chart-legend">
                            <div v-for="task in comparingTasks" :key="task.id" class="legend-item">
                                <span class="legend-color" :style="{ backgroundColor: task.color }"></span>
                                <span class="legend-label">{{ task.name }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 空状态提示 -->
        <div class="empty-state" v-else>
            <div class="empty-content">
                <i class="el-icon-document-copy"></i>
                <p>请选择至少2个任务开始对比</p>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'TrainingTaskComparison',
    data() {
        return {
            selectedTasks: [],
            comparingTasks: [],
            activeChart: 'loss',
            availableTasks: [
                { id: 1, name: '训练任务1', color: '#3b82f6' },
                { id: 2, name: '训练任务2', color: '#10b981' },
                { id: 3, name: '训练任务3', color: '#f59e0b' },
                { id: 4, name: '训练任务4', color: '#ef4444' },
                { id: 5, name: '训练任务5', color: '#8b5cf6' },
                { id: 6, name: '训练任务6', color: '#06b6d4' }
            ],
            availableCharts: [
                { id: 'loss', name: 'Loss 曲线' },
                { id: 'accuracy', name: 'Accuracy 曲线' },
                { id: 'mAP', name: 'mAP 曲线' }
            ],
            parameterData: [
                {
                    name: '批大小',
                    values: { 1: '32', 2: '32', 3: '64', 4: '32' }
                },
                {
                    name: '学习率',
                    values: { 1: '0.001', 2: '0.0001', 3: '0.001', 4: '0.0005' }
                },
                {
                    name: '优化器',
                    values: { 1: 'Adam', 2: 'SGD', 3: 'Adam', 4: 'Adam' }
                },
                {
                    name: '正则化',
                    values: { 1: 'L2', 2: 'L1', 3: 'L2', 4: 'Dropout' }
                },
                {
                    name: '训练轮数',
                    values: { 1: '100', 2: '150', 3: '100', 4: '200' }
                },
                {
                    name: '数据增强',
                    values: { 1: '启用', 2: '启用', 3: '禁用', 4: '启用' }
                },
                {
                    name: '预训练权重',
                    values: { 1: 'ImageNet', 2: 'COCO', 3: 'ImageNet', 4: 'ImageNet' }
                }
            ],
            metricsData: [
                {
                    name: 'mAP',
                    importance: 'high',
                    values: { 1: '0.875', 2: '0.852', 3: '0.865', 4: '0.880' },
                    best: '0.880'
                },
                {
                    name: '准确率 (Accuracy)',
                    importance: 'high',
                    values: { 1: '94.2%', 2: '92.8%', 3: '93.5%', 4: '95.1%' },
                    best: '95.1%'
                },
                {
                    name: '精确率 (Precision)',
                    importance: 'high',
                    values: { 1: '92.5%', 2: '90.3%', 3: '91.8%', 4: '93.2%' },
                    best: '93.2%'
                },
                {
                    name: '召回率 (Recall)',
                    importance: 'high',
                    values: { 1: '91.8%', 2: '93.2%', 3: '92.5%', 4: '94.2%' },
                    best: '94.2%'
                },
                {
                    name: 'F1-Score',
                    importance: 'high',
                    values: { 1: '0.921', 2: '0.918', 3: '0.920', 4: '0.936' },
                    best: '0.936'
                },
                {
                    name: '训练损失',
                    importance: 'normal',
                    values: { 1: '0.152', 2: '0.168', 3: '0.145', 4: '0.138' },
                    best: '0.138'
                },
                {
                    name: '验证损失',
                    importance: 'normal',
                    values: { 1: '0.185', 2: '0.198', 3: '0.175', 4: '0.162' },
                    best: '0.162'
                },
                {
                    name: '推理速度 (ms)',
                    importance: 'normal',
                    values: { 1: '38', 2: '42', 3: '40', 4: '35' },
                    best: '35'
                }
            ]
        };
    },
    methods: {
        handleTaskSelect() {
            if (this.selectedTasks.length > 4) {
                this.$message.warning('最多只能选择4个任务进行对比');
                this.selectedTasks.pop();
            }
        },
        handleCompare() {
            if (this.selectedTasks.length < 2) {
                this.$message.warning('请至少选择2个任务进行对比');
                return;
            }
            this.comparingTasks = this.availableTasks.filter(task => 
                this.selectedTasks.includes(task.id)
            );
            this.$message.success(`已选择${this.comparingTasks.length}个任务进行对比`);
        },
        isHighestValue(values, taskId) {
            // 检查是否是最高值（用于参数对比）
            const currentValue = parseFloat(values[taskId]);
            const maxValue = Math.max(...Object.values(values).map(v => parseFloat(v)));
            return currentValue === maxValue;
        },
        isBestMetric(values, taskId) {
            // 检查是否是最好的指标（用于指标对比）
            const currentValue = parseFloat(values[taskId]);
            const maxValue = Math.max(...Object.values(values).map(v => parseFloat(v)));
            return currentValue === maxValue;
        }
    }
};
</script>

<style scoped>
.compare-container {
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

/* 对比任务选择区域 */
.compare-selector {
    background: #ffffff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #e8ecef;
    margin-bottom: 20px;
}

.selector-group {
    display: flex;
    align-items: center;
    gap: 15px;
}

.selector-group label {
    font-size: 14px;
    font-weight: 500;
    color: #111f68;
    min-width: 120px;
}

.task-select {
    flex: 1;
    max-width: 400px;
}

.custom-primary-btn {
    background-color: #111f68 !important;
    border-color: #111f68 !important;
    color: #fff !important;
    border-radius: 6px !important;
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

/* 对比内容区域 */
.compare-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* 通用卡片样式 */
.section-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #e8ecef;
}

.compare-section {
    display: flex;
    flex-direction: column;
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

/* 参数对比表 */
.parameters-table {
    width: 100%;
    overflow-x: auto;
}

.parameters-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.parameters-table th {
    background-color: #f9fafb;
    color: #111f68;
    font-weight: 600;
    padding: 12px;
    text-align: left;
    border-bottom: 2px solid #e8ecef;
}

.parameters-table td {
    padding: 12px;
    border-bottom: 1px solid #e8ecef;
    color: #4a5568;
}

.parameters-table .param-col {
    width: 150px;
    min-width: 150px;
}

.parameters-table .task-col {
    text-align: center;
    width: auto;
    min-width: 120px;
}

.parameters-table .param-name {
    font-weight: 500;
    color: #111f68;
}

.parameters-table .param-value {
    text-align: center;
}

.parameters-table .param-value .highlight {
    background-color: #fef3c7;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    color: #d97706;
}

.task-badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 6px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
}

/* 指标对比表 */
.metrics-table {
    width: 100%;
    overflow-x: auto;
}

.metrics-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.metrics-table th {
    background-color: #f9fafb;
    color: #111f68;
    font-weight: 600;
    padding: 12px;
    text-align: left;
    border-bottom: 2px solid #e8ecef;
}

.metrics-table td {
    padding: 12px;
    border-bottom: 1px solid #e8ecef;
    color: #4a5568;
}

.metrics-table .metric-col {
    width: 150px;
    min-width: 150px;
}

.metrics-table .task-col {
    text-align: center;
    width: auto;
    min-width: 120px;
}

.metrics-table .best-col {
    text-align: center;
    width: 100px;
    min-width: 100px;
}

.metrics-table .metric-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: #111f68;
}

.metrics-table .metric-label {
    flex: 1;
}

.importance-badge {
    display: inline-block;
    background-color: #fee2e2;
    color: #dc2626;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}

.metrics-table tr.high-importance {
    background-color: #fffbeb;
}

.metrics-table .metric-value {
    text-align: center;
}

.metrics-table .metric-value .best-metric {
    background-color: #d1fae5;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    color: #047857;
}

.metrics-table .best-value {
    text-align: center;
    font-weight: 600;
    color: #111f68;
}

/* 曲线对比图 */
.charts-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.chart-tabs {
    display: flex;
    gap: 12px;
    border-bottom: 2px solid #e8ecef;
    padding-bottom: 8px;
}

.chart-tab {
    padding: 8px 16px;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #6c757d;
    transition: all 0.3s ease;
    background-color: #f9fafb;
    border: 1px solid #e8ecef;
    border-bottom: none;
}

.chart-tab:hover {
    background-color: #f0f3f9;
    color: #111f68;
}

.chart-tab.active {
    background-color: #111f68;
    color: #ffffff;
    border-color: #111f68;
}

.chart-display {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.chart-placeholder {
    background-color: #f9fafb;
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #e8ecef;
}

.chart-content {
    width: 100%;
    background-color: #ffffff;
    border-radius: 6px;
    padding: 16px;
}

.chart-svg {
    width: 100%;
    height: 350px;
}

.chart-legend {
    display: flex;
    gap: 24px;
    justify-content: center;
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 6px;
    flex-wrap: wrap;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #4a5568;
}

.legend-color {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
}

.legend-label {
    font-weight: 500;
}

/* 空状态 */
.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 400px;
    margin-top: 40px;
}

.empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: #8e9aaf;
    font-size: 16px;
}

.empty-content i {
    font-size: 48px;
    color: #d5d5d5;
}

.empty-content p {
    margin: 0;
}

/* 响应式设计 */
@media (max-width: 1200px) {
    .compare-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .selector-group {
        flex-direction: column;
        align-items: flex-start;
    }

    .selector-group label {
        width: 100%;
    }

    .task-select {
        width: 100%;
        max-width: none;
    }

    .parameters-table,
    .metrics-table {
        font-size: 12px;
    }

    .parameters-table th,
    .parameters-table td,
    .metrics-table th,
    .metrics-table td {
        padding: 10px 8px;
    }
}

@media (max-width: 992px) {
    .chart-tabs {
        flex-wrap: wrap;
    }

    .chart-svg {
        height: 250px;
    }
}
</style>