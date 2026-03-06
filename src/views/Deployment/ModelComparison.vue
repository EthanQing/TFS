<template>
    <div class="comparison-container">
        <div class="header-strip">
            <div class="header-left">
                <i class="el-icon-data-analysis tool-icon"></i>
                <div>
                   <h3>模型对比</h3>
                   <p class="subtitle">对比多个训练任务的指标曲线和参数配置。</p>
                </div>
            </div>
            <div class="header-actions">
                <el-button size="small" @click="showSelector = true">
                    <i class="el-icon-plus"></i> 选择模型 ({{ selectedRuns.length }})
                </el-button>
                <el-button
                    size="small"
                    type="primary"
                    plain
                    :loading="exporting"
                    :disabled="!canExport"
                    @click="handleExportCompare"
                >
                    <i class="el-icon-download"></i> 导出对比结果
                </el-button>
            </div>
        </div>
        <div class="baseline-strip glass-panel-sm" v-if="selectedRuns.length > 0">
            <div class="baseline-left">
                <span class="baseline-label">模型性能基准</span>
                <el-select
                    v-model="baselineCandidateRunId"
                    size="small"
                    placeholder="选择基准模型"
                    class="baseline-select"
                >
                    <el-option
                        v-for="run in selectedRuns"
                        :key="getRunId(run)"
                        :label="getRunLabel(run)"
                        :value="getRunId(run)"
                    />
                </el-select>
                <el-button size="small" @click="applyBaselineSelection" :disabled="!baselineCandidateRunId">设为基准</el-button>
                <el-button
                    size="small"
                    type="primary"
                    plain
                    :loading="baselineSaving"
                    :disabled="!canPersistBaseline"
                    @click="persistBaselineSelection"
                >
                    保存为项目基准
                </el-button>
                <el-button
                    size="small"
                    type="text"
                    :disabled="!canPersistBaseline || !persistedBaselineRunId"
                    @click="removePersistedBaseline"
                >
                    清除项目基准
                </el-button>
            </div>
            <div class="baseline-right">
                <el-tag size="mini" effect="dark" type="success" v-if="baselineRunId">
                    当前基准: {{ baselineRunLabel }}
                </el-tag>
                <el-tag size="mini" effect="plain" v-if="persistedBaselineRunId">
                    已保存项目基准
                </el-tag>
                <el-tag size="mini" effect="plain" type="warning" v-if="!currentProjectId">
                    跨项目对比：仅本地基准
                </el-tag>
            </div>
        </div>

        <div class="content-wrapper" v-if="selectedRuns.length > 0">
            <div class="tabs-header">
                <div 
                    class="tab-item" 
                    :class="{ active: activeTab === 'curves' }"
                    @click="activeTab = 'curves'"
                >
                    <i class="el-icon-s-marketing"></i> 训练曲线
                </div>
                <div 
                    class="tab-item" 
                    :class="{ active: activeTab === 'params' }"
                    @click="activeTab = 'params'"
                >
                    <i class="el-icon-s-grid"></i> {{ metricCompareTabLabel }}
                </div>
                <div
                    class="tab-item"
                    :class="{ active: activeTab === 'training-params' }"
                    @click="activeTab = 'training-params'"
                >
                    <i class="el-icon-document-copy"></i> 训练参数对比
                </div>
            </div>

            <!-- Curves Tab -->
            <div class="tab-content" v-show="activeTab === 'curves'">
                 <div class="charts-grid" v-loading="loadingCurves">
                    <!-- Box Loss Chart -->
                    <div class="chart-card glass-panel-sm">
                        <div class="chart-header">Box Loss</div>
                        <div ref="boxLossChart" class="chart-body"></div>
                    </div>
                    <!-- Cls Loss Chart -->
                    <div class="chart-card glass-panel-sm">
                        <div class="chart-header">Cls Loss</div>
                        <div ref="clsLossChart" class="chart-body"></div>
                    </div>
                    <!-- DFL Loss Chart -->
                    <div class="chart-card glass-panel-sm">
                        <div class="chart-header">DFL Loss</div>
                        <div ref="dflLossChart" class="chart-body"></div>
                    </div>
                    <!-- mAP 50 Chart -->
                    <div class="chart-card glass-panel-sm">
                        <div class="chart-header">mAP 50</div>
                        <div ref="map50Chart" class="chart-body"></div>
                    </div>
                    <!-- mAP 50-95 Chart -->
                     <div class="chart-card glass-panel-sm">
                        <div class="chart-header">mAP 50-95</div>
                        <div ref="mapChart" class="chart-body"></div>
                    </div>
                    <!-- Precision Chart -->
                    <div class="chart-card glass-panel-sm">
                        <div class="chart-header">Precision</div>
                        <div ref="precisionChart" class="chart-body"></div>
                    </div>
                    <!-- Recall Chart -->
                    <div class="chart-card glass-panel-sm">
                        <div class="chart-header">Recall</div>
                        <div ref="recallChart" class="chart-body"></div>
                    </div>
                 </div>
            </div>

            <!-- Parameters Tab -->
            <div class="tab-content" v-show="activeTab === 'params'">
                <div class="params-table-wrapper glass-panel-sm" v-loading="loadingParams">
                     <el-table ref="paramsTable" :data="metricRows" row-key="key" border style="width: 100%" height="100%">
                        <el-table-column prop="key" label="指标" width="180" fixed></el-table-column>
                         <el-table-column 
                            v-for="run in selectedRuns" 
                            :key="getRunId(run)" 
                            :label="getRunLabel(run)"
                            min-width="150"
                        >
                            <template slot-scope="scope">
                                <span>
                                    {{ formatVal(scope.row[getRunId(run)]) }}
                                </span>
                            </template>
                        </el-table-column>
                     </el-table>
                </div>
                <div class="baseline-diff-wrapper glass-panel-sm" v-if="baselineDiffRows.length">
                    <div class="section-subtitle">基准差异（自动对比）</div>
                    <el-table :data="baselineDiffRows" border style="width: 100%">
                        <el-table-column prop="label" label="指标" width="170" fixed />
                        <el-table-column
                            v-for="run in selectedRuns"
                            :key="`diff-${getRunId(run)}`"
                            :label="getRunLabel(run)"
                            min-width="190"
                        >
                            <template slot-scope="scope">
                                <div class="metric-diff-cell">
                                    <div class="metric-raw">{{ formatVal(scope.row.valuesByRun[getRunId(run)]) }}</div>
                                    <div :class="['metric-delta', scope.row.trendByRun[getRunId(run)] || 'neutral']">
                                        Δ {{ formatDelta(scope.row.deltaByRun[getRunId(run)]?.delta_abs) }}
                                        ({{ formatPercent(scope.row.deltaByRun[getRunId(run)]?.delta_percent) }})
                                    </div>
                                </div>
                            </template>
                        </el-table-column>
                    </el-table>
                </div>
                <div class="recommend-wrapper glass-panel-sm" v-if="scenarioRecommendations.length">
                    <div class="section-subtitle">场景推荐</div>
                    <div class="recommend-grid">
                        <div class="recommend-card" v-for="item in scenarioRecommendations" :key="item.key">
                            <div class="recommend-title">{{ item.label }}</div>
                            <template v-if="item.runId">
                                <div class="recommend-model">{{ item.runName }}</div>
                                <div class="recommend-reason">{{ item.reason }}</div>
                            </template>
                            <template v-else>
                                <div class="recommend-empty">数据不足</div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <div class="tab-content" v-show="activeTab === 'training-params'">
                <div class="params-table-wrapper glass-panel-sm" v-loading="loadingTrainingParams">
                    <el-table ref="trainingParamsTable" :data="trainingParamRows" row-key="key" border style="width: 100%" height="100%">
                        <el-table-column prop="key" label="训练参数" width="220" fixed></el-table-column>
                        <el-table-column
                            v-for="run in selectedRuns"
                            :key="`param-${getRunId(run)}`"
                            :label="getRunLabel(run)"
                            min-width="170"
                        >
                            <template slot-scope="scope">
                                <span>{{ formatVal(scope.row[getRunId(run)]) }}</span>
                            </template>
                        </el-table-column>
                    </el-table>
                </div>
            </div>
        </div>

        <div class="empty-state" v-else>
            <i class="el-icon-data-analysis"></i>
            <p>请选择需要对比的训练任务 (最多 7 个)</p>
            <el-button type="primary" @click="showSelector = true">选择模型</el-button>
        </div>

        <!-- Run Selector Dialog -->
        <el-dialog title="选择训练任务" :visible.sync="showSelector" width="900px" top="5vh" append-to-body>
            <div class="selector-body">
                <div class="filter-bar">
                    <el-input v-model="searchQuery" placeholder="搜索任务名称..." prefix-icon="el-icon-search" size="small" clearable @input="fetchRuns"></el-input>
                    <el-select v-model="projectFilter" placeholder="项目" size="small" clearable filterable @change="fetchRuns">
                        <el-option v-for="p in projectList" :key="p.project_id" :label="p.name" :value="p.project_id"></el-option>
                    </el-select>
                    <el-select v-model="filterStatus" placeholder="状态" size="small" clearable @change="fetchRuns">
                        <el-option label="全部" value=""></el-option>
                        <el-option label="已完成" value="completed"></el-option>
                        <el-option label="运行中" value="running"></el-option>
                    </el-select>
                </div>
                <el-table 
                    ref="runTable"
                    :data="runList" 
                    height="500" 
                    v-loading="loadingList"
                    @selection-change="handleSelectionChange"
                    row-key="run_id"
                >
                    <el-table-column type="selection" width="55" :reserve-selection="true" :selectable="checkSelectable"></el-table-column>
                    <el-table-column prop="name" label="任务名称" show-overflow-tooltip></el-table-column>
                    <el-table-column label="框架" width="130">
                        <template slot-scope="scope">
                            <el-tag size="mini" effect="plain">{{ getFrameworkLabel(scope.row) }}</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="状态" width="100">
                        <template slot-scope="scope">
                            <el-tag size="mini" :type="getStatusType(scope.row.status)">{{ scope.row.status }}</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="创建时间" width="160">
                         <template slot-scope="scope">{{ formatDate(scope.row.created_at) }}</template>
                    </el-table-column>
                     <el-table-column label="Epochs" width="100">
                         <template slot-scope="scope">
                             {{ renderEpoch(scope.row) }}
                         </template>
                    </el-table-column>
                </el-table>
                <div class="pagination-bar">
                    <el-pagination
                        background
                        layout="prev, pager, next"
                        :total="totalRuns"
                        :page-size="pageSize"
                        :current-page.sync="currentPage"
                        @current-change="fetchRuns"
                    >
                    </el-pagination>
                </div>
            </div>
            <span slot="footer">
                <div class="selection-info">已选择: {{ tempSelection.length }} / 7</div>
                <el-button @click="showSelector = false">取消</el-button>
                <el-button type="primary" @click="confirmSelection" :disabled="tempSelection.length < 1 || tempSelection.length > 7">确定</el-button>
            </span>
        </el-dialog>
    </div>
