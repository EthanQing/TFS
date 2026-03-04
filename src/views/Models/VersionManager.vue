<template>
    <div class="model-version-container">
        <!-- 顶部标题 -->
        <div class="top">
            <h3>模型版本管理</h3>
            <div class="top-actions">
                <el-button
                    type="primary"
                    class="custom-primary-btn"
                    @click="dialogFormVisible = true"
                >
                    + 发布新版本
                </el-button>
                <el-button
                    class="custom-info-btn"
                    @click="goRollbackCenter"
                >
                    模型回滚
                </el-button>
            </div>
        </div>

        <!-- 版本列表和管理区域 -->
        <div class="content-wrapper">
            <!-- 左侧：版本列表 -->
            <div class="version-list-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-document"></i>
                    版本列表
                </h4>
                
                <!-- 搜索和过滤 -->
                <div class="filter-area">
                    <el-input
                        v-model="searchQuery"
                        placeholder="搜索版本号或描述"
                        prefix-icon="el-icon-search"
                        clearable
                        class="search-input"
                    ></el-input>
                    <el-select
                        v-model="filterStatus"
                        placeholder="筛选状态"
                        clearable
                        class="filter-select"
                        @change="handleFilterChange"
                    >
                        <el-option label="全部" value=""></el-option>
                        <el-option label="开发中" value="development"></el-option>
                        <el-option label="测试中" value="testing"></el-option>
                        <el-option label="生产" value="production"></el-option>
                        <el-option label="归档" value="archived"></el-option>
                    </el-select>
                </div>

                <!-- 版本项目列表 -->
                <div class="versions-container">
                    <div 
                        v-for="version in filteredVersions" 
                        :key="version.id"
                        :class="['version-item', { 'active': selectedVersion && selectedVersion.id === version.id, 'production': version.isProduction }]"
                        @click="selectVersion(version)"
                    >
                        <div class="version-header">
                            <div class="version-info">
                                <span class="version-number">{{ version.versionNumber }}</span>
                                <span v-if="version.isProduction" class="production-badge">生产版本</span>
                            </div>
                            <span class="version-date">{{ version.releaseDate }}</span>
                        </div>
                        <div class="version-status">
                            <el-tag 
                                :type="getStatusType(version.status)"
                                size="mini"
                                class="status-tag"
                            >
                                {{ getStatusLabel(version.status) }}
                            </el-tag>
                        </div>
                        <div class="version-description">{{ version.description }}</div>
                        <div class="version-stats">
                            <span class="stat"><i class="el-icon-download"></i>{{ version.downloads }}</span>
                            <span class="stat"><i class="el-icon-document-copy"></i>{{ version.size }}</span>
                        </div>
                    </div>
                </div>

                <!-- 空状态 -->
                <div class="empty-state" v-if="filteredVersions.length === 0">
                    <i class="el-icon-document-copy"></i>
                    <p>暂无版本数据</p>
                </div>
            </div>

            <!-- 右侧：生命周期管理和详情 -->
            <div class="right-section">
                <!-- 版本详情卡片 -->
                <div class="version-detail-section section-card" v-if="selectedVersion">
                    <h4 class="section-title">
                        <i class="el-icon-info"></i>
                        版本详情
                    </h4>
                    <div class="detail-content">
                        <div class="detail-row">
                            <span class="label">版本号：</span>
                            <span class="value">{{ selectedVersion.versionNumber }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">发布日期：</span>
                            <span class="value">{{ selectedVersion.releaseDate }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">描述：</span>
                            <span class="value">{{ selectedVersion.description }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">作者：</span>
                            <span class="value">{{ selectedVersion.author }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">模型类型：</span>
                            <span class="value">{{ selectedVersion.modelType }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">大小：</span>
                            <span class="value">{{ selectedVersion.size }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">下载次数：</span>
                            <span class="value">{{ selectedVersion.downloads }}</span>
                        </div>
                    </div>
                </div>

                <!-- 生命周期管理 -->
                <div class="lifecycle-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-s-unfold"></i>
                        生命周期管理
                    </h4>
                    <div class="lifecycle-content" v-if="selectedVersion">
                        <!-- 生命周期流程图 -->
                        <div class="lifecycle-timeline">
                            <div 
                                v-for="stage in lifecycleStages" 
                                :key="stage.id"
                                :class="['timeline-item', { 'active': isStageActive(stage.status), 'completed': isStageCompleted(stage.status) }]"
                            >
                                <div class="timeline-dot"></div>
                                <div class="timeline-content">
                                    <div class="stage-name">{{ stage.label }}</div>
                                    <div class="stage-status">{{ isStageActive(stage.status) ? '进行中' : isStageCompleted(stage.status) ? '已完成' : '待进行' }}</div>
                                </div>
                            </div>
                        </div>

                        <!-- 生命周期操作 -->
                        <div class="lifecycle-actions">
                            <el-button 
                                v-if="selectedVersion.status === 'development'"
                                type="primary"
                                class="custom-primary-btn"
                                @click="handleStatusChange('testing')"
                            >
                                提交测试
                            </el-button>
                            <el-button 
                                v-if="selectedVersion.status === 'testing'"
                                type="success"
                                class="custom-success-btn"
                                @click="handleStatusChange('production')"
                            >
                                发布生产
                            </el-button>
                            <el-button 
                                v-if="['production', 'testing'].includes(selectedVersion.status)"
                                type="info"
                                class="custom-info-btn"
                                @click="handleStatusChange('archived')"
                            >
                                归档版本
                            </el-button>
                            <el-button 
                                class="custom-danger-btn"
                                @click="handleDeleteVersion"
                            >
                                删除版本
                            </el-button>
                        </div>
                    </div>
                    <div class="empty-state" v-else>
                        <p>请选择版本查看生命周期</p>
                    </div>
                </div>

                <!-- 生产版本标记 -->
                <div class="production-mark-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-star-on"></i>
                        生产版本标记
                    </h4>
                    <div class="production-content" v-if="selectedVersion">
                        <div class="current-production">
                            <span class="label">当前生产版本：</span>
                            <span class="value">
                                <strong>{{ currentProduction.versionNumber }}</strong>
                                <span class="meta">({{ currentProduction.releaseDate }})</span>
                            </span>
                        </div>

                        <div class="production-actions">
                            <template v-if="!selectedVersion.isProduction && selectedVersion.status === 'production'">
                                <p class="action-description">将此版本标记为生产版本</p>
                                <el-button 
                                    type="warning"
                                    class="custom-warning-btn"
                                    @click="handleMarkProduction"
                                >
                                    标记为生产版本
                                </el-button>
                            </template>
                            <template v-else-if="selectedVersion.isProduction">
                                <div class="production-badge-large">
                                    <i class="el-icon-star-on"></i>
                                    <span>此版本为当前生产版本</span>
                                </div>
                                <el-button 
                                    type="info"
                                    plain
                                    class="custom-info-btn"
                                    @click="handleViewProduction"
                                >
                                    查看生产配置
                                </el-button>
                            </template>
                            <template v-else>
                                <p class="action-description">版本需处于生产状态才能标记为生产版本</p>
                                <el-button 
                                    disabled
                                    class="custom-disabled-btn"
                                >
                                    标记为生产版本
                                </el-button>
                            </template>
                        </div>
                    </div>
                    <div class="empty-state" v-else>
                        <p>请选择版本进行标记</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 发布新版本对话框 -->
        <el-dialog title="发布新版本" :visible.sync="dialogFormVisible" width="600px">
            <el-form :model="form" :rules="rules" ref="formRef">
                <el-form-item label="版本号" label-width="100px" prop="versionNumber">
                    <el-input 
                        v-model="form.versionNumber" 
                        placeholder="例如: v1.2.3"
                        autocomplete="off"
                    ></el-input>
                </el-form-item>
                <el-form-item label="描述" label-width="100px" prop="description">
                    <el-input 
                        v-model="form.description" 
                        type="textarea"
                        rows="3"
                        placeholder="版本更新说明"
                        autocomplete="off"
                    ></el-input>
                </el-form-item>
                <el-form-item label="模型类型" label-width="100px" prop="modelType">
                    <el-input 
                        v-model="form.modelType" 
                        placeholder="例如: YOLOv8"
                        autocomplete="off"
                    ></el-input>
                </el-form-item>
                <el-form-item label="文件大小" label-width="100px" prop="size">
                    <el-input 
                        v-model="form.size" 
                        placeholder="例如: 245MB"
                        autocomplete="off"
                    ></el-input>
                </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
                <el-button @click="dialogFormVisible = false">取 消</el-button>
                <el-button type="primary" @click="handlePublishVersion">发 布</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
export default {
    name: 'ModelVersionManagement',
    data() {
        return {
            searchQuery: '',
            filterStatus: '',
            selectedVersion: null,
            dialogFormVisible: false,
            form: {
                versionNumber: '',
                description: '',
                modelType: '',
                size: ''
            },
            rules: {
                versionNumber: [{ required: true, message: '请输入版本号', trigger: 'blur' }],
                description: [{ required: true, message: '请输入描述', trigger: 'blur' }],
                modelType: [{ required: true, message: '请输入模型类型', trigger: 'blur' }],
                size: [{ required: true, message: '请输入文件大小', trigger: 'blur' }]
            },
            lifecycleStages: [
                { id: 'dev', label: '开发中', status: 'development' },
                { id: 'test', label: '测试中', status: 'testing' },
                { id: 'prod', label: '生产', status: 'production' },
                { id: 'archive', label: '已归档', status: 'archived' }
            ],
            versions: [
                {
                    id: 1,
                    versionNumber: 'v1.0.5',
                    releaseDate: '2025-01-15',
                    description: '性能优化，提升推理速度20%',
                    status: 'production',
                    isProduction: true,
                    author: '张三',
                    modelType: 'YOLOv8',
                    size: '268MB',
                    downloads: 1250
                },
                {
                    id: 2,
                    versionNumber: 'v1.0.4',
                    releaseDate: '2025-01-10',
                    description: '修复了部分数据集兼容性问题',
                    status: 'archived',
                    isProduction: false,
                    author: '李四',
                    modelType: 'YOLOv8',
                    size: '245MB',
                    downloads: 856
                },
                {
                    id: 3,
                    versionNumber: 'v1.0.3',
                    releaseDate: '2025-01-05',
                    description: '增加了新的数据增强功能',
                    status: 'archived',
                    isProduction: false,
                    author: '王五',
                    modelType: 'YOLOv8',
                    size: '240MB',
                    downloads: 523
                },
                {
                    id: 4,
                    versionNumber: 'v1.0.2',
                    releaseDate: '2024-12-20',
                    description: '首个稳定版本',
                    status: 'archived',
                    isProduction: false,
                    author: '赵六',
                    modelType: 'YOLOv8',
                    size: '235MB',
                    downloads: 324
                },
                {
                    id: 5,
                    versionNumber: 'v1.0.6',
                    releaseDate: '2025-01-16',
                    description: '新增量化模型，支持边缘部署',
                    status: 'testing',
                    isProduction: false,
                    author: '孙七',
                    modelType: 'YOLOv8-Quantized',
                    size: '85MB',
                    downloads: 0
                }
            ]
        };
    },
    computed: {
        filteredVersions() {
            return this.versions.filter(version => {
                const matchesSearch = version.versionNumber.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                    version.description.toLowerCase().includes(this.searchQuery.toLowerCase());
                const matchesStatus = !this.filterStatus || version.status === this.filterStatus;
                return matchesSearch && matchesStatus;
            });
        },
        currentProduction() {
            return this.versions.find(v => v.isProduction) || this.versions[0];
        }
    },
    methods: {
        selectVersion(version) {
            this.selectedVersion = JSON.parse(JSON.stringify(version));
        },
        getStatusLabel(status) {
            const statusMap = {
                'development': '开发中',
                'testing': '测试中',
                'production': '生产',
                'archived': '已归档'
            };
            return statusMap[status] || status;
        },
        getStatusType(status) {
            const typeMap = {
                'development': 'primary',
                'testing': 'warning',
                'production': 'success',
                'archived': 'info'
            };
            return typeMap[status] || 'info';
        },
        isStageActive(status) {
            return this.selectedVersion && this.selectedVersion.status === status;
        },
        isStageCompleted(status) {
            const stages = ['development', 'testing', 'production', 'archived'];
            const statusIndex = stages.indexOf(this.selectedVersion?.status);
            const stageIndex = stages.indexOf(status);
            return statusIndex > stageIndex;
        },
        handleFilterChange() {
            // 筛选变化时的处理
        },
        handleStatusChange(newStatus) {
            this.$confirm(`确认将版本状态改为 ${this.getStatusLabel(newStatus)} 吗？`, '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                const versionIndex = this.versions.findIndex(v => v.id === this.selectedVersion.id);
                if (versionIndex > -1) {
                    this.versions[versionIndex].status = newStatus;
                    this.selectedVersion.status = newStatus;
                    this.$message.success(`版本状态已更新为 ${this.getStatusLabel(newStatus)}`);
                }
            });
        },
        handleMarkProduction() {
            this.$confirm('确认标记此版本为生产版本吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                // 取消之前的生产版本标记
                const oldProduction = this.versions.find(v => v.isProduction);
                if (oldProduction) {
                    oldProduction.isProduction = false;
                }
                // 标记新版本为生产版本
                const versionIndex = this.versions.findIndex(v => v.id === this.selectedVersion.id);
                if (versionIndex > -1) {
                    this.versions[versionIndex].isProduction = true;
                    this.selectedVersion.isProduction = true;
                    this.$message.success('生产版本已更新');
                }
            });
        },
        handleViewProduction() {
            this.$message.info(`当前生产版本 ${this.selectedVersion.versionNumber} 的配置信息`);
        },
        handleDeleteVersion() {
            this.$confirm('确认删除此版本吗？此操作不可恢复', '删除确认', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'error'
            }).then(() => {
                const index = this.versions.findIndex(v => v.id === this.selectedVersion.id);
                if (index > -1) {
                    this.versions.splice(index, 1);
                    this.selectedVersion = null;
                    this.$message.success('版本已删除');
                }
            });
        },
        handlePublishVersion() {
            this.$refs.formRef.validate(valid => {
                if (valid) {
                    const newVersion = {
                        id: Math.max(...this.versions.map(v => v.id)) + 1,
                        versionNumber: this.form.versionNumber,
                        releaseDate: new Date().toISOString().split('T')[0],
                        description: this.form.description,
                        status: 'development',
                        isProduction: false,
                        author: '当前用户',
                        modelType: this.form.modelType,
                        size: this.form.size,
                        downloads: 0
                    };
                    this.versions.unshift(newVersion);
                    this.dialogFormVisible = false;
                    this.$refs.formRef.resetFields();
                    this.$message.success('新版本已发布');
                }
            });
        },
        goRollbackCenter() {
            let projectId = null;
            try {
                const raw = localStorage.getItem('currentProject');
                const obj = raw ? JSON.parse(raw) : null;
                const n = Number(obj?.project_id || obj?.id);
                if (Number.isFinite(n) && n > 0) projectId = n;
            } catch (_) {
                projectId = null;
            }

            const query = { tool: 'rollback' };
            if (projectId) query.project_id = projectId;
            this.$router.push({ path: '/deployment', query });
        }
    }
};
</script>

<style scoped>
.model-version-container {
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

.top-actions {
    display: flex;
    align-items: center;
    gap: 10px;
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
}

/* 左侧：版本列表 */
.version-list-section {
    flex: 0 0 40%;
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

/* 右侧：详情和管理 */
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

/* 搜索和过滤 */
.filter-area {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
}

.search-input {
    flex: 1;
}

.filter-select {
    width: 120px;
}

/* 版本列表 */
.versions-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    overflow-y: auto;
    padding-right: 6px;
}

.version-item {
    padding: 12px;
    border-radius: 8px;
    background-color: #f9fafb;
    border: 2px solid #e8ecef;
    cursor: pointer;
    transition: all 0.3s ease;
}

.version-item:hover {
    background-color: #f0f3f9;
    border-color: #111f68;
    transform: translateX(4px);
}

.version-item.active {
    background-color: #e8ecf5;
    border-color: #111f68;
    box-shadow: 0 4px 12px rgba(17, 31, 104, 0.15);
}

.version-item.production {
    border-color: #f59e0b;
    background-color: #fef9f3;
}

.version-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.version-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.version-number {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

.production-badge {
    display: inline-block;
    background-color: #fef3c7;
    color: #d97706;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}

.version-date {
    font-size: 12px;
    color: #8e9aaf;
}

.version-status {
    margin-bottom: 8px;
}

.status-tag {
    font-size: 11px !important;
}

.version-description {
    font-size: 13px;
    color: #6c757d;
    margin-bottom: 8px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.version-stats {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #8e9aaf;
    border-top: 1px solid #e8ecef;
    padding-top: 8px;
}

.stat {
    display: flex;
    align-items: center;
    gap: 4px;
}

.stat i {
    font-size: 12px;
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

/* 版本详情 */
.version-detail-section {
    flex: 0 0 auto;
    min-height: 0;
}

.detail-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 300px;
    overflow-y: auto;
}

.detail-row {
    display: flex;
    gap: 12px;
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
    align-items: flex-start;
}

.detail-row .label {
    font-size: 13px;
    font-weight: 500;
    color: #6c757d;
    min-width: 70px;
}

.detail-row .value {
    font-size: 13px;
    color: #111f68;
    flex: 1;
    word-break: break-word;
}

/* 生命周期管理 */
.lifecycle-section {
    flex: 0 0 auto;
    min-height: 0;
}

.lifecycle-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
}

.lifecycle-timeline {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background-color: #f9fafb;
    border-radius: 8px;
}

.timeline-item {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    position: relative;
}

.timeline-item::after {
    content: '';
    position: absolute;
    left: 17px;
    top: 40px;
    width: 2px;
    height: 24px;
    background-color: #e8ecef;
}

.timeline-item:last-child::after {
    display: none;
}

.timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #e8ecef;
    flex-shrink: 0;
    margin-top: 4px;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px #e8ecef;
}

.timeline-item.active .timeline-dot {
    background-color: #111f68;
    box-shadow: 0 0 0 1px #111f68;
}

.timeline-item.completed .timeline-dot {
    background-color: #10b981;
    box-shadow: 0 0 0 1px #10b981;
}

.timeline-content {
    flex: 1;
    padding-top: 2px;
}

.stage-name {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
}

.stage-status {
    font-size: 12px;
    color: #8e9aaf;
    margin-top: 2px;
}

.lifecycle-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.lifecycle-actions .el-button {
    flex: 1;
    min-width: 100px;
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
}

.custom-success-btn {
    background-color: #10b981 !important;
    border-color: #10b981 !important;
    color: #fff !important;
}

.custom-success-btn:hover {
    background-color: #059669 !important;
    border-color: #059669 !important;
}

.custom-info-btn {
    background-color: #06b6d4 !important;
    border-color: #06b6d4 !important;
    color: #fff !important;
}

.custom-info-btn:hover {
    background-color: #0891b2 !important;
    border-color: #0891b2 !important;
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

.custom-warning-btn {
    background-color: #f59e0b !important;
    border-color: #f59e0b !important;
    color: #fff !important;
}

.custom-warning-btn:hover {
    background-color: #d97706 !important;
    border-color: #d97706 !important;
}

.custom-disabled-btn {
    background-color: #d5d5d5 !important;
    border-color: #d5d5d5 !important;
    color: #999 !important;
    cursor: not-allowed !important;
}

/* 生产版本标记 */
.production-mark-section {
    flex: 0 0 auto;
    min-height: 0;
}

.production-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.current-production {
    padding: 12px;
    background-color: #f0fdf4;
    border-radius: 6px;
    border-left: 3px solid #10b981;
    display: flex;
    align-items: center;
    gap: 12px;
}

.current-production .label {
    font-size: 13px;
    font-weight: 500;
    color: #6c757d;
}

.current-production .value {
    font-size: 13px;
    color: #111f68;
}

.current-production .meta {
    font-size: 12px;
    color: #8e9aaf;
    margin-left: 4px;
}

.production-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.action-description {
    font-size: 13px;
    color: #6c757d;
    margin: 0;
}

.production-badge-large {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    background-color: #fef9f3;
    border-radius: 8px;
    border: 2px solid #f59e0b;
    color: #d97706;
    font-weight: 600;
    font-size: 14px;
}

.production-badge-large i {
    font-size: 20px;
}

/* 对话框样式 */
.el-dialog {
    width: 600px !important;
}

.dialog-footer {
    padding: 10px 20px !important;
}

/* 滚动条样式 */
.versions-container::-webkit-scrollbar,
.version-list-section::-webkit-scrollbar,
.right-section::-webkit-scrollbar {
    width: 6px;
}

.versions-container::-webkit-scrollbar-track,
.version-list-section::-webkit-scrollbar-track,
.right-section::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.versions-container::-webkit-scrollbar-thumb,
.version-list-section::-webkit-scrollbar-thumb,
.right-section::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.versions-container::-webkit-scrollbar-thumb:hover,
.version-list-section::-webkit-scrollbar-thumb:hover,
.right-section::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

/* 响应式设计 */
@media (max-width: 1400px) {
    .content-wrapper {
        flex-direction: column;
        height: auto;
    }

    .version-list-section {
        flex: 0 0 auto;
        max-width: none;
        max-height: 400px;
    }

    .right-section {
        flex: 1;
        max-height: none;
    }
}

@media (max-width: 1024px) {
    .model-version-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .detail-row {
        flex-direction: column;
        gap: 6px;
    }

    .detail-row .label {
        min-width: auto;
    }

    .filter-area {
        flex-direction: column;
    }

    .search-input {
        width: 100%;
    }

    .filter-select {
        width: 100%;
    }
}
</style>
