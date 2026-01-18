<template>
<div>
    <!-- 实时训练进度（WebSocket） -->
    <div v-if="streamStatus" class="epoch-progress">
        <div class="row">
            <span>状态: {{ streamStatus }}</span>
            <span>轮次: {{ currentEpoch }}/{{ totalEpochs || '-'}} </span>
        </div>
        <div class="bar">
            <div class="bar-inner" :style="{ width: epochPercent + '%' }"></div>
        </div>
    </div>
    <!-- 无数据状态显示 -->
    <div v-if="!loading && !metrics && !error && !streamStatus" class="no-data-container">
        <i class="el-icon-info"></i>
        <span>暂无数据</span>
    </div>
    
    <!-- 加载状态显示 -->
    <div v-if="loading" class="loading-container">
        <i class="el-icon-loading"></i>
        <span>正在加载数据...</span>
    </div>
    
    <!-- 错误状态显示 -->
    <div v-if="error" class="error-message">
        <i class="el-icon-error"></i>
        <span>{{ error }}</span>
    </div>
    
    <!-- 数据展示区域 - 仅在有数据时显示 -->
    <div v-if="metrics" class="metrics-container">
        <div class="chart-group">
            <chart :metrics="metrics" chart-type="metrics" :total-epoch="totalEpochs || metrics.total_epochs"></chart>
        </div>
        
        <div class="loss-charts-container">
            <div class="loss-chart">
                <span class="chartTitle">Box Loss 边界框损失</span>
                <chart :metrics="metrics" chart-type="box_loss" :total-epoch="totalEpochs || metrics.total_epochs"></chart>
            </div>
            
            <div class="loss-chart">
                <span class="chartTitle">Class Loss 类别损失</span>
                <chart :metrics="metrics" chart-type="cls_loss" :total-epoch="totalEpochs || metrics.total_epochs"></chart>
            </div>
            
            <div class="loss-chart">
                <span class="chartTitle">DFL Loss 分布焦点损失</span>
                <chart :metrics="metrics" chart-type="dfl_loss" :total-epoch="totalEpochs || metrics.total_epochs"></chart>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import chart from '../chart/chart.vue';
import {
    FetchTrainingJobsStatus,
    FetchTrainingJobsMetrics_detailed
} from '@/api';