</template>

<script>
import * as echarts from 'echarts';
import {
    fetchProjects,
    fetchProjectCompareBaseline,
    setProjectCompareBaseline,
    clearProjectCompareBaseline,
} from "@/api/projects";
import { fetchTrainingJobsPage, FetchTrainingJobsMetrics_detailed, CompareTrainingRuns, FetchTrainingJobParameters } from "@/api/training";
import { resolveFramework, isFrameworkCompatible } from "@/utils/trainingFramework";
import { buildWorkbook, downloadWorkbook } from "@/utils/trainingCompareExport";

export default {
    name: 'ModelComparison',
    data() {
        return {
            activeTab: 'curves',
            metricCompareTabLabel: '\u6307\u6807\u5bf9\u6bd4',
            showSelector: false,
            loadingList: false,
            loadingCurves: false,
            loadingParams: false,
            loadingTrainingParams: false,
            exporting: false,
            
            // Selector State
            runList: [],
            projectList: [],
            totalRuns: 0,
            currentPage: 1,
            pageSize: 10,
            searchQuery: '',
            filterStatus: '',
            projectFilter: '',
            tempSelection: [],
            
            // Main State
            selectedRuns: [],
            compareData: null,
            metricsData: {}, // map run_id -> series data
            trainingParamsByRun: {},
            trainingParamsRequestSeq: 0,
            lockedDatasetId: null,
            lockedFrameworkKey: null,
            baselineRunId: null,
            baselineCandidateRunId: null,
            persistedBaselineRunId: null,
            loadingBaseline: false,
            baselineSaving: false,
            baselineRequestSeq: 0,
            
            // Chart instances
            chartInstances: {}
        };
    },
    computed: {
        metricRows() {
            if (!this.compareData || !this.compareData.runs) return [];
            const runsMap = this.buildCompareRunsMap();
            
            const metricDefs = [
                { key: 'best_mAP_50', metricKey: 'metrics/mAP50(B)' },
                { key: 'best_mAP_50_95', metricKey: 'metrics/mAP50-95(B)' },
                { key: 'best_precision', metricKey: 'metrics/precision(B)' },
                { key: 'best_recall', metricKey: 'metrics/recall(B)' },
                { key: 'model_size_mb', metricKey: null },
                { key: 'inference_time_ms', metricKey: null },
            ];

            const rows = [];
            metricDefs.forEach(({ key, metricKey }) => {
                const row = { key };
                const values = [];
                
                this.selectedRuns.forEach(selectedRun => {
                    let val = null;
                    const rid = this.getRunId(selectedRun);
                    const ridKey = String(rid || '');
                    
                    const r = runsMap[ridKey] || runsMap[ridKey.toLowerCase()] || null;

                    if (key === 'model_size_mb') {
                        val = this.toFiniteNumber(r?.model_size_mb);
                    } else if (key === 'inference_time_ms') {
                        val = this.toFiniteNumber(r?.inference_time_ms);
                    } else if (metricKey) {
                        val = this.pickMetricValue(r, rid, metricKey);
                    }
                    
                    row[rid] = val;
                    values.push(JSON.stringify(val));
                });
                
                // Mark if different
                row.isDiff = new Set(values).size > 1;
                rows.push(row);
            });
            
            return rows.sort((a, b) => a.key.localeCompare(b.key));
        },
        trainingParamRows() {
            const keySet = new Set();
            this.selectedRuns.forEach((run) => {
                const rid = this.getRunId(run);
                const params = this.trainingParamsByRun[rid] || {};
                Object.keys(params).forEach((k) => keySet.add(k));
            });

            return Array.from(keySet)
                .sort((a, b) => String(a).localeCompare(String(b)))
                .map((key) => {
                    const row = { key };
                    const values = [];
                    this.selectedRuns.forEach((run) => {
                        const rid = this.getRunId(run);
                        const val = (this.trainingParamsByRun[rid] || {})[key];
                        row[rid] = val;
                        values.push(JSON.stringify(val));
                    });
                    row.isDiff = new Set(values).size > 1;
                    return row;
                });
        },
        currentProjectId() {
            if (!this.selectedRuns.length) return null;
            const ids = this.selectedRuns
                .map((run) => Number(run?.project_id))
                .filter((id) => Number.isFinite(id));
            if (!ids.length) return null;
            const first = ids[0];
            return ids.every((id) => id === first) ? first : null;
        },
        currentFrameworkKey() {
            if (!this.selectedRuns.length) return null;
            return this.getFrameworkKey(this.selectedRuns[0]);
        },
        baselineRunLabel() {
            if (!this.baselineRunId) return '';
            const run = this.selectedRuns.find((x) => this.getRunId(x) === this.baselineRunId);
            return run ? this.getRunLabel(run) : this.baselineRunId;
        },
        canPersistBaseline() {
            return !!(this.currentProjectId && this.currentFrameworkKey && this.baselineRunId);
        },
        baselineDiffRows() {
            const baselineId = this.baselineRunId;
            if (!baselineId || !this.compareData?.runs?.length) return [];
            const runMap = this.buildCompareRunsMap();
            const baseline = runMap[String(baselineId)] || runMap[String(baselineId).toLowerCase()];
            if (!baseline) return [];

            const defs = [
                { key: 'metrics/mAP50(B)', label: 'mAP50', higherBetter: true },
                { key: 'metrics/mAP50-95(B)', label: 'mAP50-95', higherBetter: true },
                { key: 'metrics/precision(B)', label: 'Precision', higherBetter: true },
                { key: 'metrics/recall(B)', label: 'Recall', higherBetter: true },
                { key: 'model_size_mb', label: 'Model Size (MB)', higherBetter: false },
                { key: 'inference_time_ms', label: 'Inference Time (ms)', higherBetter: false },
            ];

            const pickMetric = (run, runId, key) => this.pickMetricValue(run, runId, key);

            return defs.map((def) => {
                const baselineValue = pickMetric(baseline, baselineId, def.key);
                const valuesByRun = {};
                const deltaByRun = {};
                const trendByRun = {};
                this.selectedRuns.forEach((selected) => {
                    const runId = this.getRunId(selected);
                    const runKey = String(runId || '');
                    const item = runMap[runKey] || runMap[runKey.toLowerCase()];
                    const value = pickMetric(item, runId, def.key);
                    valuesByRun[runId] = value;
                    if (!Number.isFinite(value) || !Number.isFinite(baselineValue)) {
                        deltaByRun[runId] = { delta_abs: null, delta_percent: null };
                        trendByRun[runId] = 'neutral';
                        return;
                    }
                    const deltaAbs = Number(value) - Number(baselineValue);
                    const baseAbs = Math.abs(Number(baselineValue));
                    const deltaPercent = baseAbs > 1e-12 ? (deltaAbs / baseAbs) * 100 : 0;
                    deltaByRun[runId] = { delta_abs: deltaAbs, delta_percent: deltaPercent };
                    if (Math.abs(deltaAbs) < 1e-12) {
                        trendByRun[runId] = 'neutral';
                        return;
                    }
                    const improved = def.higherBetter ? deltaAbs > 0 : deltaAbs < 0;
                    trendByRun[runId] = improved ? 'improved' : 'degraded';
                });
                return {
                    key: def.key,
                    label: def.label,
                    higherBetter: def.higherBetter,
                    valuesByRun,
                    deltaByRun,
                    trendByRun,
                };
            });
        },
        scenarioRecommendations() {
            if (!this.compareData?.runs?.length) return [];
            const runMap = this.buildCompareRunsMap();
            const candidates = this.selectedRuns
                .map((run) => {
                    const runKey = String(this.getRunId(run) || '');
                    return runMap[runKey] || runMap[runKey.toLowerCase()];
                })
                .filter(Boolean);
            if (!candidates.length) return [];

            const pickMetric = (run, key) => this.pickMetricValue(run, run?.run_id || run?.job_id, key);

            const normalizeMap = (metricKey, higherBetter) => {
                const values = candidates
                    .map((run) => ({ run_id: run.run_id, value: pickMetric(run, metricKey) }))
                    .filter((x) => Number.isFinite(x.value));
                if (!values.length) return {};
                const minVal = Math.min(...values.map((x) => Number(x.value)));
                const maxVal = Math.max(...values.map((x) => Number(x.value)));
                const span = maxVal - minVal;
                const out = {};
                values.forEach((x) => {
                    if (span <= 1e-12) {
                        out[String(x.run_id)] = 1;
                        return;
                    }
                    const v = Number(x.value);
                    out[String(x.run_id)] = higherBetter ? (v - minVal) / span : (maxVal - v) / span;
                });
                return out;
            };

            const acc95 = normalizeMap('metrics/mAP50-95(B)', true);
            const acc50 = normalizeMap('metrics/mAP50(B)', true);
            const speedLatency = normalizeMap('inference_time_ms', false);
            const speedSize = normalizeMap('model_size_mb', false);

            const weightedScore = (runId, weights) => {
                let totalWeight = 0;
                let totalScore = 0;
                weights.forEach((w) => {
                    const score = w.map[String(runId)];
                    if (!Number.isFinite(score)) return;
                    totalWeight += w.weight;
                    totalScore += score * w.weight;
                });
                if (totalWeight <= 1e-12) return null;
                return totalScore / totalWeight;
            };

            const buildCard = (key, label, weights, reasonBuilder) => {
                let winner = null;
                let bestScore = -Infinity;
                candidates.forEach((run) => {
                    const score = weightedScore(run.run_id, weights);
                    if (!Number.isFinite(score)) return;
                    if (!winner || score > bestScore) {
                        winner = run;
                        bestScore = score;
                    }
                });
                if (!winner) {
                    return { key, label, runId: null, runName: '', reason: '数据不足' };
                }
                const runName = winner.name || winner.run_id;
                return {
                    key,
                    label,
                    runId: winner.run_id,
                    runName,
                    reason: reasonBuilder(winner),
                };
            };

            const to4 = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(4) : '-');
            const to2 = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '-');

            return [
                buildCard(
                    'accuracy',
                    '精度优先',
                    [
                        { map: acc95, weight: 0.7 },
                        { map: acc50, weight: 0.3 },
                    ],
                    (run) => `mAP50-95=${to4(pickMetric(run, 'metrics/mAP50-95(B)'))}，mAP50=${to4(pickMetric(run, 'metrics/mAP50(B)'))}`
                ),
                buildCard(
                    'speed',
                    '速度优先',
                    [
                        { map: speedLatency, weight: 0.7 },
                        { map: speedSize, weight: 0.3 },
                    ],
                    (run) => `inference=${to2(pickMetric(run, 'inference_time_ms'))}ms，size=${to2(pickMetric(run, 'model_size_mb'))}MB`
                ),
                buildCard(
                    'balanced',
                    '均衡',
                    [
                        { map: candidates.reduce((acc, run) => {
                            const score = weightedScore(run.run_id, [
                                { map: acc95, weight: 0.7 },
                                { map: acc50, weight: 0.3 },
                            ]);
                            if (Number.isFinite(score)) acc[String(run.run_id)] = score;
                            return acc;
                        }, {}), weight: 0.5 },
                        { map: candidates.reduce((acc, run) => {
                            const score = weightedScore(run.run_id, [
                                { map: speedLatency, weight: 0.7 },
                                { map: speedSize, weight: 0.3 },
                            ]);
                            if (Number.isFinite(score)) acc[String(run.run_id)] = score;
                            return acc;
                        }, {}), weight: 0.5 },
                    ],
                    (run) => `mAP50-95=${to4(pickMetric(run, 'metrics/mAP50-95(B)'))}，inference=${to2(pickMetric(run, 'inference_time_ms'))}ms`
                ),
            ];
        },
        canExport() {
            if (!this.selectedRuns.length) return false;
            if (!this.compareData || !Array.isArray(this.compareData.runs)) return false;
            return this.compareData.runs.length > 0;
        }
    },
    watch: {
        activeTab(val) {
            if (val === 'curves') {
                this.$nextTick(() => {
                    this.resizeCharts();
                    this.renderCharts();
                });
            } else if (val === 'params') {
                this.$nextTick(() => {
                    this.reflowParamsTable();
                });
            } else if (val === 'training-params') {
                this.$nextTick(() => {
                    this.reflowTrainingParamsTable();
                });
            }
        },
        selectedRuns() {
            if (this.selectedRuns.length) {
                this.syncBaselineAfterSelectionChange();
                this.loadComparisonData();
                this.loadTrainingParamsFromRuns();
            } else {
                this.compareData = null;
                this.metricsData = {};
                this.trainingParamsByRun = {};
                this.baselineRunId = null;
                this.baselineCandidateRunId = null;
                this.persistedBaselineRunId = null;
            }
        },
        showSelector(val) {
            if (val) {
                this.tempSelection = [...this.selectedRuns];
                this.syncSelectionLocks(this.tempSelection);
                this.fetchRuns();
                // We need to wait for dialog render to access table ref, but actually
                // el-table selection maintenance with pagination is tricky. 
                // We rely on row-key and reserve-selection.
                this.$nextTick(() => {
                    if (this.$refs.runTable) {
                        this.$refs.runTable.clearSelection();
                        this.selectedRuns.forEach(row => {
                            this.$refs.runTable.toggleRowSelection(row, true);
                        });
                    }
                });
            }
        }
    },
    mounted() {
        window.addEventListener('resize', this.resizeCharts);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.resizeCharts);
        Object.values(this.chartInstances).forEach(c => c.dispose());
    },
    methods: {
        getRunId(run) {
            return run?.job_id || run?.run_id;
        },
        getRunLabel(run) {
            return run?.name || run?.job_name || this.getRunId(run) || '-';
        },
        buildCompareRunsMap() {
            const map = {};
            (this.compareData?.runs || []).forEach((run) => {
                const keys = [run?.run_id, run?.job_id];
                keys.forEach((raw) => {
                    const key = String(raw || '').trim();
                    if (!key) return;
                    map[key] = run;
                    map[key.toLowerCase()] = run;
                });
            });
            return map;
        },
        toFiniteNumber(v) {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        },
        getMetricSeriesValues(runId, metricKey) {
            const rid = String(runId || '').trim();
            if (!rid) return [];
            const dataObj = this.metricsData[rid] || this.metricsData[rid.toLowerCase()];
            const resolvedKey = this.resolveMetricSeriesKey(dataObj, metricKey);
            const values = resolvedKey && Array.isArray(dataObj?.[resolvedKey]) ? dataObj[resolvedKey] : [];
            return values.map((item) => this.toFiniteNumber(item)).filter((item) => item !== null);
        },
        pickMetricValue(run, runId, metricKey) {
            if (!run && !runId) return null;
            if (metricKey === 'model_size_mb' || metricKey === 'inference_time_ms') {
                const direct = this.toFiniteNumber(run?.[metricKey]);
                if (direct !== null) return direct;
                return null;
            }

            const best = run?.best_metrics && typeof run.best_metrics === 'object' ? run.best_metrics : {};
            const final = run?.final_metrics && typeof run.final_metrics === 'object' ? run.final_metrics : {};
            const summaryBest =
                run?.metric_summary?.best && typeof run.metric_summary.best === 'object' ? run.metric_summary.best : {};
            const summaryFinal =
                run?.metric_summary?.final && typeof run.metric_summary.final === 'object' ? run.metric_summary.final : {};
            const candidates = [
                best?.[metricKey],
                final?.[metricKey],
                summaryBest?.[metricKey],
                summaryFinal?.[metricKey],
            ];
            for (const candidate of candidates) {
                const parsed = this.toFiniteNumber(candidate);
                if (parsed !== null) return parsed;
            }

            const seriesValues = this.getMetricSeriesValues(runId, metricKey);
            if (!seriesValues.length) return null;
            return Math.max(...seriesValues);
        },
        reflowParamsTable() {
            const table = this.$refs.paramsTable;
            if (table && typeof table.doLayout === 'function') {
                table.doLayout();
            }
        },
        reflowTrainingParamsTable() {
            const table = this.$refs.trainingParamsTable;
            if (table && typeof table.doLayout === 'function') {
                table.doLayout();
            }
        },
        formatVal(v) {
            if (v === null || v === undefined) return '-';
            if (typeof v === 'boolean') return v ? 'Yes' : 'No';
             if (typeof v === 'number') {
                if (Number.isInteger(v)) return v;
                return v.toFixed(4); // limit decimals
            }
            return String(v);
        },
        formatDate(d) {
            if (!d) return '-';
            return new Date(d).toLocaleString();
        },
        async loadTrainingParamsFromRuns() {
            const requestSeq = ++this.trainingParamsRequestSeq;
            const runIds = this.selectedRuns
                .map((run) => String(this.getRunId(run) || '').trim())
                .filter(Boolean);
            if (!runIds.length) {
                this.trainingParamsByRun = {};
                return;
            }

            this.loadingTrainingParams = true;
            try {
                const entries = await Promise.all(
                    runIds.map(async (runId) => {
                        try {
                            const params = await FetchTrainingJobParameters(runId);
                            return [runId, params && typeof params === 'object' ? params : {}];
                        } catch (error) {
                            return [runId, { __error__: error?.message || 'Failed to load training parameters' }];
                        }
                    })
                );
                if (requestSeq !== this.trainingParamsRequestSeq) return;
                const nextMap = {};
                entries.forEach(([runId, params]) => {
                    nextMap[runId] = params;
                });
                this.trainingParamsByRun = nextMap;
                this.$nextTick(() => {
                    this.reflowTrainingParamsTable();
                });
            } finally {
                if (requestSeq === this.trainingParamsRequestSeq) {
                    this.loadingTrainingParams = false;
                }
            }
        },
        formatDelta(v) {
            const n = Number(v);
            if (!Number.isFinite(n)) return '-';
            const sign = n > 0 ? '+' : '';
            return `${sign}${n.toFixed(4)}`;
        },
        formatPercent(v) {
            const n = Number(v);
            if (!Number.isFinite(n)) return '-';
            const sign = n > 0 ? '+' : '';
            return `${sign}${n.toFixed(2)}%`;
        },
        syncBaselineAfterSelectionChange() {
            const selectedIds = this.selectedRuns
                .map((run) => String(this.getRunId(run) || '').trim())
                .filter(Boolean);
            if (!selectedIds.length) {
                this.baselineRunId = null;
                this.baselineCandidateRunId = null;
                return;
            }
            if (!this.baselineRunId || !selectedIds.includes(String(this.baselineRunId))) {
                this.baselineRunId = selectedIds[0];
            }
            if (!this.baselineCandidateRunId || !selectedIds.includes(String(this.baselineCandidateRunId))) {
                this.baselineCandidateRunId = this.baselineRunId;
            }
        },
        async loadPersistedBaseline() {
            const selectedIds = this.selectedRuns
                .map((run) => String(this.getRunId(run) || '').trim())
                .filter(Boolean);
            if (!selectedIds.length) {
                this.persistedBaselineRunId = null;
                this.baselineRunId = null;
                this.baselineCandidateRunId = null;
                return;
            }

            const fallbackRunId = selectedIds[0];
            if (!this.currentProjectId || !this.currentFrameworkKey) {
                this.persistedBaselineRunId = null;
                if (!this.baselineRunId || !selectedIds.includes(String(this.baselineRunId))) {
                    this.baselineRunId = fallbackRunId;
                }
                this.baselineCandidateRunId = this.baselineRunId;
                return;
            }

            const requestSeq = ++this.baselineRequestSeq;
            this.loadingBaseline = true;
            try {
                const res = await fetchProjectCompareBaseline(this.currentProjectId, this.currentFrameworkKey);
                if (requestSeq !== this.baselineRequestSeq) return;

                const persisted = String(res?.baseline_run_id || '').trim() || null;
                this.persistedBaselineRunId = persisted;
                if (persisted && selectedIds.includes(persisted)) {
                    this.baselineRunId = persisted;
                } else if (!this.baselineRunId || !selectedIds.includes(String(this.baselineRunId))) {
                    this.baselineRunId = fallbackRunId;
                }
                this.baselineCandidateRunId = this.baselineRunId;
            } catch (e) {
                if (requestSeq !== this.baselineRequestSeq) return;
                this.persistedBaselineRunId = null;
                if (!this.baselineRunId || !selectedIds.includes(String(this.baselineRunId))) {
                    this.baselineRunId = fallbackRunId;
                }
                this.baselineCandidateRunId = this.baselineRunId;
                if (Number(e?.status) !== 404) {
                    console.error('Failed to load project baseline', e);
                }
            } finally {
                if (requestSeq === this.baselineRequestSeq) {
                    this.loadingBaseline = false;
                }
            }
        },
        applyBaselineSelection() {
            const rid = String(this.baselineCandidateRunId || '').trim();
            if (!rid) {
                this.$message.warning('请先选择基准模型');
                return;
            }
            const selectedIds = this.selectedRuns.map((run) => String(this.getRunId(run) || ''));
            if (!selectedIds.includes(rid)) {
                this.$message.warning('基准模型必须在当前对比集合中');
                return;
            }
            this.baselineRunId = rid;
            this.baselineCandidateRunId = rid;
            this.$message.success('基准已更新');
        },
        async persistBaselineSelection() {
            if (!this.canPersistBaseline) return;
            this.baselineSaving = true;
            try {
                const res = await setProjectCompareBaseline(this.currentProjectId, {
                    framework_key: this.currentFrameworkKey,
                    baseline_run_id: this.baselineRunId,
                });
                const persisted = String(res?.baseline_run_id || this.baselineRunId || '').trim() || null;
                this.persistedBaselineRunId = persisted;
                if (persisted) {
                    this.baselineRunId = persisted;
                    this.baselineCandidateRunId = persisted;
                }
                this.$message.success('项目基准已保存');
            } catch (e) {
                const msg = e?.data?.detail?.message || e?.data?.detail || e?.message || '保存项目基准失败';
                this.$message.error(msg);
            } finally {
                this.baselineSaving = false;
            }
        },
        async removePersistedBaseline() {
            if (!this.currentProjectId || !this.currentFrameworkKey) return;
            this.baselineSaving = true;
            try {
                await clearProjectCompareBaseline(this.currentProjectId, this.currentFrameworkKey);
                this.persistedBaselineRunId = null;
                this.$message.success('项目基准已清除');
            } catch (e) {
                const msg = e?.data?.detail?.message || e?.data?.detail || e?.message || '清除项目基准失败';
                this.$message.error(msg);
            } finally {
                this.baselineSaving = false;
            }
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
        mapSelectedRunsForExport() {
            const compareMap = {};
            (this.compareData?.runs || []).forEach((run) => {
                const key = String(run?.run_id || run?.job_id || '').trim();
                if (!key) return;
                compareMap[key] = run;
                compareMap[key.toLowerCase()] = run;
            });
            return this.selectedRuns.map((run) => {
                const runId = this.getRunId(run);
                const compareRun = compareMap[runId] || compareMap[String(runId || '').toLowerCase()] || {};
                return {
                    runId,
                    name: this.getRunLabel(run),
                    status: compareRun.status || run.status || '',
                    engine: compareRun.engine || run.engine || run.architecture?.engine || '',
                    frameworkKey: compareRun.framework_key || run.framework_key || this.getFrameworkKey(run),
                    frameworkLabel: compareRun.framework_label || run.framework_label || this.getFrameworkLabel(run),
                };
            });
        },
        collectMetricRowsForExport(runs) {
            const rowMap = {};
            const putMetric = (rowKey, runId, value) => {
                if (value === null || value === undefined || value === '') return;
                if (!rowMap[rowKey]) rowMap[rowKey] = { key: rowKey, valuesByRun: {} };
                rowMap[rowKey].valuesByRun[runId] = value;
            };
            const compareMap = {};
            (this.compareData?.runs || []).forEach((run) => {
                compareMap[String(run.run_id || '').toLowerCase()] = run;
            });
            runs.forEach((run) => {
                const runId = run.runId;
                const item = compareMap[String(runId || '').toLowerCase()] || null;
                if (!item) return;
                const bestMetrics = item.best_metrics && typeof item.best_metrics === 'object' ? item.best_metrics : {};
                const finalMetrics = item.final_metrics && typeof item.final_metrics === 'object' ? item.final_metrics : {};
                const summaryBest =
                    item.metric_summary?.best && typeof item.metric_summary.best === 'object' ? item.metric_summary.best : {};
                const summaryFinal =
                    item.metric_summary?.final && typeof item.metric_summary.final === 'object' ? item.metric_summary.final : {};
                Object.keys(bestMetrics).forEach((k) => putMetric(`best/${k}`, runId, bestMetrics[k]));
                Object.keys(finalMetrics).forEach((k) => putMetric(`final/${k}`, runId, finalMetrics[k]));
                Object.keys(summaryBest).forEach((k) => putMetric(`best/${k}`, runId, summaryBest[k]));
                Object.keys(summaryFinal).forEach((k) => putMetric(`final/${k}`, runId, summaryFinal[k]));
                putMetric('model_size_mb', runId, item.model_size_mb);
                putMetric('inference_time_ms', runId, item.inference_time_ms);
            });
            const diffMap = {};
            (this.baselineDiffRows || []).forEach((row) => {
                diffMap[row.key] = row.deltaByRun || {};
            });
            return Object.values(rowMap).map((row) => {
                const numeric = Object.values(row.valuesByRun)
                    .map((v) => Number(v))
                    .filter((n) => Number.isFinite(n));
                let baseMetricKey = row.key;
                if (baseMetricKey.startsWith('best/')) baseMetricKey = baseMetricKey.slice(5);
                else if (baseMetricKey.startsWith('final/')) baseMetricKey = baseMetricKey.slice(6);
                return {
                    ...row,
                    best: numeric.length ? Math.max(...numeric) : '',
                    deltaByRun: diffMap[baseMetricKey] || undefined,
                };
            });
        },
        resolveMetricSeriesKey(dataObj, metricKey) {
            if (!dataObj || typeof dataObj !== 'object') return null;
            if (Object.prototype.hasOwnProperty.call(dataObj, metricKey)) return metricKey;

            const aliases = {
                'metrics/mAP50(B)': ['metrics/mAP50(B)', 'AP50', 'mAP50', 'eval/bbox_AP50', 'eval/bbox_ap50'],
                'metrics/mAP50-95(B)': ['metrics/mAP50-95(B)', 'mAP', 'eval/bbox_mAP', 'eval/bbox_map'],
                'metrics/precision(B)': ['metrics/precision(B)', 'precision', 'eval/bbox_precision'],
                'metrics/recall(B)': ['metrics/recall(B)', 'recall', 'eval/bbox_recall'],
                box_loss: ['box_loss'],
                cls_loss: ['cls_loss'],
                dfl_loss: ['dfl_loss'],
            };

            const keys = Object.keys(dataObj);
            const aliasList = aliases[metricKey] || [metricKey];

            for (const alias of aliasList) {
                const exact = keys.find((k) => k === alias);
                if (exact) return exact;
            }

            const fuzzyMatches = [];
            aliasList.forEach((alias) => {
                keys.forEach((k) => {
                    if (k === alias || k.endsWith(`/${alias}`)) {
                        fuzzyMatches.push(k);
                    }
                });
            });
            if (!fuzzyMatches.length) return null;
            const trainKey = fuzzyMatches.find((k) => k.startsWith('train/'));
            return trainKey || fuzzyMatches[0];
        },
        collectCurveSheetsForExport(runs) {
            const defs = [
                { name: 'BoxLoss', key: 'box_loss' },
                { name: 'ClsLoss', key: 'cls_loss' },
                { name: 'DFLLoss', key: 'dfl_loss' },
                { name: 'mAP50', key: 'metrics/mAP50(B)' },
                { name: 'mAP50-95', key: 'metrics/mAP50-95(B)' },
                { name: 'Precision', key: 'metrics/precision(B)' },
                { name: 'Recall', key: 'metrics/recall(B)' },
            ];
            return defs.map((def) => {
                const series = runs.map((run) => {
                    const dataObj = this.metricsData[run.runId] || {};
                    const resolvedKey = this.resolveMetricSeriesKey(dataObj, def.key);
                    const values = resolvedKey ? (Array.isArray(dataObj[resolvedKey]) ? dataObj[resolvedKey] : []) : [];
                    return {
                        runId: run.runId,
                        runName: run.name,
                        values: values.slice(),
                    };
                });
                return { name: def.name, series };
            });
        },
        async handleExportCompare() {
            if (!this.canExport) {
                this.$message.warning('暂无可导出的对比结果');
                return;
            }
            this.exporting = true;
            try {
                const runs = this.mapSelectedRunsForExport();
                const parameterRows = this.trainingParamRows.map((row) => {
                    const valuesByRun = {};
                    runs.forEach((run) => {
                        valuesByRun[run.runId] = row[run.runId];
                    });
                    return {
                        key: row.key,
                        valuesByRun,
                        isDiff: !!row.isDiff,
                    };
                });
                const metricRows = this.collectMetricRowsForExport(runs);
                const curveSheets = this.collectCurveSheetsForExport(runs);
                const frameworkLabel = runs[0]?.frameworkLabel || 'Framework';
                const workbook = await buildWorkbook({
                    source: 'deployment',
                    frameworkLabel,
                    exportedAt: new Date().toISOString(),
                    baselineRunId: this.baselineRunId || '',
                    runs,
                    parameterRows,
                    metricRows,
                    curveSheets,
                });
                const filename = this.buildExportFilename('model_comparison', frameworkLabel);
                await downloadWorkbook(workbook, filename);
                this.$message.success('对比结果已导出');
            } catch (e) {
                console.error(e);
                this.$message.error(`导出失败: ${e?.message || e}`);
            } finally {
                this.exporting = false;
            }
        },
        getStatusType(status) {
            const map = {
                completed: 'success',
                running: 'primary',
                failed: 'danger',
                created: 'info',
                queued: 'warning'
            };
            return map[status] || 'info';
        },
        getattr(obj, k, def) { return (obj && obj[k]) || def; },
        
        async fetchRuns() {
            this.loadingList = true;
            try {
                // Fetch projects if not loaded
                if (this.projectList.length === 0) {
                    try {
                        const projs = await fetchProjects(1, 100); // Fetch top 100 projects for dropdown
                        this.projectList = projs || [];
                    } catch(e) { console.error(e); }
                }

                const filters = {};
                if (this.filterStatus) filters.status = this.filterStatus;
                if (this.projectFilter) filters.project_id = this.projectFilter;
                
                // Client-side search for name since API v2 doesn't fully support search query param yet (based on previous exploration)
                // Actually, if we use server-side pagination, client-side filtering is weird. 
                // But let's stick to what we have. If backend supported search, we'd pass it in `filters`.
                // For now, allow server filter by status/project, and maybe client-side name filter if list is small?
                // No, with pagination we should try to pass search if possible or just rely on server.
                // Since I cannot easily change backend search logic now, I will invoke fetchTrainingJobsPage.
                // If the user searches by name, it might only search within the page if backend ignores it.
                // Let's assume for this task we just add the project filter supported by backend.
                
                const res = await fetchTrainingJobsPage(this.currentPage, this.pageSize, filters);
                
                let items = res.items || [];
                // Simple client-side name filter (only works well if dataset is small or we fetch all)
                // Since we are paging, this is imperfect but acceptable given constraints.
                if (this.searchQuery) {
                    const q = this.searchQuery.toLowerCase();
                    items = items.filter(x => x.job_name.toLowerCase().includes(q) || x.job_id.toLowerCase().includes(q));
                }
                
                this.runList = items;
                this.totalRuns = res.meta ? res.meta.total : 0;
                
            } catch (e) {
                this.$message.error('获取任务列表失败');
            } finally {
                this.loadingList = false;
            }
        },
        getDatasetScopeKey(row) {
            const datasetId =
                row?.project?.dataset?.dataset_id ||
                row?.project?.dataset_id ||
                row?.dataset_id ||
                null;
            if (datasetId != null && String(datasetId).trim()) {
                return `dataset:${String(datasetId).trim()}`;
            }
            const datasetVersionId = row?.dataset_version_id || row?.dataset_version?.version_id || null;
            if (datasetVersionId != null && String(datasetVersionId).trim()) {
                return `dataset_version:${String(datasetVersionId).trim()}`;
            }
            return null;
        },
        getFrameworkInfo(row) {
            return resolveFramework(row?.engine || row?.architecture?.engine);
        },
        getFrameworkKey(row) {
            return row?.framework_key || this.getFrameworkInfo(row).frameworkKey;
        },
        getFrameworkLabel(row) {
            return row?.framework_label || this.getFrameworkInfo(row).frameworkLabel;
        },
        syncSelectionLocks(selection = []) {
            const first = Array.isArray(selection) && selection.length ? selection[0] : null;
            this.lockedDatasetId = first ? this.getDatasetScopeKey(first) : null;
            this.lockedFrameworkKey = first ? this.getFrameworkKey(first) : null;
        },
        validateSelectionCompatibility(selection = []) {
            const list = Array.isArray(selection) ? selection : [];
            if (!list.length) return null;
            const base = list[0];
            const baseDataset = this.getDatasetScopeKey(base);
            const baseFramework = this.getFrameworkInfo(base);
            for (const row of list.slice(1)) {
                const currentDataset = this.getDatasetScopeKey(row);
                if (baseDataset && currentDataset && baseDataset !== currentDataset) {
                    return "仅支持同数据集任务对比";
                }
                if (!isFrameworkCompatible(baseFramework, this.getFrameworkInfo(row))) {
                    return "仅支持同框架任务对比（Paddle 仅对 Paddle，PyTorch 仅对 PyTorch）";
                }
            }
            return null;
        },
        checkSelectable(row) {
            if (this.tempSelection.length === 0) return true;
            const anchor = this.tempSelection[0];
            const anchorDataset = this.getDatasetScopeKey(anchor);
            const currentDataset = this.getDatasetScopeKey(row);
            if (anchorDataset && currentDataset && anchorDataset !== currentDataset) return false;
            const anchorFramework = this.getFrameworkInfo(anchor);
            const currentFramework = this.getFrameworkInfo(row);
            return isFrameworkCompatible(anchorFramework, currentFramework);
        },
        renderEpoch(row) {
             const total = row.total_epochs || this.getattr(row.parameters, 'epochs', '?');
             if (row.status === 'completed') {
                 return `${total} / ${total}`;
             }
             return `${row.current_epoch} / ${total}`;
        },
        handleSelectionChange(val) {
            this.tempSelection = val;
            this.syncSelectionLocks(this.tempSelection);
        },
        confirmSelection() {
            if (this.tempSelection.length < 1) return;
            if (this.tempSelection.length > 7) {
                this.$message.warning('最多只能选择 7 个模型进行对比');
                return;
            }
            const incompatibleMessage = this.validateSelectionCompatibility(this.tempSelection);
            if (incompatibleMessage) {
                this.$message.warning(incompatibleMessage);
                return;
            }
            this.selectedRuns = [...this.tempSelection];
            this.syncSelectionLocks(this.selectedRuns);
            this.showSelector = false;
        },
        
        async loadComparisonData() {
            if (this.selectedRuns.length === 0) return;
            
            const ids = this.selectedRuns.map(r => r.job_id || r.run_id);
            const incompatibleMessage = this.validateSelectionCompatibility(this.selectedRuns);
            if (incompatibleMessage) {
                this.$message.warning(incompatibleMessage);
                return;
            }
            this.syncBaselineAfterSelectionChange();
            this.loadingParams = true;
            this.loadingCurves = true;
            
            // 1. Fetch Comparison Data (Parameters)
            try {
                this.compareData = await CompareTrainingRuns(ids);
                await this.loadPersistedBaseline();
                this.$nextTick(() => {
                    this.reflowParamsTable();
                });
            } catch (e) {
                const detail = e?.data?.detail || e?.data || {};
                if (Number(e?.status) === 409) {
                    this.$message.error(detail?.message || '仅支持同框架任务对比');
                } else {
                    this.$message.error('获取对比数据失败');
                }
                this.compareData = null;
                this.loadingCurves = false;
                return;
            } finally {
                this.loadingParams = false;
            }
            
            // 2. Fetch Curves Data (one by one)
            this.metricsData = {};
            const promises = ids.map(id => FetchTrainingJobsMetrics_detailed(id).then(res => ({ id, res })));
            
            try {
                const results = await Promise.all(promises);
                const newMetricsData = {};
                results.forEach(({ id, res }) => {
                    newMetricsData[id] = res.metrics; 
                });
                // Use Vue.set or reassign to trigger reactivity
                this.metricsData = newMetricsData;
                
                console.log('Metrics Data Loaded:', Object.keys(this.metricsData));

                // Force re-render of params table by triggering a view update
                this.$nextTick(() => {
                    if (this.activeTab === 'curves') {
                        this.renderCharts();
                    }
                    this.reflowParamsTable();
                    // Force computed to recalculate
                    this.$forceUpdate();
                });
            } catch (e) {
                console.error(e);
                this.$message.error('部分曲线数据加载失败');
            } finally {
                this.loadingCurves = false;
            }
        },
        
        resizeCharts() {
            Object.values(this.chartInstances).forEach(chart => {
                chart && chart.resize();
            });
        },
        
        renderCharts() {
            // Debugging
            console.log('Rendering Charts. selectedRuns:', this.selectedRuns.length);
            console.log('Refs:', !!this.$refs.boxLossChart, !!this.$refs.clsLossChart, !!this.$refs.dflLossChart);

            if (!this.$refs.boxLossChart) {
                console.warn('Chart refs not ready');
                return;
            }
            
            const runNames = {};
            this.compareData?.runs.forEach((r) => {
                const keys = [r?.run_id, r?.job_id];
                keys.forEach((raw) => {
                    const key = String(raw || '').trim();
                    if (!key) return;
                    runNames[key] = r.name;
                    runNames[key.toLowerCase()] = r.name;
                });
            });
            
            // Helper to build series
            const getSeries = (metricKey) => {
                return this.selectedRuns.map(run => {
                    const rid = this.getRunId(run);
                    const ridKey = String(rid || '');
                    const dataObj = this.metricsData[ridKey] || this.metricsData[ridKey.toLowerCase()] || {};
                    const finalKey = this.resolveMetricSeriesKey(dataObj, metricKey);
                    const data = finalKey ? (Array.isArray(dataObj[finalKey]) ? dataObj[finalKey] : []) : [];
                    console.log(`Series ${metricKey} (resolved: ${finalKey || '-'}) for ${ridKey}:`, data.length);
                    
                    return {
                        name: runNames[ridKey] || run.name,
                        type: 'line',
                        smooth: true,
                        showSymbol: false,
                        data: data.map((v) => {
                            const numeric = this.toFiniteNumber(v);
                            return numeric === null ? 0 : numeric;
                        })
                    };
                });
            };
            
            const commonOption = {
                tooltip: { trigger: 'axis' },
                legend: { type: 'scroll', top: 0 },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'category' }, 
                yAxis: { type: 'value', min: 'dataMin' }
            };

            // 1. Loss split into Box, Cls, DFL
            // Pass the SUFFIX we want to find
            const boxSeries = getSeries('box_loss');
            this.initChart('boxLoss', this.$refs.boxLossChart, { ...commonOption, series: boxSeries });

            const clsSeries = getSeries('cls_loss');
            this.initChart('clsLoss', this.$refs.clsLossChart, { ...commonOption, series: clsSeries });

            const dflSeries = getSeries('dfl_loss');
            this.initChart('dflLoss', this.$refs.dflLossChart, { ...commonOption, series: dflSeries });
            
            // 2. mAP 50
            const map50Series = getSeries('metrics/mAP50(B)');
            this.initChart('map50', this.$refs.map50Chart, { ...commonOption, series: map50Series });

            // 3. mAP 50-95
            const mapSeries = getSeries('metrics/mAP50-95(B)');
            this.initChart('map', this.$refs.mapChart, { ...commonOption, series: mapSeries });
            
            // 4. Precision
            const pSeries = getSeries('metrics/precision(B)');
            this.initChart('precision', this.$refs.precisionChart, { ...commonOption, series: pSeries });
            
            // 5. Recall
            const rSeries = getSeries('metrics/recall(B)');
            this.initChart('recall', this.$refs.recallChart, { ...commonOption, series: rSeries });
        },
        
        initChart(key, el, option) {
            if (!el) return;
            if (this.chartInstances[key]) {
                this.chartInstances[key].dispose();
            }
            try {
                const chart = echarts.init(el);
                chart.setOption(option);
                this.chartInstances[key] = chart;
            } catch (e) {
                console.error(`Failed to init chart ${key}`, e);
            }
        }
    }
};
</script>

