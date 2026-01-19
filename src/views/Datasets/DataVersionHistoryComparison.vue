<template>
    <div class="history-container">
        <!-- 顶部标题 -->
        <div class="top">
            <h3>历史版本和对比</h3>
        </div>

        <!-- 主内容区域 -->
        <div class="content-wrapper">
            <!-- 左侧：版本历史板块 -->
            <div class="version-history-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-time"></i>
                    版本历史
                </h4>
                <div class="version-list">
                    <div class="version-item" v-for="(version, index) in versionHistory" :key="index" @click="selectVersion(version, index)" :class="{ active: selectedVersionIndex === index }">
                        <div class="version-header">
                            <span class="version-name">{{ version.name }}</span>
                            <span class="version-date">{{ version.date }}</span>
                        </div>
                        <div class="version-description">{{ version.description }}</div>
                        <div class="version-meta">
                            <span class="meta-item"><i class="el-icon-user"></i>{{ version.author }}</span>
                            <span class="meta-item"><i class="el-icon-document"></i>{{ version.modelType }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧：差异对比和版本切换 -->
            <div class="right-section">
                <!-- 差异对比板块 -->
                <div class="diff-compare-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-s-unfold"></i>
                        差异对比
                    </h4>
                    <div class="comparison-content" v-if="selectedVersion">
                        <div class="comparison-header">
                            <span class="version-label">当前版本：{{ selectedVersion.name }}</span>
                        </div>
                        <div class="diff-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>参数</th>
                                        <th>前一版本</th>
                                        <th>当前版本</th>
                                        <th>变化</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(diff, index) in selectedVersion.diffs" :key="index" :class="{ 'diff-increased': diff.change > 0, 'diff-decreased': diff.change < 0 }">
                                        <td class="param-name">{{ diff.parameter }}</td>
                                        <td class="param-value">{{ diff.previous }}</td>
                                        <td class="param-value">{{ diff.current }}</td>
                                        <td class="diff-value">
                                            <span :class="{ 'increase': diff.change > 0, 'decrease': diff.change < 0, 'unchanged': diff.change === 0 }">
                                                {{ diff.change > 0 ? '+' : '' }}{{ diff.change }}{{ diff.unit }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="empty-state" v-else>
                        <p>请选择左侧版本进行对比</p>
                    </div>
                </div>

                <!-- 版本切换板块 -->
                <div class="version-switch-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-refresh"></i>
                        版本切换
                    </h4>
                    <div class="switch-content" v-if="selectedVersion">
                        <div class="switch-info">
                            <div class="info-item">
                                <span class="label">选中版本：</span>
                                <span class="value">{{ selectedVersion.name }}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">版本状态：</span>
                                <span class="status-badge" :class="selectedVersion.status">{{ selectedVersion.status }}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">创建时间：</span>
                                <span class="value">{{ selectedVersion.date }}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">模型类型：</span>
                                <span class="value">{{ selectedVersion.modelType }}</span>
                            </div>
                        </div>
                        <div class="action-buttons">
                            <el-button 
                                type="primary" 
                                class="custom-primary-btn"
                                @click="handleSwitchVersion"
                                :disabled="selectedVersion.status === 'active'"
                            >
                                {{ selectedVersion.status === 'active' ? '已激活' : '激活此版本' }}
                            </el-button>
                            <el-button 
                                class="custom-default-btn"
                                @click="handleViewDetail"
                            >
                                查看详情
                            </el-button>
                            <el-button 
                                type="danger" 
                                plain
                                class="custom-danger-btn"
                                @click="handleDeleteVersion"
                            >
                                删除版本
                            </el-button>
                        </div>
                    </div>
                    <div class="empty-state" v-else>
                        <p>请选择左侧版本进行操作</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'DataVersionHistoryComparison',
    data() {
        return {
            selectedVersion: null,
            selectedVersionIndex: null,
            versionHistory: [
                {
                    name: 'v1.0.5',
                    date: '2025-01-15 14:30',
                    description: '改进了模型精度和训练速度',
                    author: '张三',
                    modelType: 'YOLOv8',
                    status: 'active',
                    diffs: [
                        { parameter: 'mAP', previous: '0.850', current: '0.875', change: 0.025, unit: '' },
                        { parameter: '推理速度', previous: '45ms', current: '38ms', change: -7, unit: 'ms' },
                        { parameter: '模型大小', previous: '245MB', current: '268MB', change: 23, unit: 'MB' },
                        { parameter: '准确率', previous: '92.5%', current: '94.2%', change: 1.7, unit: '%' }
                    ]
                },
                {
                    name: 'v1.0.4',
                    date: '2025-01-10 10:15',
                    description: '修复了部分数据集兼容性问题',
                    author: '李四',
                    modelType: 'YOLOv8',
                    status: 'stable',
                    diffs: [
                        { parameter: 'mAP', previous: '0.840', current: '0.850', change: 0.01, unit: '' },
                        { parameter: '推理速度', previous: '48ms', current: '45ms', change: -3, unit: 'ms' },
                        { parameter: '模型大小', previous: '240MB', current: '245MB', change: 5, unit: 'MB' },
                        { parameter: '准确率', previous: '91.8%', current: '92.5%', change: 0.7, unit: '%' }
                    ]
                },
                {
                    name: 'v1.0.3',
                    date: '2025-01-05 09:45',
                    description: '首次发布测试版本',
                    author: '王五',
                    modelType: 'YOLOv8',
                    status: 'archived',
                    diffs: [
                        { parameter: 'mAP', previous: '0.820', current: '0.840', change: 0.02, unit: '' },
                        { parameter: '推理速度', previous: '52ms', current: '48ms', change: -4, unit: 'ms' },
                        { parameter: '模型大小', previous: '235MB', current: '240MB', change: 5, unit: 'MB' },
                        { parameter: '准确率', previous: '90.5%', current: '91.8%', change: 1.3, unit: '%' }
                    ]
                }
            ]
        };
    },
    methods: {
        selectVersion(version, index) {
            this.selectedVersion = version;
            this.selectedVersionIndex = index;
        },
        handleSwitchVersion() {
            this.$message.success(`版本 ${this.selectedVersion.name} 已激活`);
        },
        handleViewDetail() {
            this.$message.info(`查看版本 ${this.selectedVersion.name} 的详情`);
        },
        handleDeleteVersion() {
            this.$confirm('确认删除此版本吗？此操作不可恢复', '警告', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.$message.success('版本已删除');
            }).catch(() => {
                this.$message.info('已取消删除');
            });
        }
    }
};
</script>