export default {
    name: 'TrainPart',
    components: {
        chart
    },
    inject: ['$API_BASE', '$WS_BASE'],
    data() {
        return {
            jobId: null,
            status: null,
            metrics: null,
            error: null,
            loading: false, // 加载状态标记
            statusPollingInterval: null, // 状态轮询间隔
            metricsPollingInterval: null, // 指标轮询间隔
            hasCompletedMetricsFetch: false, // 标记是否已经获取过完成状态的指标
            // WebSocket 流
            ws: null,
            streamStatus: null,
            currentEpoch: 0,
            totalEpochs: 0,
            seededFromHttp: false,
        };
    },
    computed: {
        epochPercent() {
            const t = Number(this.totalEpochs) || 0;
            const c = Number(this.currentEpoch) || 0;
            if (!t || c <= 0) return 0;
            return Math.max(0, Math.min(100, (c / t) * 100));
        }
    },
    watch: {
        '$route.query.jobId': {
            immediate: true,
            handler(newJobId) {
                if (newJobId) {
                    this.jobId = newJobId;
                    // 当 job ID 改变时，清理所有轮询并重新开始
                    this.cleanupAllPolling();
            this.hasCompletedMetricsFetch = false;
            this.seededFromHttp = false;
                    this.metrics = null; // 重置 metrics
                    this.error = null; // 重置错误状态
                    this.startStatusPolling();
                    // 保存到localStorage，以便其他组件访问
                    localStorage.setItem('currentJobId', newJobId);
                }
            }
        }
    },
    activated() {
        // 当使用keep-alive缓存的组件被激活时，检查jobId
        const storedJobId = localStorage.getItem('currentJobId');
        const routeJobId = this.$route.query.jobId;
        
        if (!this.jobId && storedJobId) {
            this.jobId = storedJobId;
            this.cleanupAllPolling();
            this.hasCompletedMetricsFetch = false;
            this.seededFromHttp = false;
            this.metrics = null;
            this.error = null;
            this.startStatusPolling();
        } else if (routeJobId && this.jobId !== routeJobId) {
            this.jobId = routeJobId;
            this.cleanupAllPolling();
            this.hasCompletedMetricsFetch = false;
            this.seededFromHttp = false;
            this.metrics = null;
            this.error = null;
            this.startStatusPolling();
        }
    },
    methods: {
        // WebSocket: 连接
        connectStream() {
            if (!this.jobId) return;
            if (this.status !== 'running') return;
            this.closeStream();
            // 优先使用显式 WS_BASE，否则根据 HTTP 基础地址推导 ws/wss
            let wsBase = (this.$WS_BASE && this.$WS_BASE()) || '';
            if (!wsBase) {
                const isHttps = window.location.protocol === 'https:';
                const httpBase = (this.$API_BASE && this.$API_BASE()) || window.location.origin;
                wsBase = httpBase.replace(/^http(s?):\/\//, isHttps ? 'wss://' : 'ws://');
            }
            const url = `${wsBase}/api/v1/training-jobs/${this.jobId}/metrics/stream`;
            try {
                this.ws = new WebSocket(url);
                this.ws.onopen = () => {
                    this.streamStatus = 'running';
                    try { console.log('[WS] open:', url); } catch (_) {}
                    // 首次连接后，用 HTTP 详细指标补齐历史曲线
                    if (!this.seededFromHttp) {
                        this.fetchMetrics().then(() => { this.seededFromHttp = true; }).catch(() => {});
                    }
                };
                this.ws.onmessage = (e) => {
                    try {
                        // 打印原始消息文本长度，避免巨大日志
                        try { console.log('[WS] raw length:', (e && e.data && e.data.length) || 0); } catch (_) {}
                        this.handleStreamMessage(JSON.parse(e.data));
                    } catch (_) {}
                };
                this.ws.onerror = (err) => {
                    this.streamStatus = null;
                    try { console.error('[WS] error:', err); } catch (_) {}
                };
                this.ws.onclose = (evt) => {
                    this.streamStatus = null;
                    try { console.log('[WS] close:', evt && evt.code, evt && evt.reason); } catch (_) {}
                };
            } catch (_) {}
        },
        // WebSocket: 处理消息
        handleStreamMessage(payload) {
            if (!payload) return;
            if (payload.error) { this.error = payload.error; return; }
            try { console.log('[WS] payload:', payload); } catch (_) {}
            this.streamStatus = payload.status || this.streamStatus;
            this.currentEpoch = payload.current_epoch || 0;
            this.totalEpochs = payload.total_epochs || this.totalEpochs || 0;
            if (!this.metrics) {
                this.metrics = { metrics: {}, total_epochs: this.totalEpochs };
            }
            this.metrics.total_epochs = this.totalEpochs;
            const epochIdx = Math.max(0, Number(this.currentEpoch) || 0);
            const kv = payload.metrics || {};
            try { console.log('[WS] epochIdx:', epochIdx, 'keys:', Object.keys(kv || {})); } catch (_) {}
            Object.keys(kv).forEach(key => {
                const v = kv[key];
                if (Array.isArray(v)) {
                    const series = [];
                    v.forEach((it, i) => {
                        const e = (it && typeof it.epoch === 'number') ? it.epoch : i;
                        const val = (it && typeof it.value !== 'undefined') ? Number(it.value) : Number(it);
                        series[e] = Number.isFinite(val) ? val : null;
                    });
                    // 合并：如果已存在历史数组，按位保留已有值，缺位用新值或保持
                    if (!this.metrics.metrics[key]) this.$set(this.metrics.metrics, key, []);
                    const arr = this.metrics.metrics[key];
                    const maxLen = Math.max(arr.length, series.length);
                    for (let i = 0; i < maxLen; i++) {
                        const nv = series[i];
                        if (typeof nv !== 'undefined') {
                            arr[i] = nv;
                        } else if (typeof arr[i] === 'undefined') {
                            arr[i] = null;
                        }
                    }
                } else {
                    if (!this.metrics.metrics[key]) this.$set(this.metrics.metrics, key, []);
                    const arr = this.metrics.metrics[key];
                    while (arr.length < epochIdx) arr.push(null);
                    arr[epochIdx] = Number.isFinite(Number(v)) ? Number(v) : null;
                }
            });
        },
        // WebSocket: 关闭
        closeStream() {
            if (this.ws) { try { this.ws.close(); } catch (_) {} finally { this.ws = null; } }
        },
        // 开始状态轮询
        startStatusPolling() {
            if (!this.jobId) return;

            // 立即获取一次状态
            this.fetchStatus();

            // 设置状态轮询间隔（5秒）
            this.statusPollingInterval = setInterval(this.fetchStatus, 5000);
        },
        
        // 获取任务状态
        async fetchStatus() {
            if (!this.jobId) return;

            // 设置加载状态
            this.loading = true;
            
            try {
                const statusResponse = await FetchTrainingJobsStatus(this.jobId);
                this.status = statusResponse.status;
                console.log('Status fetched:', this.status);

                // 根据状态决定下一步操作
                if (this.status === 'completed') {
                    // 完成状态：只获取一次详细指标
                    if (!this.hasCompletedMetricsFetch) {
                        await this.fetchMetrics();
                        this.hasCompletedMetricsFetch = true;
                    }
                    // 停止所有轮询
                    this.cleanupAllPolling();
                    this.closeStream();
                } else if (this.status === 'running') {
                    // 运行状态才连接 WebSocket 实时流
                    if (!this.ws || this.ws.readyState !== 1) {
                        this.connectStream();
                    }
                    // 启动高频指标轮询（2秒）
                    if (!this.metricsPollingInterval) {
                        this.startMetricsPolling(2000);
                    }
                } else {
                    // 其他状态：停止指标轮询（如果有的话）
                    this.cleanupMetricsPolling();
                    // 非运行状态不使用 WebSocket
                    this.closeStream();
                    
                    // 检查是否是终止状态
                    const terminalStates = ['failed', 'stopped', 'cancelled'];
                    if (terminalStates.includes(this.status)) {
                        // 终止状态：停止所有轮询
                        this.cleanupAllPolling();
                        // 终端状态且无数据时，显示暂无数据
                        if (!this.metrics) {
                            this.metrics = null;
                        }
                    }
                }
            } catch (err) {
                this.error = '获取任务状态失败，请稍后重试。';
                console.error('Error fetching status:', err);
                // 出错时停止所有轮询
                this.cleanupAllPolling();
            } finally {
                // 无论成功失败，都结束加载状态
                this.loading = false;
            }
        },
        
        // 开始指标轮询
        startMetricsPolling(intervalMs = 2000) {
            this.fetchMetrics();
            if (this.metricsPollingInterval) clearInterval(this.metricsPollingInterval);
            this.metricsPollingInterval = setInterval(this.fetchMetrics, intervalMs);
        },
        
        // 获取详细指标
        async fetchMetrics() {
            if (!this.jobId) return;

            this.loading = true;
            
            try {
                const metricsResponse = await FetchTrainingJobsMetrics_detailed(this.jobId);
                this.metrics = metricsResponse;
                console.log('Metrics fetched:', this.metrics);
            } catch (err) {
                console.error('Error fetching metrics:', err);
                // 保留之前的metrics数据，仅在首次获取失败时显示错误
                if (!this.metrics) {
                    this.error = '获取指标数据失败，请稍后重试。';
                }
            } finally {
                this.loading = false;
            }
        },
        
        // 清理状态轮询
        cleanupStatusPolling() {
            if (this.statusPollingInterval) {
                clearInterval(this.statusPollingInterval);
                this.statusPollingInterval = null;
            }
        },
        
        // 清理指标轮询
        cleanupMetricsPolling() {
            if (this.metricsPollingInterval) {
                clearInterval(this.metricsPollingInterval);
                this.metricsPollingInterval = null;
            }
        },
        
        // 清理所有轮询
        cleanupAllPolling() {
            this.cleanupStatusPolling();
            this.cleanupMetricsPolling();
            this.closeStream();
        }
    },
    beforeDestroy() {
        // 确保组件销毁时停止所有轮询
        this.cleanupAllPolling();
    },
};
</script>


<style scoped>
pre {
    background-color: #f4f4f4;
    padding: 1rem;
    border-radius: 4px;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.error-message {
    color: red;
    font-weight: bold;
}
.chartTitle{
    display: block;
    margin: 20px 0 10px 50px;
    font-size: 22px;
    font-weight: 700;
    color: #111f68;
}

.loss-chart .chartTitle {
    margin: 5px 0 5px 15px;
    font-size: 18px;
}

.chart-group{
    margin-top: 30px;
    padding: 10px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}
.loss-charts-container {
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
    padding: 15px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
    flex-wrap: wrap;
    gap: 10px;
}
.loss-chart {
    flex: 1;
    margin: 0 5px;
    max-width: 33%;
    min-width: 300px;
}

@media (max-width: 1200px) {
    .loss-charts-container {
        flex-direction: column;
    }
    
    .loss-chart {
        max-width: 100%;
        margin: 10px 0;
    }
    
    .loss-chart .chartTitle {
        margin: 5px 0 5px 0;
        text-align: center;
    }
}

@media (max-width: 768px) {
    .chart-group {
        margin-top: 20px;
        padding: 5px;
    }
    
    .loss-charts-container {
        padding: 10px;
    }
    
    .chartTitle {
        margin: 10px 0 5px 25px;
        font-size: 18px;
    }
}
/* 无数据状态样式 */
.no-data-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 50px 0;
    color: #666;
    font-size: 16px;
}

.no-data-container i {
    margin-right: 8px;
    font-size: 20px;
}

/* 加载状态样式 */
.loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 50px 0;
    color: #666;
    font-size: 16px;
}

.loading-container i {
    margin-right: 8px;
    font-size: 20px;
    animation: rotate 1.5s linear infinite;
}

/* 错误状态样式 */
.error-message {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 50px 0;
    color: #f56c6c;
    font-size: 16px;
}

.error-message i {
    margin-right: 8px;
    font-size: 20px;
}

/* 动画定义 */
@keyframes rotate {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

/* 图表容器样式（保留原有布局） */
.chart-group {
    margin-bottom: 20px;
}

.loss-charts-container {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
}

.loss-chart {
    flex: 1;
}

.chartTitle {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #333;
}
.metrics-container{
    margin-right: 50px;
}
</style>