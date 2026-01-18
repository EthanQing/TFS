<template>
    <div class="projectsdetail">
        <div class="title">
                <el-button size="mini" type="text" class="back-btn" @click="goBackToProjects">
                    <span class="back-arrow"></span>
                    <span class="back-text">返回</span>
                </el-button>
        <span class="project-title-text">{{ projectInfo?.project_name || '项目详情' }}</span>
    </div>
    <button class="create-job-btn" @click="openCreateJob">添加训练任务</button>
        <div class="updateTime">
            <img src="../DataDetail/images/解锁.png" alt="">
            <span>{{ updateTimeText }}</span>
            <div class="projectMessage">
                <div class="rightMessage" v-if="!loading">
                <span>模型</span>
                <div class="circle1">{{ modelCount }}</div>
                <span>大小</span>
                <div class="circle2">{{ totalSize }}</div>
                </div>
                <div class="loading-info" v-else>
                    <i class="el-icon-loading"></i>
                    <span>正在加载项目信息...</span>
                </div>
            </div>
        </div>
        <div class="searchPart">
            <div class="overView active">概况</div>
        </div>
        <div class="secondFloor">
            <el-input v-model="searchQuery" placeholder="请输入模型名称搜索" class="input"></el-input>
            <div class="topNavigation">
                <el-menu :default-active="activeIndex" class="el-menu-demo" mode="horizontal" @select="handleSelect">
                    <el-menu-item index="1" class="nav-item">全部</el-menu-item>
                </el-menu>
            </div>
        </div>
        <div class="showList">
            <div v-if="loading" class="loading-container">
                <i class="el-icon-loading"></i>
                <span>正在加载项目模型...</span>
            </div>
            <div v-else-if="filteredModels.length === 0" class="no-data-container">
                <i class="el-icon-info"></i>
                <span>未找到匹配的模型</span>
            </div>
            <ul v-else>
                <li v-for="model in filteredModels" :key="model.job_id" @click="goProjectsCharts(model)">
                    <div class="statusBar" :class="statusClass(model.status)"></div>
                    <div class="messagePart">
                        <span class="title1">{{ model.job_name }}</span>
                        <span class="title2">{{ model.architecture?.model_variant || 'Unknown' }}</span>
                    </div>
                    <div class="detailPart">
                        <span class="detail3" v-if="model.status === 'pending'">
                            <el-button
                              type="success"
                              size="mini"
                              @click.stop="startJob(model.job_id)"
                              :loading="startingJobs && startingJobs[model.job_id]"
                              class="start-button"
                            >开始训练</el-button>
                        </span>
                        <span class="detail1">{{ model.status }}</span>
                        <span class="detail2">{{ formatProgress(model) }}</span>
                        <span class="detail-size">大小: {{ formatModelSize(model.model_size_mb) }}</span>
                        <span class="detail3">{{ formatCreateTime(model.created_at) }}</span>
                        <span class="more-options" @click.stop>
                            <el-dropdown trigger="click" @command="handlePDCommand($event, model.job_id)">
                                <span class="el-dropdown-link">
                                    <i class="el-icon-more"></i>
                                </span>
                                <el-dropdown-menu slot="dropdown">
                                    <el-dropdown-item command="delete">删除</el-dropdown-item>
                                    <el-dropdown-item command="export">导出</el-dropdown-item>
                                </el-dropdown-menu>
                            </el-dropdown>
                        </span>
                    </div>
                </li>
            </ul>
        </div>
        <!-- 创建任务弹窗（直接使用第二步组件） -->
        <el-dialog
            title=""
            :visible.sync="dialogVisible"
            :width="dialogWidth"
            :close-on-click-modal="true"
            append-to-body
            :lock-scroll="true"
            :modal="true"
            custom-class="training-dialog"
        >
            <ModelsStep2 
                :project="projectInfo"
                @task-added="onTaskAdded"
                @close="dialogVisible = false"
            />
        </el-dialog>
    </div>
</template>