<style scoped>
.history-container {
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

/* 主内容区域 */
.content-wrapper {
    display: flex;
    gap: 20px;
    width: 100%;
    height: calc(100vh - 150px);
}

/* 版本历史板块 - 左侧 */
.version-history-section {
    flex: 0 0 35%;
    max-width: 400px;
    overflow-y: auto;
}

/* 右侧容器 */
.right-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* 差异对比板块 */
.diff-compare-section {
    flex: 1;
    overflow-y: auto;
}

/* 版本切换板块 */
.version-switch-section {
    flex: 0 0 auto;
    max-height: 350px;
    overflow-y: auto;
}

/* 通用卡片样式 */
.section-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #e8ecef;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #111f68;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 3px;
}

.section-title i {
    font-size: 18px;
}

/* 版本列表 */
.version-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.version-item {
    padding: 12px;
    border-radius: 8px;
    background-color: #f9fafb;
    border: 1px solid #e8ecef;
    cursor: pointer;
    transition: all 0.3s ease;
}

.version-item:hover {
    background-color: #f0f3f9;
    border-color: #111f68;
}

.version-item.active {
    background-color: #e8ecf5;
    border-color: #111f68;
    box-shadow: 0 2px 8px rgba(17, 31, 104, 0.15);
}

.version-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.version-name {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

.version-date {
    font-size: 12px;
    color: #8e9aaf;
}

.version-description {
    font-size: 13px;
    color: #6c757d;
    margin-bottom: 8px;
    line-height: 1.4;
}

.version-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #8e9aaf;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

.meta-item i {
    font-size: 12px;
}

/* 差异对比内容 */
.comparison-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.comparison-header {
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 6px;
    border-left: 3px solid #111f68;
}

.version-label {
    font-size: 13px;
    color: #111f68;
    font-weight: 500;
}

.diff-table {
    width: 100%;
    overflow-x: auto;
}

.diff-table table {
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

.diff-table th {
    background-color: #f9fafb;
    color: #111f68;
    font-weight: 600;
    padding: 12px;
    text-align: left;
    border-bottom: 2px solid #e8ecef;
}

.diff-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #e8ecef;
    color: #4a5568;
}

.diff-table td.param-name {
    font-weight: 500;
    color: #111f68;
}

.diff-table td.param-value {
    text-align: center;
}

.diff-table tr.diff-increased {
    background-color: #f0fdf4;
}

.diff-table tr.diff-decreased {
    background-color: #fdf2f8;
}

.diff-value {
    font-weight: 600;
    text-align: center;
}

.diff-value .increase {
    color: #10b981;
}

.diff-value .decrease {
    color: #f43f5e;
}

.diff-value .unchanged {
    color: #8e9aaf;
}

/* 版本切换内容 */
.switch-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.switch-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.info-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
}