<style scoped>
.comparison-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow: hidden;
}

.header-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    padding-bottom: 1rem;
    flex-shrink: 0;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}
.header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.tool-icon {
    font-size: 1.5rem;
    color: var(--color-primary);
    background: rgba(59, 130, 246, 0.1);
    padding: 0.75rem;
    border-radius: var(--radius-md);
}

.header-left h3 { margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-main); }
.subtitle { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }

.content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: 1rem;
}

.tabs-header {
    display: flex;
    gap: 1rem;
    border-bottom: 1px solid rgba(0,0,0,0.1);
    padding-bottom: 0.5rem;
}

.tab-item {
    padding: 0.5rem 1rem;
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-weight: 600;
    color: var(--text-secondary);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.tab-item:hover { background: rgba(255,255,255,0.5); }
.tab-item.active { background: white; color: var(--color-primary); box-shadow: var(--shadow-sm); }

.tab-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

/* Charts Grid */
.charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1rem;
    padding-bottom: 1rem;
}

.chart-card {
    background: rgba(255,255,255,0.6);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    height: 350px;
}

.chart-header {
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    color: var(--text-main);
}

.chart-body { flex: 1; min-height: 0; }

/* Params Table */
.params-table-wrapper {
    flex: 1;
    background: white;
    padding: 1rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.baseline-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
}

