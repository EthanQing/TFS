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
                    <i class="el-icon-s-grid"></i> 参数对比
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
                     <el-table ref="paramsTable" :data="paramRows" row-key="key" border style="width: 100%" height="100%">
                        <el-table-column prop="key" label="参数" width="180" fixed></el-table-column>
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
import { fetchProjects } from "@/api/projects";
import { fetchTrainingJobsPage, FetchTrainingJobsMetrics_detailed, CompareTrainingRuns } from "@/api/training";

export default {
    name: 'ModelComparison',
    data() {
        return {
            activeTab: 'curves',
            showSelector: false,
            loadingList: false,
            loadingCurves: false,
            loadingParams: false,
            
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
            
            // Chart instances
            chartInstances: {}
        };
    },
    computed: {
        paramRows() {
            if (!this.compareData || !this.compareData.runs) return [];
            
            // Build a map from compareData.runs using both job_id and run_id as possible keys
            const runsMap = {};
            this.compareData.runs.forEach(r => {
                const key = r.job_id || r.run_id;
                runsMap[key] = r;
                // Also map by lowercase for case-insensitive matching
                if (key) runsMap[key.toLowerCase()] = r;
            });
            
            // Collect all unique keys from parameters
            const keySet = new Set();
            const runs = this.compareData.runs;
            runs.forEach(r => {
                if (r.parameters) {
                    Object.keys(r.parameters).forEach(k => keySet.add(k));
                }
            });
            // Also add metrics summary
            keySet.add('best_mAP_50');
            keySet.add('best_mAP_50_95');
            keySet.add('model_size_mb');

            const rows = [];
            Array.from(keySet).sort().forEach(key => {
                const row = { key };
                const values = [];
                
                // Use selectedRuns to ensure we match metricsData keys
                this.selectedRuns.forEach(selectedRun => {
                    let val = null;
                    const rid = selectedRun.job_id || selectedRun.run_id;
                    
                    // Find corresponding run data from compareData
                    const r = runsMap[rid] || runsMap[rid?.toLowerCase()] || {};

                    if (key === 'model_size_mb') val = r.model_size_mb;
                    else if (key === 'best_mAP_50') {
                        // Try API provided best_metrics first
                        val = r.best_metrics?.['metrics/mAP50(B)'];
                        // Fallback: calculate from curves with fuzzy key matching
                        if ((val === null || val === undefined)) {
                            const dataObj = this.metricsData[rid];
                            if (dataObj) {
                                const foundKey = Object.keys(dataObj).find(k => k.includes('mAP50') && !k.includes('mAP50-95'));
                                if (foundKey) {
                                    const arr = dataObj[foundKey];
                                    if (arr && arr.length) val = Math.max(...arr.filter(n => typeof n === 'number'));
                                }
                            }
                        }
                    } 
                    else if (key === 'best_mAP_50_95') {
                        val = r.best_metrics?.['metrics/mAP50-95(B)'];
                        // Fallback: calculate from curves with fuzzy key matching
                        if ((val === null || val === undefined)) {
                            const dataObj = this.metricsData[rid];
                            if (dataObj) {
                                const foundKey = Object.keys(dataObj).find(k => k.includes('mAP50-95'));
                                if (foundKey) {
                                    const arr = dataObj[foundKey];
                                    if (arr && arr.length) val = Math.max(...arr.filter(n => typeof n === 'number'));
                                }
                            }
                        }
                    }
                    else val = r.parameters?.[key];
                    
                    row[rid] = val;
                    values.push(JSON.stringify(val));
                });
                
                // Mark if different
                row.isDiff = new Set(values).size > 1;
                rows.push(row);
            });
            
            // Sort: alphabetically by key name
            return rows.sort((a, b) => a.key.localeCompare(b.key));
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
            }
        },
        selectedRuns() {
            if (this.selectedRuns.length) {
                this.loadComparisonData();
            }
        },
        showSelector(val) {
            if (val) {
                this.tempSelection = [...this.selectedRuns];
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
        reflowParamsTable() {
            const table = this.$refs.paramsTable;
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
        getDatasetId(row) {
            // Traverse possible paths to dataset_id
            return row.project?.dataset?.dataset_id || row.project?.dataset_id || row.dataset_version?.dataset_id;
        },
        checkSelectable(row) {
            if (this.tempSelection.length === 0) return true;
            const targetId = this.getDatasetId(this.tempSelection[0]);
            const currentId = this.getDatasetId(row);
            // If identifiers are missing, assume compatible or let user decide? Better to be strict if we rely on it.
            // If either is missing, maybe allow? For now, enforcing equality if both exist.
            if (!targetId || !currentId) return true; 
            return String(targetId) === String(currentId);
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
        },
        confirmSelection() {
            if (this.tempSelection.length < 1) return;
            if (this.tempSelection.length > 7) {
                this.$message.warning('最多只能选择 7 个模型进行对比');
                return;
            }
            this.selectedRuns = [...this.tempSelection];
            this.showSelector = false;
        },
        
        async loadComparisonData() {
            if (this.selectedRuns.length === 0) return;
            
            const ids = this.selectedRuns.map(r => r.job_id || r.run_id);
            this.loadingParams = true;
            this.loadingCurves = true;
            
            // 1. Fetch Comparison Data (Parameters)
            try {
                this.compareData = await CompareTrainingRuns(ids);
                this.$nextTick(() => {
                    this.reflowParamsTable();
                });
            } catch (e) {
                this.$message.error('获取对比数据失败');
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
            this.compareData?.runs.forEach(r => runNames[r.run_id] = r.name);
            
            // Helper to build series
            const getSeries = (metricKey) => {
                return this.selectedRuns.map(run => {
                    const rid = run.job_id || run.run_id;
                    const dataObj = this.metricsData[rid] || {};
                    // Strict match first
                    let finalKey = metricKey;
                    
                    // If metricKey is a specific known suffix (like 'box_loss'), try to fuzzy find
                    if (!dataObj[finalKey] && ['box_loss', 'cls_loss', 'dfl_loss'].includes(metricKey)) {
                         // Try finding keys ending with /metricKey or exactly metricKey
                         const candidates = Object.keys(dataObj).filter(k => k.endsWith(`/${metricKey}`) || k === metricKey);
                         // Prefer 'train/' prefix
                         const trainKey = candidates.find(k => k.startsWith('train/'));
                         if (trainKey) finalKey = trainKey;
                         else if (candidates.length > 0) finalKey = candidates[0];
                    }
                    
                    const data = dataObj[finalKey] || [];
                    console.log(`Series ${metricKey} (resolved: ${finalKey}) for ${rid}:`, data.length);
                    
                    return {
                        name: runNames[rid] || run.name,
                        type: 'line',
                        smooth: true,
                        showSymbol: false,
                        data: data.map(v => v === null ? 0 : v) 
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