.info-item .label {
    font-size: 13px;
    font-weight: 500;
    color: #6c757d;
    min-width: 80px;
}

.info-item .value {
    font-size: 13px;
    color: #111f68;
    font-weight: 500;
}

.status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
}

.status-badge.active {
    background-color: #d1fae5;
    color: #047857;
}

.status-badge.stable {
    background-color: #dbeafe;
    color: #0284c7;
}

.status-badge.archived {
    background-color: #f3f4f6;
    color: #6b7280;
}

/* 动作按钮 */
.action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.action-buttons .el-button {
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
    cursor: not-allowed !important;
}

.custom-default-btn {
    background-color: #ffffff !important;
    border-color: #111f68 !important;
    color: #111f68 !important;
}

.custom-default-btn:hover {
    background-color: #f0f3f9 !important;
}

.custom-danger-btn {
    border-color: #f43f5e !important;
    color: #f43f5e !important;
}

.custom-danger-btn:hover {
    background-color: #fff5f7 !important;
}

/* 空状态 */
.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #8e9aaf;
    font-size: 14px;
    background-color: #f9fafb;
    border-radius: 8px;
}

/* 滚动条样式 */
.version-history-section::-webkit-scrollbar,
.diff-compare-section::-webkit-scrollbar,
.version-switch-section::-webkit-scrollbar {
    width: 6px;
}

.version-history-section::-webkit-scrollbar-track,
.diff-compare-section::-webkit-scrollbar-track,
.version-switch-section::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.version-history-section::-webkit-scrollbar-thumb,
.diff-compare-section::-webkit-scrollbar-thumb,
.version-switch-section::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.version-history-section::-webkit-scrollbar-thumb:hover,
.diff-compare-section::-webkit-scrollbar-thumb:hover,
.version-switch-section::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

/* 响应式设计 */
@media (max-width: 1400px) {
    .content-wrapper {
        height: auto;
        flex-direction: column;
    }

    .version-history-section {
        flex: 0 0 auto;
        max-width: none;
        max-height: 400px;
    }

    .right-section {
        flex: 1;
    }

    .diff-compare-section {
        flex: 0 0 auto;
        max-height: 500px;
    }

    .version-switch-section {
        flex: 0 0 auto;
        max-height: none;
    }
}

@media (max-width: 1024px) {
    .history-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .diff-table {
        font-size: 12px;
    }

    .diff-table th,
    .diff-table td {
        padding: 8px 10px;
    }
}
</style>