.baseline-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.baseline-label {
    font-weight: 600;
    color: var(--text-main);
}

.baseline-select {
    width: 240px;
}

.baseline-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.section-subtitle {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 0.75rem;
}

.baseline-diff-wrapper,
.recommend-wrapper {
    margin-top: 1rem;
    padding: 1rem;
    background: #fff;
}

.metric-diff-cell {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.metric-raw {
    color: var(--text-main);
}

.metric-delta {
    font-size: 0.82rem;
    font-weight: 600;
}

.metric-delta.improved {
    color: #67c23a;
}

.metric-delta.degraded {
    color: #f56c6c;
}

.metric-delta.neutral {
    color: #909399;
}

.recommend-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
}

.recommend-card {
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.7);
}

.recommend-title {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
}

.recommend-model {
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 0.25rem;
}

.recommend-reason,
.recommend-empty {
    font-size: 0.82rem;
    color: var(--text-secondary);
}

.diff-val {
    color: #e6a23c;
    font-weight: 600;
}

/* Empty State */
.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    gap: 1rem;
}
.empty-state i { font-size: 3rem; color: #cbd5e1; }

/* Selector Dialog */
.selector-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* Use strict height to ensure space */
    height: 600px;
}


.filter-bar { display: flex; gap: 1rem; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
.selection-info { float: left; line-height: 32px; font-weight: 600; color: var(--color-primary); }


</style>