<script>
import { fetchTrainingJobs, FetchProjectsDetail, startTrainingJob, DeleteTrainingJob, API_BASE, WS_BASE, FetchTrainingJobsStatus, ExportModel } from '@/api';
import { FetchTrainingJobModelSize } from '@/api'
import ModelsStep2 from '@/components/ModelsStep2/ModelsStep2.vue'

export default {
    name: 'ProjectsDetail',
    components: { ModelsStep2 },
    data() {
        return {
            searchQuery: '',
            activeIndex: '1',
            isShow: true,
            activeButton: 'model',
            projectInfo: null,
            projectModels: [],
            loading: false,
            dialogVisible: false,
            dialogWidth: '860px',
            startingJobs: {},
            wsMap: {},
            wsLimit: 5,
            statusTimer: null
        }
    },
    computed: {
        updateTimeText() {
            if (this.projectInfo?.created_at) {
                const createTime = new Date(this.projectInfo.created_at);
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
        modelCount() {
            // 优先使用Projects组件传递过来的已完成模型数量
            if (this.projectInfo && this.projectInfo.completed_models_count !== undefined) {
                return this.projectInfo.completed_models_count;
            }
            // 其次使用API返回的真实模型数量
            if (this.projectInfo && typeof this.projectInfo.model_count === 'number') {
                return this.projectInfo.model_count;
            }
            // 备用方案：从训练任务列表计算
            return this.projectModels.length || 0;
        },
        totalSize() {
            const ensureMB = v => {
                if (v === undefined || v === null || String(v).length === 0) return null
                const s = String(v).trim()
                if (/mb$/i.test(s)) return s
                const n = parseFloat(s)
                if (!isNaN(n)) return `${n}MB`
                return `${s}MB`
            }
            // 优先使用路由参数（与列表页一致）
            const q = this.$route && this.$route.query && this.$route.query.modelSize
            const fromQuery = ensureMB(q)
            if (fromQuery) return fromQuery
            // 其次使用项目信息字段
            if (this.projectInfo && this.projectInfo.total_size_mb !== undefined) {
                const v = ensureMB(this.projectInfo.total_size_mb)
                if (v) return v
            }
            if (this.projectInfo && this.projectInfo.total_size !== undefined) {
                const v = ensureMB(this.projectInfo.total_size)
                if (v) return v
            }
            // 无数据时返回 0MB（不做估算）
            return '0MB'
        },
        // 过滤并按时间倒序排序的模型列表（新->旧）
        filteredModels() {
            const source = Array.isArray(this.projectModels) ? this.projectModels : []
            const query = (this.searchQuery || '').toLowerCase()
            const list = source.filter(m => {
                if (!query) return true
                return (m.job_name || '').toLowerCase().includes(query)
            })
            const getTs = m => {
                const v = m.created_at || m.createdAt || m.created || m.updated_at || m.updatedAt
                const t = v ? new Date(v).getTime() : 0
                return Number.isFinite(t) ? t : 0
            }
            return list.sort((a, b) => getTs(b) - getTs(a))
        }
    },
    watch: {
        '$route.query.projectId': {
            handler(newProjectId) {
                if (newProjectId) {
                    this.loadProjectDetails(newProjectId);
                }
            },
            immediate: true
        }
    },
    created() {
        this.initProjectInfo();
        this.logStoredProjectInfo();
    },
    mounted() {
        // 自适应弹窗宽度
        const update = () => {
            const w = window.innerWidth || document.documentElement.clientWidth;
            if (w >= 1600) this.dialogWidth = '980px';
            else if (w >= 1400) this.dialogWidth = '920px';
            else if (w >= 1200) this.dialogWidth = '880px';
            else if (w >= 992) this.dialogWidth = '820px';
            else if (w >= 768) this.dialogWidth = '680px';
            else this.dialogWidth = '94%';
        };
        this._resizeHandler = update;
        update();
        window.addEventListener('resize', this._resizeHandler);
        // 定时兜底：每5秒刷新一次运行中任务状态
        this.statusTimer = setInterval(this.refreshRunningStatuses, 5000)
    },
    methods: {
        goBackToProjects(){
            this.$router.push({ path: '/projects' })
        },
        handleSelect(key, keyPath) {
            this.activeIndex = key
        },
        openCreateJob(){
            // 打开前刷新一次宽度，确保首次也正确
            if (this._resizeHandler) this._resizeHandler();
            this.dialogVisible = true;
        },
        onTaskAdded(){
            // 重新加载当前项目的训练任务
            const pid = this.projectInfo?.project_id || this.$route.query.projectId;
            if (pid) this.loadProjectDetails(pid);
            // 强制刷新统计显示
            setTimeout(() => {
                this.$forceUpdate();
            }, 0);
            this.dialogVisible = false;
            // 新任务开始后建立 WS
            this.$nextTick(this.initRealtime)
        },
        async startJob(jobId){
            if (!this.startingJobs) this.$set(this, 'startingJobs', {})
            this.$set(this.startingJobs, jobId, true)
            try {
                await startTrainingJob(jobId)
                this.$message.success('训练已开始')
                const pid = this.projectInfo?.project_id || this.$route.query.projectId
                if (pid) this.loadProjectDetails(pid)
                // 启动后尝试建立 WS
                this.$nextTick(this.initRealtime)
            } catch (e) {
                this.$message.error('启动训练失败')
            } finally {
                this.$set(this.startingJobs, jobId, false)
            }
        },
        handlePDCommand(command, jobId) {
            if (command === 'delete') this.deletePDJob(jobId)
            if (command === 'export') this.exportPDJob(jobId)
        },
        async exportPDJob(jobId) {
            try {
                this.$message({ type: 'info', message: '开始导出，请稍候...' })
                const res = await ExportModel(jobId)
                const raw = res && (res.download_url || res.url || res.file_url || res.path || res.link)
                if (!raw) {
                    this.$message({ type: 'error', message: '导出失败：未返回下载地址' })
                    return
                }
                const href = String(raw).startsWith('http') ? raw : `${API_BASE}${raw}`
                const a = document.createElement('a')
                a.href = href
                a.download = ''
                a.style.display = 'none'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                this.$message({ type: 'success', message: '已开始下载，如未自动下载请检查浏览器拦截' })
            } catch (error) {
                this.$message({ type: 'error', message: '导出失败: ' + (error.message || error) })
            }
        },
        async deletePDJob(jobId) {
            this.$confirm('确定要删除该训练任务吗?', '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            })
            .then(async () => {
                try {
                    await DeleteTrainingJob(jobId)
                    this.$message({ type: 'success', message: '删除成功!' })
                    const pid = this.projectInfo?.project_id || this.$route.query.projectId
                    if (pid) this.loadProjectDetails(pid)
                    // 触发视图更新
                    this.$nextTick(() => this.$forceUpdate())
                } catch (error) {
                    this.$message({ type: 'error', message: '删除失败: ' + error.message })
                }
            })
            .catch(() => {})
        },
        goProjectsCharts(model) {
            if (this.$route.path !== '/projectscharts/trainpart') {
                this.$router.push({ path: '/projectscharts/trainpart', query: { jobId: model.job_id } })
            }
        },
        // 初始化实时连接（运行中的前 wsLimit 个任务）
        initRealtime(){
            if (!Array.isArray(this.projectModels)) return
            const running = this.projectModels.filter(j => (j.status||'').toLowerCase()==='running')
            const wsBase = (WS_BASE) || (API_BASE.startsWith('https://') ? API_BASE.replace('https://','wss://') : API_BASE.replace('http://','ws://'))
            running.slice(0, this.wsLimit).forEach(job => {
                const id = job.job_id
                if (!id || this.wsMap[id]) return
                try{
                    const ws = new WebSocket(`${wsBase}/api/v1/training-jobs/${id}/metrics/stream`)
                    ws.onmessage = (e)=>{
                        try{
                            const p = JSON.parse(e.data||'{}')
                            if (p && !p.error){
                                if (typeof p.current_epoch === 'number') this.$set(job,'current_epoch',p.current_epoch)
                                if (typeof p.status === 'string') this.$set(job,'status',p.status)
                            }
                        }catch(_){/* ignore */}
                    }
                    ws.onclose = ()=>{ delete this.wsMap[id] }
                    ws.onerror = ()=>{ try{ ws.close() }catch(_){} delete this.wsMap[id] }
                    this.$set(this.wsMap, id, ws)
                }catch(_){/* ignore */}
            })
        },
        // 兜底：定时用 HTTP 刷新运行中任务的 current_epoch
        async refreshRunningStatuses(){
            if (!Array.isArray(this.projectModels)) return
            const running = this.projectModels.filter(j => (j.status||'').toLowerCase()==='running')
            await Promise.allSettled(running.map(async (job)=>{
                try{
                    const s = await FetchTrainingJobsStatus(job.job_id)
                    if (s && typeof s.current_epoch === 'number') this.$set(job,'current_epoch',s.current_epoch)
                    if (s && typeof s.status === 'string') this.$set(job,'status',s.status)
                }catch(_){/* ignore */}
            }))
            this.initRealtime()
        },
        
        // 直接从localStorage获取模型数量
        getStoredModelCount() {
            try {
                const storedProject = localStorage.getItem('currentProject');
                if (storedProject) {
                    const projectData = JSON.parse(storedProject);
                    if (projectData && projectData.completed_models_count !== undefined) {
                        return projectData.completed_models_count;
                    }
                }
            } catch (error) {
                console.error('获取localStorage模型数量失败:', error);
            }
            
            // 如果无法从localStorage获取，则使用computed属性
            return this.modelCount;
        },
        
        // 直接从localStorage获取模型大小
        getStoredModelSize() {
            try {
                const storedProject = localStorage.getItem('currentProject');
                if (storedProject) {
                    const projectData = JSON.parse(storedProject);
                    if (projectData && projectData.total_size_mb) {
                        return projectData.total_size_mb;
                    }
                }
            } catch (error) {
                console.error('获取localStorage模型大小失败:', error);
            }
            
            // 如果无法从localStorage获取，则使用computed属性
            return this.totalSize;
        },
        
        // 调试辅助方法：输出保存的项目信息
        logStoredProjectInfo() {
            try {
                const storedProject = localStorage.getItem('currentProject');
                if (storedProject) {
                    const projectData = JSON.parse(storedProject);
                    console.log('ProjectsDetail - 当前保存的项目信息:', projectData);
                    console.log('ProjectsDetail - 模型数量:', projectData.completed_models_count);
                    console.log('ProjectsDetail - 模型大小:', projectData.total_size_mb);
                } else {
                    console.log('ProjectsDetail - localStorage中没有找到currentProject');
                }
            } catch (error) {
                console.error('ProjectsDetail - 读取localStorage项目信息失败:', error);
            }
        },
        
        initProjectInfo() {
            // 优先从路由参数获取
            const projectId = this.$route.query.projectId;
            if (projectId) {
                this.loadProjectDetails(projectId);
            } else {
                // 从localStorage获取
                const storedProject = localStorage.getItem('currentProject');
                if (storedProject) {
                    try {
                        this.projectInfo = JSON.parse(storedProject);
                        this.loadProjectDetails(this.projectInfo.project_id);
                    } catch (error) {
                        console.error('解析项目信息失败:', error);
                    }
                }
            }
        },
        
        async loadProjectDetails(projectId) {
            if (!projectId) return;
            
            this.loading = true;
            
            // 优先从路由参数获取模型数量和大小
            const routeModelCount = this.$route.query.modelCount;
            const routeModelSize = this.$route.query.modelSize;
            
            // 如果路由参数中没有，则从localStorage获取
            let savedModelCount = routeModelCount !== undefined ? routeModelCount : undefined;
            let savedSizeInfo = routeModelSize || undefined;
            
            if (savedModelCount === undefined || savedSizeInfo === undefined) {
                const storedProject = localStorage.getItem('currentProject');
                if (storedProject) {
                    try {
                        const projectData = JSON.parse(storedProject);
                        if (projectData.project_id === projectId) {
                            if (savedModelCount === undefined) {
                                savedModelCount = projectData.completed_models_count;
                            }
                            if (savedSizeInfo === undefined) {
                                savedSizeInfo = projectData.total_size_mb;
                            }
                        }
                    } catch (error) {
                        console.error('解析localStorage项目信息失败:', error);
                    }
                }
            }
            
            // 输出调试信息
            console.log('路由传递的模型数量:', routeModelCount);
            console.log('路由传递的模型大小:', routeModelSize);
            console.log('最终使用的模型数量:', savedModelCount);
            console.log('最终使用的模型大小:', savedSizeInfo);
            
            try {
                // 使用新的接口获取项目详情
                const projectDetailResponse = await FetchProjectsDetail(projectId);
                console.log('projectDetailResponse',projectDetailResponse);
                
                // 更新项目信息
                this.projectInfo = projectDetailResponse;
                
                // 强制以后端最新统计为准，不再覆盖为父级传参
                
                // 优先使用项目详情返回的任务列表（兼容后端结构）
                if (Array.isArray(projectDetailResponse.training_jobs)) {
                    this.projectModels = projectDetailResponse.training_jobs;
                } else {
                    // 兼容旧接口：拉取全部任务后按项目过滤
                    const allJobs = await fetchTrainingJobs();
                    const pidNum = Number(projectId);
                    this.projectModels = allJobs.filter(job => {
                        // project_id 可能在根上或嵌套在 job.project 内，且类型可能为字符串
                        const rootMatch = job.project_id === projectId || job.project_id === pidNum;
                        const nestedMatch = job.project && (job.project.project_id === projectId || job.project.project_id === pidNum);
                        if (rootMatch || nestedMatch) return true;
                        // 备用：名称包含或数据集名匹配
                        if (this.projectInfo && job.job_name && job.job_name.includes(this.projectInfo.project_name)) return true;
                        if (this.projectInfo && this.projectInfo.dataset && job.dataset_name === this.projectInfo.dataset.dataset_name) return true;
                        return false;
                    });
                }
                
                // 拉取已完成任务的模型大小
                await this.fetchCompletedModelSizes()

                // 保存更新后的项目信息到localStorage，但保留原始的模型数量和大小信息
                const projectToSave = {...this.projectInfo};
                
                // 确保保留原始的模型数量和大小信息
                if (savedModelCount !== undefined) {
                    projectToSave.completed_models_count = savedModelCount;
                }
                if (savedSizeInfo) {
                    projectToSave.total_size_mb = savedSizeInfo;
                }
                
                localStorage.setItem('currentProject', JSON.stringify(projectToSave));
                
            } catch (error) {
                console.error('获取项目详情失败:', error);
                // 如果API调用失败，尝试从localStorage获取备用信息
                const storedProject = localStorage.getItem('currentProject');
                if (storedProject) {
                    try {
                        this.projectInfo = JSON.parse(storedProject);
                    } catch (parseError) {
                        console.error('解析本地项目信息失败:', parseError);
                    }
                }
            } finally {
                this.loading = false;
            }
        },
        async fetchCompletedModelSizes(){
            try{
                if(!Array.isArray(this.projectModels)) return
                const completed = this.projectModels.filter(m => String(m.status||'').toLowerCase()==='completed')
                const tasks = completed.map(async model => {
                    try{
                        const res = await FetchTrainingJobModelSize(model.job_id)
                        const v = res && (typeof res.model_size_mb==='number' ? res.model_size_mb : parseFloat(res.model_size_mb))
                        if (!isNaN(v)) this.$set(model, 'model_size_mb', v)
                    }catch(_){/* ignore single item error */}
                })
                await Promise.allSettled(tasks)
                this.$forceUpdate()
            }catch(_){/* ignore */}
        },
        formatProgress(model) {
            if (model.status === 'completed') return '已完成'
            if (model.status === 'running') {
                const current = model.current_epoch || 0
                const total = model.parameters?.epochs || '-'
                return `${current}/${total}`
            }
            if (model.status === 'pending') return '待开始'
            return model.status || '未知'
        },
        formatCreateTime(dateStr) {
            if (!dateStr) return ''
            const date = new Date(dateStr)
            const now = new Date()
            const diffTime = Math.abs(now - date)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            if (diffDays === 1) return '1天前'
            if (diffDays < 30) return `${diffDays}天前`
            if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`
            return `${Math.floor(diffDays / 365)}年前`
        },
        statusClass(status){
            if(!status) return 'status-pending'
            const s = String(status).toLowerCase()
            if(s==='completed' || s==='copleted') return 'status-completed'
            if(s==='pending') return 'status-pending'
            if(s==='fail' || s==='failed' || s==='error') return 'status-fail'
            if(s==='running' || s==='training') return 'status-running'
            return 'status-pending'
        },
        formatModelSize(sizeMb) {
            if (sizeMb === undefined || sizeMb === null) return '-'
            return sizeMb.toFixed(1) + 'MB'
        }
    },
    beforeDestroy() {
        window.removeEventListener('resize', this._resizeHandler);
        this._resizeHandler = null;
        if (this.statusTimer) { clearInterval(this.statusTimer); this.statusTimer = null }
        Object.values(this.wsMap||{}).forEach(ws=>{ try{ ws.close() }catch(_){}})
        this.wsMap = {}
    }
}

</script>

<style scoped>
/* 保持原有样式不变 */
.projectsdetail {
    color: #111F68;
    position: relative;
}

.title {
    margin: 18px 0;
    font-size: 20px;
    display: flex;
    align-items: center;
    color: #111F68;
}
/* 返回按钮与标题统一风格 */
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
}
.back-btn:hover { color: #182a8f !important; }
.project-title-text { line-height: 1; display: inline-flex; align-items: center; }
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

.updateTime {
    display: flex;
    align-items: center;
}

.updateTime IMG {
    height: 30px;
    width: 30px;
}

.rightMessage {
    display: flex;
    align-items: center;
    margin-left: 800px;
}

.circle1, .circle2 {
    background-color: #F3F3F3;
    height: 35px;
    line-height: 35px;
    text-align: center;
    border-radius: 10px;
    margin: 0 8px;
}

.circle1 {
    width: 40px;
}

.circle2 {
    width: 50px;
}

.searchPart {
    display: flex;
    margin-top: 15px;
}

.searchPart div {
    width: 120px;
    height: 40px;
    text-align: center;
    line-height: 35px;
    font-size: 15px;
    cursor: pointer; /* 添加鼠标指针样式 */
    transition: all 0.3s ease; /* 添加过渡效果 */
}

.overView, .charts {
    border-bottom: 2px solid transparent; /* 初始透明边框 */
}
.overView{
    margin-bottom: 15px;
}
/* 激活状态样式 */
.active {
    border-bottom: 2px solid #111F68; /* 蓝色下划线 */
    color: #111F68;
    font-weight: bold;
}

/* 合并 ProjectsPreviewPart 样式 */
.secondFloor {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}
.input { margin: 0 10px; width: 300px; max-width: 100%; min-width: 200px; }
.el-menu-demo { display: flex; border-bottom: none !important; }
.el-menu-demo .nav-item { margin: 0 10px !important; min-width: 80px !important; text-align: center !important; }
.el-menu-demo .el-menu-item.is-active { color: #111F68 !important; border-bottom: 2px solid #111F68 !important; }

.showList { width: 100%; background-color: #FBFCFD; }
.showList ul { display: flex; flex-wrap: wrap; width: 100%; }
.showList ul li { width: 100%; height: 90px; background-color: #fff; margin: 10px; box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.05); display: flex; position: relative; align-items: center; padding-right: 120px; }
.showList ul li:hover { box-shadow: 0 0 12px 3px rgba(0, 0, 0, 0.1); }
.showList img { width: 24px; height: 24px; }
.circle { width: 40px; height: 40px; border-radius: 50%; background-color: #f5f2f2; margin: 25px 20px; display: flex; justify-content: center; align-items: center; }
.messagePart { display: flex; flex-direction: column; margin: 18px 0 0 10px; color: #111F68; flex: 1; min-width: 0; max-width: calc(100% - 120px); }
.title1 { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.title2 { font-size: 13px; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detailPart { display: flex; align-items: center; color: #111F68; position: absolute; right: 15px; top: 50%; transform: translateY(-50%); flex-wrap: nowrap; gap: 10px; }
.detailPart .detail1 { font-weight: bolder; white-space: nowrap; }
.detailPart .detail2 { margin: 0 15px; white-space: nowrap; }
.detail-size { color: #666; font-size: 14px; white-space: nowrap; }

/* 任务状态色条，与任务列表页一致 */
.statusBar {
  display: flex;
  align-items: center;
  margin-right: 20px;
  height: 100%;
  width: 10px;
  transition: background-color .25s;
}
.status-completed { background-color: #087922 !important; }
.status-pending { background-color: #c9c9c9 !important; }
.status-fail { background-color: #ff4d4f !important; }
.status-running { background-color: #111f68 !important; }

/* 更多选项按钮样式（与 Models.vue 保持一致） */
.more-options { display: flex; align-items: center; cursor: pointer; }
.more-options .el-dropdown-link { display: flex; justify-content: center; align-items: center; width: 32px; height: 32px; border-radius: 50%; }
.more-options .el-dropdown-link:hover { background-color: #f5f7fa; }
.more-options i { font-size: 18px; color: #606266; }

@media (max-width: 1024px) {
  .showList ul li { padding-right: 60px; }
  .detailPart { right: 10px; gap: 5px; }
  .detailPart .detail2 { margin: 0 8px; }
}
@media (max-width: 768px) {
  .secondFloor { flex-direction: column; align-items: flex-start; gap: 15px; }
  .input { margin: 0; width: 100%; min-width: auto; }
  .showList ul li { padding-right: 40px; height: auto; min-height: 90px; padding-top: 15px; padding-bottom: 15px; }
  .messagePart { margin: 0 10px; max-width: calc(100% - 50px); }
  .detailPart { right: 5px; flex-direction: column; gap: 5px; align-items: flex-end; }
  .detailPart .detail2 { margin: 0; }
}

/* 状态样式 */
.loading-container { display: flex; align-items: center; justify-content: center; padding: 60px; color: #666; font-size: 16px; }
.loading-container i { font-size: 24px; margin-right: 12px; animation: spin 1s linear infinite; }
.no-data-container { display: flex; align-items: center; justify-content: center; padding: 60px; color: #999; font-size: 16px; }
.no-data-container i { font-size: 24px; margin-right: 12px; }
/* 加载状态样式 */
.loading-info {
    display: flex;
    align-items: center;
    color: #666;
    font-size: 14px;
    margin-left: 20px;
}

.loading-info i {
    font-size: 16px;
    margin-right: 8px;
    animation: spin 1s linear infinite;
}
.projectMessage{
    position: absolute;
    top: 85px;
    right: 50px !important;
}
/* 迁移的添加训练任务按钮样式 */
.create-job-btn {
    width: 112px;
    height: 40px;
    border-radius: 20px;
    background-color: #111f68;
    color: #fff;
    line-height: 40px;
    font-weight: 450;
    position: absolute;
    top: 20px;
    right: 20px;
    font-size: 14px;
    border: none;
    cursor: pointer;
    transition: background-color .25s;
}
.create-job-btn:hover { background-color: #182a8f; }
.create-job-btn:active { background-color: #0c164a; }
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>