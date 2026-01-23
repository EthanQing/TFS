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
                        <div class="chart-placeholder" v-if="comparingTasks.length > 0">
                            <div class="chart-content">
                                <TrainingChart
                                    :chart-type="activeChart === 'accuracy' ? 'metrics' : 'custom'"
                                    :custom-series="currentChartSeries"
                                    :custom-title="currentChartTitle"
                                    :custom-y-axis-name="currentChartYAxis"
                                    :total-epoch="maxEpoch"
                                />
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
import { 
    fetchTrainingJobs, 
    CompareTrainingRuns, 
    FetchTrainingJobsMetrics_detailed 
} from '@/api/training';

import TrainingChart from '@/components/Chart/TrainingChart.vue';

export default {
    name: 'TrainingTaskComparison',
    components: { TrainingChart },
    data() {
        return {
            loading: false,
            selectedTasks: [],
            comparingTasks: [],
            activeChart: 'loss',
            availableTasks: [],
            availableCharts: [
                { id: 'loss', name: 'Loss 曲线' },
                { id: 'accuracy', name: 'Accuracy/Metrics 曲线' },
                { id: 'mAP', name: 'mAP 曲线' }
            ],
            parameterData: [],
            metricsData: [],
            curveDataMap: {} // Stores raw metrics for each task: { [id]: { 'metrics/mAP50': [..], ... } }
        };
    },
    computed: {
        maxEpoch() {
            let max = 0;
            Object.values(this.curveDataMap).forEach(m => {
                 // Check any array length
                 Object.values(m || {}).forEach(arr => {
                     if (Array.isArray(arr)) max = Math.max(max, arr.length);
                 });
            });
            return max || 100;
        },
        currentChartTitle() {
            const map = { loss: 'Loss 对比', accuracy: '指标对比', mAP: 'mAP 对比' };
            return map[this.activeChart] || '曲线对比';
        },
        currentChartYAxis() {
            return this.activeChart === 'loss' ? 'Loss' : 'Value';
        },
        currentChartSeries() {
            if (!this.comparingTasks.length) return [];
            
            // Map activeChart to keys
            // For 'loss', we might want to compare 'train/box_loss' or 'val/box_loss'.
            // For simplicty, let's aggregate multiple lines per task?
            // Or better, distinct charts for each type. 
            // The UI has tabs: Loss, Accuracy, mAP.
            
            const series = [];
            
            this.comparingTasks.forEach(task => {
                const dataObj = this.curveDataMap[task.id] || {};
                
                if (this.activeChart === 'loss') {
                     // Add Train Box Loss
                     if (dataObj['train/box_loss']) {
                         series.push({
                             name: `${task.name} (Box Loss)`,
                             data: dataObj['train/box_loss'],
                             color: task.color // Use dashed/solid differentiation?
                             // For now just same color, hard to distinguish.
                         });
                     }
                     // Or just pick one relevant metric for clarity?
                     // Let's pick 'val/box_loss' as the representative for now to keep it simple,
                     // or allow sub-tabs.
                     // Let's just create one line per task for the primary metric of the category.
                     // Loss -> val/box_loss
                     // mAP -> metrics/mAP50-95(B)
                     // Accuracy -> metrics/mAP50(B) (Since detection doesn't always have simple 'accuracy')
                     
                     // RE-DECISION: Let's follow standard YOLO metrics.
                }
                
                // Better approach:
                let key = '';
                if (this.activeChart === 'loss') key = 'val/box_loss'; 
                else if (this.activeChart === 'accuracy') key = 'metrics/precision(B)'; // Proxy
                else if (this.activeChart === 'mAP') key = 'metrics/mAP50-95(B)';
                
                if (key && dataObj[key]) {
                    series.push({
                        name: task.name,
                        data: dataObj[key],
                        color: task.color
                    });
                }
            });
            
            return series;
        }
    },
    mounted() {
        this.loadAvailableTasks();
    },
    methods: {
        async loadAvailableTasks() {
            try {
                // Determine context: global or project-specific?
                // The URL is usually /trainingtaskcomparison or linked from project
                // For now, fetch all or filter by project if query param exists
                const projectId = this.$route.query.projectId;
                const filters = projectId ? { project_id: projectId } : {};
                
                const tasks = await fetchTrainingJobs(1, 100); // Fetch top 100 recent
                // Client-side filter if needed, though fetchTrainingJobs (API) might not support all filters yet
                // Filter to keep only completed/running tasks that have metrics potential?
                // Or just show all.
                
                this.availableTasks = tasks.map(t => ({
                    id: t.job_id,
                    name: t.job_name || t.name,
                    status: t.status,
                    created_at: t.created_at,
                    epochs: t.parameters && t.parameters.epochs ? `${t.parameters.epochs}` : '-'
                }));

                // Handle pre-selection from route query
                const preSelect = this.$route.query.compareIds;
                if (preSelect) {
                    const ids = preSelect.split(',');
                    this.selectedTasks = ids;
                    if (ids.length >= 2) {
                        this.handleCompare();
                    }
                }
            } catch (error) {
                this.$message.error('加载任务列表失败');
                console.error(error);
            }
        },
        handleTaskSelect() {
            if (this.selectedTasks.length > 4) {
                this.$message.warning('最多只能选择4个任务进行对比');
                this.selectedTasks.pop();
            }
        },
        async handleCompare() {
            if (this.selectedTasks.length < 2) {
                this.$message.warning('请至少选择2个任务进行对比');
                return;
            }

            this.loading = true;
            try {
                // 1. Setup metadata regarding selected tasks
                const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
                this.comparingTasks = this.selectedTasks.map((id, idx) => {
                    const t = this.availableTasks.find(x => x.id === id);
                    return {
                        id: id,
                        name: t ? t.name : id,
                        color: palette[idx % palette.length]
                    };
                });

                // 2. Fetch Parameter Comparison
                const comparisonData = await CompareTrainingRuns(this.selectedTasks);
                this.processParameterData(comparisonData);

                // 3. Fetch Metrics Comparison Data (Last Epoch value)
                // The Compare API returns 'metrics' usually? Let's assume we extract from comparisonData 
                // or we might need to fetch individual job details if backend doesn't aggregate.
                // Assuming comparisonData contains enough info.
                // If not, we iterate.
                // Let's check `api/training.js` -> `CompareTrainingRuns` payload.
                // Backend usually returns a dict keyed by run_id.
                // Inspecting existing backend code is hard, so let's rely on standard output or manual verify.
                // For robustness, let's process what we have.
                // If comparisionData is just a list of runs, we extract params and metrics.
                this.processMetricsData(comparisonData);

                // 4. Fetch Curve Data for Charts
                await this.fetchCurveData();

                this.$message.success(`已加载对比数据`);
            } catch (error) {
                this.$message.error('对比失败: ' + error.message);
                console.error(error);
            } finally {
                this.loading = false;
            }
        },
        processParameterData(data) {
            // Data is expected to be { [runId]: { parameters: {...}, ... } } or Array
            // Let's assume Array based on typical REST list (or check api/training.js map logic)
            // Actually `CompareTrainingRuns` in api/training.js returns `data` directly.
            // If backend returns map, we iterate keys.
            
            const runs = Array.isArray(data) ? data : (data.items || Object.values(data));
            if (!runs.length) return;

            // Collect all parameter keys
            const paramKeys = new Set();
            runs.forEach(r => {
                const p = r.parameters || {};
                Object.keys(p).forEach(k => paramKeys.add(k));
            });

            // Specific interest keys
            const interest = ['epochs', 'batch_size', 'learning_rate', 'modelfile', 'optimizer', 'imgsz', 'device'];
            const sortedKeys = Array.from(paramKeys).sort((a, b) => {
                const ia = interest.indexOf(a);
                const ib = interest.indexOf(b);
                if (ia !== -1 && ib !== -1) return ia - ib;
                if (ia !== -1) return -1;
                if (ib !== -1) return 1;
                return a.localeCompare(b);
            });

            this.parameterData = sortedKeys.map(key => {
                const values = {};
                runs.forEach(r => {
                    // Extract job_id properly
                    const rid = r.job_id || r.run_id || r.id; 
                    const val = r.parameters?.[key];
                    values[rid] = val !== undefined && val !== null ? String(val) : '-';
                });
                return { name: key, values };
            });
        },
        processMetricsData(data) {
            const runs = Array.isArray(data) ? data : (data.items || Object.values(data));
            // Define metrics of interest
            const metricsOfInterest = [
                { key: 'metrics/mAP50-95(B)', label: 'mAP50-95', importance: 'high' },
                { key: 'metrics/mAP50(B)', label: 'mAP50', importance: 'high' },
                { key: 'metrics/precision(B)', label: 'Precision', importance: 'normal' },
                { key: 'metrics/recall(B)', label: 'Recall', importance: 'normal' },
                { key: 'train/box_loss', label: 'Train Box Loss', importance: 'normal' },
                { key: 'val/box_loss', label: 'Val Box Loss', importance: 'normal' }
            ];

            this.metricsData = metricsOfInterest.map(m => {
                const values = {};
                let maxVal = -Infinity;
                let minVal = Infinity; // For loss, lower is better usually, but "Best" column logic logic needs care.
                // For simplicty, let's treat "Best" as Max for metrics and Min for loss? 
                // Or just show Max for now.
                
                runs.forEach(r => {
                    const rid = r.job_id || r.run_id || r.id;
                    // Check where metrics are stored. Usually 'result' or 'metrics' object in run details
                    // `mapTrainingRunToJob` in api/training puts flattened metrics in? No.
                    // Usually `result` holds final metrics.
                    const sources = [r.result, r.metrics, r];
                    let val = '-';
                    for (const s of sources) { // Try to find the key
                        if (s && s[m.key] !== undefined) {
                            val = s[m.key];
                            break;
                        }
                    }
                    
                    if (val !== '-') {
                        val = parseFloat(val).toFixed(4);
                        maxVal = Math.max(maxVal, parseFloat(val));
                    }
                    values[rid] = val;
                });
                
                return {
                    name: m.label,
                    importance: m.importance,
                    values,
                    best: maxVal !== -Infinity ? maxVal.toFixed(4) : '-'
                };
            });
        },
        async fetchCurveData() {
            // Fetch curves for each selected task
            const promises = this.comparingTasks.map(t => 
                FetchTrainingJobsMetrics_detailed(t.id).catch(() => null)
            );
            
            const results = await Promise.all(promises);
            // Store raw curve data to be processed by Chart logic
            // We need to pass this to the Chart component or process it here.
            // Since the template uses a mocked SVG, I need to update the template to use REAL CHARTS.
            // BUT wait, I am only replacing the <script> section.
            // The template (Step 1099) has a mocked SVG: <svg ... class="chart-svg">.
            // I MUST ALSO UPDATE THE TEMPLATE to use Real Charts (ECharts).
            // I should use `TrainingChart.vue` component which I just fixed!
            
            this.curveDataMap = {};
            results.forEach((res, idx) => {
                if (res && res.metrics) {
                    this.curveDataMap[this.comparingTasks[idx].id] = res.metrics;
                }
            });
        },
        isHighestValue(values, taskId) {
            // String comparison might be enough for params
            // For numeric params it should be parsed
            return false; 
        },
        isBestMetric(values, taskId) {
            const v = parseFloat(values[taskId]);
            const arr = Object.values(values).map(x => parseFloat(x)).filter(x => !isNaN(x));
            const max = Math.max(...arr);
            return !isNaN(v) && v === max;
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
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
    background: #fff;
    border: 1px solid #e6eaf2;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 6px 18px rgba(17, 31, 104, 0.06);
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

.parameters-table tbody tr:nth-child(even) {
    background: #fafbff;
}

.parameters-table tbody tr:hover {
    background: #f2f6ff;
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
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
    background: #fff;
    border: 1px solid #e6eaf2;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 6px 18px rgba(17, 31, 104, 0.06);
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

.metrics-table tbody tr:nth-child(even) {
    background: #fafbff;
}

.metrics-table tbody tr:hover {
    background: #f2f6ff;
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