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
import chart from '@/components/Chart/TrainingChart.vue';
import {
    FetchTrainingJobsStatus,
    FetchTrainingJobsMetrics_detailed
} from '@/api/training';

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
            progress: 0,
            seededFromHttp: false,
        };
    },
    computed: {
        epochPercent() {
            const p = Number(this.progress);
            if (Number.isFinite(p) && p > 0) return Math.max(0, Math.min(100, p));
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
            // 终态任务无需再建立 WS；避免刷新时“先连后关”导致浏览器报 1006
            const st = String(this.status || '').toLowerCase();
            const terminal = ['completed', 'failed', 'cancelled', 'deleted'];
            if (terminal.includes(st)) return;
            this.closeStream();
            // 优先使用显式 WS_BASE，否则根据 HTTP 基础地址推导 ws/wss
            let wsBase = (this.$WS_BASE && this.$WS_BASE()) || '';
            if (!wsBase) {
                const isHttps = window.location.protocol === 'https:';
                const httpBase = (this.$API_BASE && this.$API_BASE()) || window.location.origin;
                wsBase = httpBase.replace(/^http(s?):\/\//, isHttps ? 'wss://' : 'ws://');
            }
            const url = `${wsBase}/api/v2/training-runs/${this.jobId}/metrics/stream`;
            try {
                this.ws = new WebSocket(url);
                this.ws.onopen = () => {
                    this.streamStatus = this.status || 'connected';
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
            // v2 WebSocket: {type:'status'|'metric'|'event'|'done', data:{...}}
            const type = payload.type || '';
            const data = payload.data || {};

            const normalizeStatus = (s) => {
                const v = String(s || '').toLowerCase();
                if (v === 'created') return 'pending';
                return v || null;
            };

            if (type === 'status') {
                const st = normalizeStatus(data.status);
                if (st) {
                    this.status = st;
                    this.streamStatus = st;
                }
                if (Number.isFinite(Number(data.progress))) this.progress = Number(data.progress);
                // 后端 current_epoch 为 0-based，这里界面显示 1-based
                if (Number.isFinite(Number(data.current_epoch))) this.currentEpoch = Number(data.current_epoch) + 1;
                if (Number.isFinite(Number(data.total_epochs))) this.totalEpochs = Number(data.total_epochs) || this.totalEpochs || 0;

                if (!this.metrics) this.metrics = { metrics: {}, total_epochs: this.totalEpochs };
                if (this.totalEpochs) this.metrics.total_epochs = this.totalEpochs;
                return;
            }

            if (type === 'metric') {
                const epoch0 = Number(data.epoch);
                if (!Number.isFinite(epoch0) || epoch0 < 0) return;
                const idx = Math.max(0, Math.floor(epoch0));
                this.currentEpoch = Math.max(this.currentEpoch, idx + 1);
                if (Number.isFinite(Number(data.progress))) this.progress = Number(data.progress);

                if (!this.metrics) this.metrics = { metrics: {}, total_epochs: this.totalEpochs || (idx + 1) };
                this.metrics.total_epochs = this.totalEpochs || Math.max(this.metrics.total_epochs || 0, idx + 1);

                const kv = (data && data.metrics && typeof data.metrics === 'object') ? data.metrics : {};
                Object.keys(kv).forEach(key => {
                    if (!this.metrics.metrics[key]) this.$set(this.metrics.metrics, key, []);
                    const arr = this.metrics.metrics[key];
                    while (arr.length < idx) arr.push(null);
                    const n = Number(kv[key]);
                    arr[idx] = Number.isFinite(n) ? n : null;
                });
                return;
            }

            if (type === 'done') {
                const st = normalizeStatus(data.status);
                if (st) {
                    this.status = st;
                    this.streamStatus = st;
                }
                return;
            }

            // Fallback: old payload shape (keep for compatibility)
            try { console.log('[WS] payload:', payload); } catch (_) {}
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

            // 降低轮询频率：WS 为主，HTTP 仅作兜底
            this.statusPollingInterval = setInterval(this.fetchStatus, 15000);
        },
        
        // 获取任务状态
        async fetchStatus() {
            if (!this.jobId) return;

            // 设置加载状态
            this.loading = true;
            
            try {
                const statusResponse = await FetchTrainingJobsStatus(this.jobId);
                this.status = statusResponse.status;
                // HTTP 兜底也同步进度/轮次（WS 断开或任务结束时仍能显示）
                if (Number.isFinite(Number(statusResponse.progress))) this.progress = Number(statusResponse.progress);
                if (Number.isFinite(Number(statusResponse.total_epochs))) this.totalEpochs = Number(statusResponse.total_epochs) || this.totalEpochs || 0;
                if (Number.isFinite(Number(statusResponse.current_epoch))) {
                    // 后端 current_epoch 为 0-based，这里界面显示 1-based
                    this.currentEpoch = Number(statusResponse.current_epoch) + 1;
                }
                console.log('Status fetched:', this.status);

                // 根据状态决定下一步操作
                const terminalNeedMetrics = ['completed', 'failed', 'cancelled'];
                if (terminalNeedMetrics.includes(this.status)) {
                    // 终态：尽量补齐一次历史曲线（即便失败也可查看已产出的曲线）
                    if (!this.hasCompletedMetricsFetch) {
                        await this.fetchMetrics();
                        this.hasCompletedMetricsFetch = true;
                    }
                } else if (this.status === 'running') {
                    // 运行中：确保 WS 已连接，并用一次 HTTP 拉取补齐历史曲线
                    if (!this.ws || this.ws.readyState !== 1) this.connectStream();
                    if (!this.seededFromHttp) {
                        await this.fetchMetrics();
                        this.seededFromHttp = true;
                    }
                } else {
                    // 非 running（pending/queued 等）也保持 WS 连接，便于等待队列 -> running 的实时切换
                    if (!this.ws || this.ws.readyState !== 1) this.connectStream();
                }

                // 终止状态：停止轮询并关闭 WS（避免页面一直请求）
                const terminalStates = ['completed', 'failed', 'cancelled', 'deleted'];
                if (terminalStates.includes(this.status)) {
                    this.cleanupAllPolling();
                    this.closeStream();
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
