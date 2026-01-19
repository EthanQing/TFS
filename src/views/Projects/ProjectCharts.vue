<template>
<div class="projectsCharts">
        <div class="title">
                <el-button size="mini" type="text" class="back-btn" @click="goBackToProjectDetail">
                    <span class="back-arrow"></span>
                    <span class="back-text">返回</span>
                </el-button>
                <span class="model-title-text">{{ modelTitle }}</span>
        </div>
    <div class="secondLine">
        <div class="updateTime">
            <i class="el-icon-time updateTimeIcon" aria-hidden="true"></i>
            <span>{{ updateTimeText }}</span>
        </div>
        <div class="rightLine" v-if="!loading">
            <span>{{ modelArchitecture }}</span>
            <span>预训练</span>
            <div>{{ usePretrained ? 'Yes' : 'No' }}</div>
            <span></span>
            <span>时期</span>
            <div>{{ epochs || '-' }}</div>
            <span>图片大小</span>
            <div>{{ imageSize || '-' }}</div>
            <span>耐心</span>
            <div>{{ patience || '-' }}</div>
            <span>缓存</span>
            <div>{{ cache || '-' }}</div>
            <span>设备</span>
            <div>{{ device || '-' }}</div>
            <span>批量大小</span>
            <div>{{ batchSize || '-' }}</div>
        </div>
        <div class="loading-info" v-else>
            <i class="el-icon-loading"></i>
            <span>正在加载模型信息...</span>
        </div>
    </div>
    <div class="searchPart">
        <div 
            :class="{ active: activeTab === 'train' }"
            @click="setActiveTab('train'),goTrainPart()"
        >训练</div>
        <div 
            :class="{ active: activeTab === 'config' }"
            @click="setActiveTab('config'),goConfiguration()"
        >配置</div>
        <div 
            :class="{ active: activeTab === 'logs' }"
            @click="setActiveTab('logs'),goLogsPart()"
        >日志</div>
        <!-- <div 
            :class="{ active: activeTab === 'charts' }"
            @click="setActiveTab('charts'),goChartsPart()"
        >图表</div>-->
        <div 
            :class="{ active: activeTab === 'preview' }"
            @click="setActiveTab('preview'),goPreviewPart()"
        >预览</div> 
    </div>
    <keep-alive>
    <router-view></router-view>
    </keep-alive>
</div>
</template>

<script>
import { fetchTrainingJobs, FetchTrainingJobParameters } from '@/api/training';
import { API_BASE, WS_BASE } from '@/utils/request';

