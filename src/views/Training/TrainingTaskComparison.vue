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
                        :disabled="isTaskOptionDisabled(task)"
                    >
                        <div class="task-option-row">
                            <span class="task-option-name">{{ task.name }}</span>
                            <el-tag size="mini" effect="plain">{{ task.frameworkLabel }}</el-tag>
                        </div>
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
                <el-button
                    type="primary"
                    plain
                    class="custom-primary-btn"
                    :loading="exporting"
                    :disabled="!canExport"
                    @click="handleExportCompare"
                >
                    导出对比结果
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
                                    <span :class="{ 'best-metric': isBestMetric(metric, task.id) }">
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
import { resolveFramework } from '@/utils/trainingFramework';
import { buildWorkbook, downloadWorkbook } from '@/utils/trainingCompareExport';

import TrainingChart from '@/components/Chart/TrainingChart.vue';

export default {
    name: 'TrainingTaskComparison',
    components: { TrainingChart },
    data() {
        return {
            loading: false,
            exporting: false,
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
        canExport() {
            if (!this.comparingTasks.length) return false;
            return this.parameterData.length > 0 || this.metricsData.length > 0 || Object.keys(this.curveDataMap || {}).length > 0;
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
            const series = [];
            
            this.comparingTasks.forEach(task => {
                const dataObj = this.curveDataMap[task.id] || {};
                const candidates = this.chartCandidates(task.frameworkKey, this.activeChart);
                const picked = this.pickFirstSeries(dataObj, candidates);
                if (picked) {
                    series.push({
                        name: task.name,
                        data: picked.data,
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
        findTaskById(taskId) {
            const key = String(taskId ?? '');
            return this.availableTasks.find(t => String(t.id) === key) || null;
        },
        extractCompareRuns(data) {
            if (Array.isArray(data)) return data;
            if (Array.isArray(data?.runs)) return data.runs;
            if (Array.isArray(data?.items)) return data.items;
            return [];
        },
        validateFrameworkSelection(ids = []) {
            const picked = (Array.isArray(ids) ? ids : [])
                .map(id => this.findTaskById(id))
                .filter(Boolean);
            if (picked.length < 2) return { ok: true };
            const groups = {};
            picked.forEach(task => {
                const key = task.frameworkKey || 'engine:unknown';
                if (!groups[key]) groups[key] = [];
                groups[key].push(task.id);
            });
            const keys = Object.keys(groups);
            if (keys.length <= 1) return { ok: true };
            const labels = keys
                .map(k => this.availableTasks.find(t => t.frameworkKey === k)?.frameworkLabel || k)
                .join(' / ');
            return {
                ok: false,
                message: `Paddle 与 PyTorch 模型的指标不同，无法进行对比。当前选择包含：${labels}`,
                groups,
            };
        },
        getLockedFrameworkKey() {
            if (!this.selectedTasks.length) return null;
            const first = this.findTaskById(this.selectedTasks[0]);
            return first?.frameworkKey || null;
        },
        isTaskOptionDisabled(task) {
            if (!task) return false;
            if (this.selectedTasks.includes(task.id)) return false;
            const lockKey = this.getLockedFrameworkKey();
            if (!lockKey) return false;
            return task.frameworkKey !== lockKey;
        },
        buildTimestampToken() {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        },
        buildExportFilename(prefix, frameworkLabel) {
            const fw = String(frameworkLabel || 'mixed')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '') || 'mixed';
            return `${prefix}_${fw}_${this.buildTimestampToken()}.xlsx`;
        },
        mapComparingRunsForExport() {
            return this.comparingTasks.map((task) => {
                const meta = this.findTaskById(task.id) || {};
                const resolved = resolveFramework(meta.engine);
                return {
                    runId: task.id,
                    name: task.name,
                    status: meta.status || '',
                    engine: meta.engine || '',
                    frameworkKey: meta.frameworkKey || resolved.frameworkKey,
                    frameworkLabel: meta.frameworkLabel || resolved.frameworkLabel,
                };
            });
        },
        pickCurveValues(dataObj, primaryKey, fallbackKeys = []) {
            if (!dataObj || typeof dataObj !== 'object') return [];
            if (Array.isArray(dataObj[primaryKey])) return dataObj[primaryKey];
            for (const key of fallbackKeys) {
                if (Array.isArray(dataObj[key])) return dataObj[key];
            }
            return [];
        },
        buildCurveSheetsForExport(runs) {
            const frameworkKey = runs[0]?.frameworkKey || 'pytorch';
            const defs = [
                { name: 'Loss', keys: this.chartCandidates(frameworkKey, 'loss') },
                { name: 'Accuracy-Metrics', keys: this.chartCandidates(frameworkKey, 'accuracy') },
                { name: 'mAP', keys: this.chartCandidates(frameworkKey, 'mAP') },
            ];
            return defs.map((def) => ({
                name: def.name,
                series: runs.map((run) => {
                    const dataObj = this.curveDataMap[run.runId] || {};
                    return {
                        runId: run.runId,
                        runName: run.name,
                        values: this.pickFirstSeries(dataObj, def.keys)?.data?.slice() || [],
                    };
                }),
            }));
        },
        async handleExportCompare() {
            if (!this.canExport) {
                this.$message.warning('暂无可导出的对比结果');
                return;
            }
            this.exporting = true;
            try {
                const runs = this.mapComparingRunsForExport();
                const parameterRows = this.parameterData.map((row) => ({
                    key: row.name,
                    valuesByRun: { ...(row.values || {}) },
                    isDiff: false,
                }));
                const metricRows = this.metricsData.map((row) => ({
                    key: row.name,
                    valuesByRun: { ...(row.values || {}) },
                    best: row.best,
                }));
                const curveSheets = this.buildCurveSheetsForExport(runs);
                const frameworkLabel = runs[0]?.frameworkLabel || 'Framework';
                const workbook = await buildWorkbook({
                    source: 'training',
                    frameworkLabel,
                    exportedAt: new Date().toISOString(),
                    runs,
                    parameterRows,
                    metricRows,
                    curveSheets,
                });
                const filename = this.buildExportFilename('training_task_comparison', frameworkLabel);
                await downloadWorkbook(workbook, filename);
                this.$message.success('对比结果已导出');
            } catch (error) {
                console.error(error);
                this.$message.error('导出失败: ' + (error?.message || error));
            } finally {
                this.exporting = false;
            }
        },
        async loadAvailableTasks() {
            try {
                const tasks = await fetchTrainingJobs(1, 100); // Fetch top 100 recent
                this.availableTasks = tasks.map(t => ({
                    id: String(t.job_id),
                    name: t.job_name || t.name,
                    status: t.status,
                    created_at: t.created_at,
                    epochs: t.parameters && t.parameters.epochs ? `${t.parameters.epochs}` : '-',
                    engine: t.engine || t.architecture?.engine || null,
                    frameworkKey: t.framework_key || resolveFramework(t.engine || t.architecture?.engine).frameworkKey,
                    frameworkLabel: t.framework_label || resolveFramework(t.engine || t.architecture?.engine).frameworkLabel,
                }));

                // Handle pre-selection from route query
                const preSelect = this.$route.query.compareIds || this.$route.query.run_ids;
                if (preSelect) {
                    const ids = preSelect
                        .split(',')
                        .map(x => String(x || '').trim())
                        .filter(Boolean)
                        .filter(id => !!this.findTaskById(id));
                    this.selectedTasks = ids;
                    const validation = this.validateFrameworkSelection(ids);
                    if (!validation.ok) {
                        this.$message.warning(validation.message);
                        return;
                    }
                    if (ids.length >= 2) {
                        this.handleCompare();
                    }
                }
            } catch (error) {
                this.$message.error('加载任务列表失败');
                console.error(error);
            }
        },
        handleTaskSelect(ids) {
            const next = Array.isArray(ids) ? [...ids] : [...this.selectedTasks];
            const dedup = [];
            next.forEach(id => {
                if (!dedup.includes(id)) dedup.push(id);
            });
            if (dedup.length > 4) {
                this.$message.warning('最多只能选择4个任务进行对比');
                dedup.splice(4);
            }
            const validation = this.validateFrameworkSelection(dedup);
            if (!validation.ok) {
                this.$message.warning(validation.message);
                const first = this.findTaskById(dedup[0]);
                this.selectedTasks = first
                    ? dedup.filter(id => this.findTaskById(id)?.frameworkKey === first.frameworkKey)
                    : [];
                return;
            }
            this.selectedTasks = dedup;
        },
        async handleCompare() {
            if (this.selectedTasks.length < 2) {
                this.$message.warning('请至少选择2个任务进行对比');
                return;
            }
            const validation = this.validateFrameworkSelection(this.selectedTasks);
            if (!validation.ok) {
                this.$message.warning(validation.message);
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
                        color: palette[idx % palette.length],
                        frameworkKey: t?.frameworkKey || 'engine:unknown',
                        frameworkLabel: t?.frameworkLabel || 'Unknown',
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
                if (Number(error?.status) === 409) {
                    this.$message.error('Paddle 与 PyTorch 模型的指标不同，无法进行对比。');
                } else {
                    this.$message.error('对比失败: ' + error.message);
                }
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
            
            const runs = this.extractCompareRuns(data);
            if (!runs.length) return;

            // Collect all parameter keys
            const paramKeys = new Set();
            runs.forEach(r => {
                const p = r.parameters || {};
                Object.keys(p).forEach(k => paramKeys.add(k));
            });

            // Specific interest keys
            const interest = ['epochs', 'batch_size', 'learning_rate', 'lr_scheduler', 'modelfile', 'optimizer', 'imgsz', 'device'];
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
            const runs = this.extractCompareRuns(data);
            // Define metrics of interest
            const metricsOfInterest = this.metricDefsForFramework(this.comparingTasks[0]?.frameworkKey);

            this.metricsData = metricsOfInterest.map(m => {
                const values = {};
                let bestVal = m.lowerIsBetter ? Infinity : -Infinity;
                
                runs.forEach(r => {
                    const rid = r.job_id || r.run_id || r.id;
                    // Check where metrics are stored. Usually 'result' or 'metrics' object in run details
                    // `mapTrainingRunToJob` in api/training puts flattened metrics in? No.
                    // Usually `result` holds final metrics.
                    const sources = [r.result, r.metrics, r];
                    let val = '-';
                    const keys = [m.key, ...(m.fallback || [])];
                    for (const s of sources) {
                        if (!s) continue;
                        const matchedKey = keys.find(key => s[key] !== undefined);
                        if (matchedKey) {
                            val = s[matchedKey];
                            break;
                        }
                    }
                    
                    const numericVal = parseFloat(val);
                    if (Number.isFinite(numericVal)) {
                        val = numericVal.toFixed(4);
                        bestVal = m.lowerIsBetter
                            ? Math.min(bestVal, numericVal)
                            : Math.max(bestVal, numericVal);
                    } else {
                        val = '-';
                    }
                    values[rid] = val;
                });
                
                return {
                    name: m.label,
                    importance: m.importance,
                    values,
                    lowerIsBetter: !!m.lowerIsBetter,
                    best: (m.lowerIsBetter ? bestVal !== Infinity : bestVal !== -Infinity) ? bestVal.toFixed(4) : '-'
                };
            });
        },
        chartCandidates(frameworkKey, chartId) {
            const isPaddle = frameworkKey === 'paddle';
            const defs = isPaddle
                ? {
                    loss: ['loss', 'train/loss', 'loss_cls', 'train/loss_cls', 'loss_iou', 'train/loss_iou'],
                    accuracy: ['metrics/precision(B)', 'precision', 'eval/bbox_precision', 'metrics/recall(B)', 'recall', 'eval/bbox_recall'],
                    mAP: ['metrics/mAP50-95(B)', 'mAP', 'eval/bbox_mAP', 'eval/bbox_map', 'metrics/mAP50(B)', 'AP50', 'mAP50'],
                }
                : {
                    loss: ['val/box_loss', 'train/box_loss', 'box_loss', 'val/cls_loss', 'train/cls_loss'],
                    accuracy: ['metrics/precision(B)', 'metrics/recall(B)', 'metrics/mAP50(B)'],
                    mAP: ['metrics/mAP50-95(B)', 'metrics/mAP50(B)'],
                };
            return defs[chartId] || [];
        },
        pickFirstSeries(dataObj, keys = []) {
            if (!dataObj || typeof dataObj !== 'object') return null;
            for (const key of keys) {
                if (Array.isArray(dataObj[key])) return { key, data: dataObj[key] };
            }
            return null;
        },
        metricDefsForFramework(frameworkKey) {
            if (frameworkKey === 'paddle') {
                return [
                    { key: 'mAP', fallback: ['metrics/mAP50-95(B)', 'eval/bbox_mAP', 'eval/bbox_map'], label: 'mAP', importance: 'high' },
                    { key: 'AP50', fallback: ['metrics/mAP50(B)', 'mAP50', 'eval/bbox_AP50', 'eval/bbox_ap50'], label: 'mAP50', importance: 'high' },
                    { key: 'precision', fallback: ['metrics/precision(B)', 'eval/bbox_precision'], label: 'Precision', importance: 'normal' },
                    { key: 'recall', fallback: ['metrics/recall(B)', 'eval/bbox_recall'], label: 'Recall', importance: 'normal' },
                    { key: 'loss', fallback: ['train/loss'], label: 'Loss', importance: 'normal', lowerIsBetter: true },
                    { key: 'loss_cls', fallback: ['train/loss_cls'], label: 'Loss Cls', importance: 'normal', lowerIsBetter: true },
                ];
            }
            return [
                { key: 'metrics/mAP50-95(B)', label: 'mAP50-95', importance: 'high' },
                { key: 'metrics/mAP50(B)', label: 'mAP50', importance: 'high' },
                { key: 'metrics/precision(B)', label: 'Precision', importance: 'normal' },
                { key: 'metrics/recall(B)', label: 'Recall', importance: 'normal' },
                { key: 'train/box_loss', label: 'Train Box Loss', importance: 'normal', lowerIsBetter: true },
                { key: 'val/box_loss', label: 'Val Box Loss', importance: 'normal', lowerIsBetter: true }
            ];
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
            void values;
            void taskId;
            return false; 
        },
        isBestMetric(metric, taskId) {
            const values = metric?.values || {};
            const v = parseFloat(values[taskId]);
            const arr = Object.values(values).map(x => parseFloat(x)).filter(x => !isNaN(x));
            if (!arr.length || isNaN(v)) return false;
            const target = metric?.lowerIsBetter ? Math.min(...arr) : Math.max(...arr);
            return v === target;
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
.task-option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.task-option-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