export default {
    name: 'ProjectsCharts',
    data() {
        return {
            activeTab: 'train', // 默认选中"训练"
            jobId: null,
            loading: false,
            trainJobInfo: null,
            trainJobParameters: null
        }
    },
    provide() {
        // 为子组件暴露统一基础地址（HTTP/WS）
        return {
            $API_BASE: () => API_BASE,
            $WS_BASE: () => WS_BASE
        }
    },
    computed: {
        modelTitle() {
            if (this.trainJobInfo) {
                const architecture = this.trainJobInfo.architecture?.model_variant || 'Unknown';
                const jobName = this.trainJobInfo.job_name || '';
                return `${architecture} - ${jobName}`;
            }
            return '模型详情';
        },
        modelArchitecture() {
            return this.trainJobInfo?.architecture?.model_variant || 'Unknown';
        },
        updateTimeText() {
            if (this.trainJobInfo?.created_at) {
                const createTime = new Date(this.trainJobInfo.created_at);
                const now = new Date();
                const diffTime = Math.abs(now - createTime);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    return '1天前创建';
                } else if (diffDays < 30) {
                    return `${diffDays}天前创建`;
                } else if (diffDays < 365) {
                    const months = Math.floor(diffDays / 30);
                    return `${months}个月前创建`;
                } else {
                    const years = Math.floor(diffDays / 365);
                    return `${years}年前创建`;
                }
            }
            return '未知时间';
        },
        epochs() {
            return this.trainJobParameters?.epochs || this.trainJobInfo?.parameters?.epochs;
        },
        imageSize() {
            return this.trainJobParameters?.img_size || this.trainJobParameters?.imgsz || this.trainJobInfo?.parameters?.img_size;
        },
        patience() {
            return this.trainJobParameters?.patience || this.trainJobInfo?.parameters?.patience;
        },
        cache() {
            const cacheValue = this.trainJobParameters?.cache || this.trainJobInfo?.parameters?.cache;
            return cacheValue ? String(cacheValue).charAt(0).toUpperCase() + String(cacheValue).slice(1) : 'RAM';
        },
        device() {
            const deviceValue = this.trainJobParameters?.device || this.trainJobInfo?.parameters?.device;
            if (deviceValue === 0 || deviceValue === '0') {
                return 'GPU';
            } else if (deviceValue === 'cpu') {
                return 'CPU';
            }
            return deviceValue || 'Auto';
        },
        batchSize() {
            return this.trainJobParameters?.batch_size || this.trainJobParameters?.batch || this.trainJobInfo?.parameters?.batch_size;
        },
        usePretrained() {
            return this.trainJobParameters?.use_pretrained || this.trainJobInfo?.parameters?.use_pretrained || false;
        }
    },
    created() {
        // 获取当前jobId
        this.getJobId();
        
        // 根据当前路径设置激活的选项卡
        if (this.$route.path.includes('/projectscharts/trainpart')) {
            this.activeTab = 'train';
        } else if (this.$route.path.includes('/projectscharts/logs')) {
            this.activeTab = 'logs';
        } else if (this.$route.path.includes('/projectscharts/configuration')) {
            this.activeTab = 'config';
        } else if (this.$route.path.includes('/projectscharts/chartspart')) {
            this.activeTab = 'charts';
        } else if (this.$route.path.includes('/projectscharts/previewpart')) {
            this.activeTab = 'preview';
        }
    },
    watch: {
        '$route.query.jobId': {
            handler(newJobId) {
                if (newJobId && newJobId !== this.jobId) {
                    this.jobId = newJobId;
                    localStorage.setItem('currentJobId', newJobId);
                    this.loadJobDetails(newJobId);
                }
            },
            immediate: true
        }
    },
    methods: {
        setActiveTab(tab) {
            this.activeTab = tab;
        },
        goBackToProjectDetail(){
            const pid = this.$route.query.projectId || (this.trainJobInfo && (this.trainJobInfo.project_id || this.trainJobInfo.project?.project_id))
            if (pid) this.$router.push({ path: '/projectsdetail', query: { projectId: pid } })
            else this.$router.push({ path: '/projects' })
        },
        getJobId() {
            // 优先从路由参数获取
            const routeJobId = this.$route.query.jobId;
            if (routeJobId) {
                this.jobId = routeJobId;
                localStorage.setItem('currentJobId', routeJobId);
                this.loadJobDetails(routeJobId);
            } else {
                // 从localStorage获取
                const storedJobId = localStorage.getItem('currentJobId');
                if (storedJobId) {
                    this.jobId = storedJobId;
                    this.loadJobDetails(storedJobId);
                }
            }
        },
        
        async loadJobDetails(jobId) {
            if (!jobId) return;
            
            this.loading = true;
            try {
                // 并行获取训练任务列表和参数
                const [jobsResponse, parametersResponse] = await Promise.allSettled([
                    fetchTrainingJobs(),
                    FetchTrainingJobParameters(jobId)
                ]);
                
                // 处理训练任务信息
                if (jobsResponse.status === 'fulfilled' && jobsResponse.value) {
                    const currentJob = jobsResponse.value.find(job => job.job_id === jobId);
                    if (currentJob) {
                        this.trainJobInfo = currentJob;
                    }
                }
                
                // 处理参数信息
                if (parametersResponse.status === 'fulfilled' && parametersResponse.value) {
                    this.trainJobParameters = parametersResponse.value;
                }
                
            } catch (error) {
                console.error('获取任务详情失败:', error);
            } finally {
                this.loading = false;
            }
        },
        goTrainPart(){
            if(this.$route.path!=='/projectscharts/trainpart'){
                this.$router.push({
                    path: '/projectscharts/trainpart',
                    query: { jobId: this.jobId }
                });
            }
        },
        goConfiguration(){
            if(this.$route.path!=='/projectscharts/configuration'){
                this.$router.push({
                    path: '/projectscharts/configuration',
                    query: { jobId: this.jobId }
                });
            }
        },
        goLogsPart(){
            if(this.$route.path!=='/projectscharts/logs'){
                this.$router.push({
                    path: '/projectscharts/logs',
                    query: { jobId: this.jobId }
                });
            }
        },
        goChartsPart(){
             if(this.$route.path!=='/projectscharts/chartspart'){
                this.$router.push({
                    path: '/projectscharts/chartspart',
                    query: { jobId: this.jobId }
                });
            }
        },
        goPreviewPart(){
            if(this.$route.path!=='/projectscharts/previewpart'){
                this.$router.push({
                    path: '/projectscharts/previewpart',
                    query: { jobId: this.jobId }
                });
            }
        }
    }
}
</script>

<style scoped>
.projectsCharts{
    color: #111F68;
}
.updateTime,.secondLine,.rightLine{
    display:flex ;
    align-items: center;
}
.updateTime{
    margin-right: 200px;
}
.updateTimeIcon{
    font-size: 24px;
    width: 30px;
    height: 30px;
    margin-right: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.title{
    font-size: 20px;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    color: #111F68;
}
/* 返回按钮统一样式 */
.back-btn {
    margin-right: 10px;
    padding: 0 6px !important;
    height: 24px;
    line-height: 24px;
    display: inline-flex;
    align-items: center;
    color: #111F68 !important;
    font-weight: 500;
    font-size: 14px;
    margin-top: 6px;
}
.back-btn:hover { color: #182a8f !important; }
.back-btn .back-arrow { 
    display: inline-block; 
    width: 8px; 
    height: 8px; 
    border-left: 2px solid currentColor; 
    border-bottom: 2px solid currentColor; 
    transform: rotate(45deg); 
    margin-right: 4px; 
    position: relative;
    top: 0; 
}
.back-btn .back-text { display:inline-flex; align-items:center; line-height:1; }
.model-title-text { line-height:1; display:inline-flex; align-items:center; }
.rightLine div{
    width: 50px;
    height: 40px;
    background-color: #F3F3F3;
    border-radius: 15px;
    text-align: center;
    line-height: 40px;
    margin-right: 20px;
}
.rightLine span{
    margin-right: 10px;
}
.rightLine span:nth-child(1){
    margin-right: 30px;
}
.searchPart{
    display: flex;
}
.searchPart div{
    font-size: 15px;
    width: 90px;
    height: 45px;
    line-height: 45px;
    text-align: center;
    margin: 15px 12px;
    border-bottom: 2px solid transparent; /* 默认无下划线 */
    cursor: pointer; /* 鼠标指针样式 */
    transition: all 0.3s; /* 平滑过渡效果 */
}
.searchPart div.active {
    border-bottom: 2px solid #111F68; /* 激活时下划线 */
}

/* 加载状态样式 */
.loading-info {
    display: flex;
    align-items: center;
    color: #666;
    font-size: 14px;
}

.loading-info i {
    font-size: 16px;
    margin-right: 8px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
