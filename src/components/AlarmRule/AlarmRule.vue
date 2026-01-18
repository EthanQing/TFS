<template>
    <div class="alarm-rule-container">
        <!-- 顶部标题 -->
        <div class="top">
            <h3>告警规则</h3>
            <el-button
                type="primary"
                class="custom-primary-btn"
                @click="dialogFormVisible = true"
            >
                + 新建规则
            </el-button>
        </div>

        <!-- 主内容区域 -->
        <div class="content-wrapper">
            <!-- 左侧：规则配置 -->
            <div class="config-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-setting"></i>
                    规则配置
                </h4>

                <div class="filter-area">
                    <el-input
                        v-model="searchText"
                        placeholder="搜索规则..."
                        clearable
                        class="search-input"
                    >
                        <i slot="prefix" class="el-icon-search"></i>
                    </el-input>
                </div>

                <div class="rules-container">
                    <div
                        v-for="rule in filteredRules"
                        :key="rule.id"
                        class="rule-item"
                        :class="{ 'active': selectedRule && selectedRule.id === rule.id, 'enabled': rule.enabled }"
                        @click="selectRule(rule)"
                    >
                        <div class="rule-header">
                            <div class="rule-info">
                                <span class="rule-name">{{ rule.name }}</span>
                                <el-tag
                                    :type="rule.severity === '严重' ? 'danger' : rule.severity === '警告' ? 'warning' : 'info'"
                                    size="small"
                                    class="severity-tag"
                                >
                                    {{ rule.severity }}
                                </el-tag>
                            </div>
                            <el-switch
                                v-model="rule.enabled"
                                @change="handleRuleToggle(rule)"
                                :active-color="'#10b981'"
                                :inactive-color="'#ccc'"
                            ></el-switch>
                        </div>
                        <div class="rule-condition">
                            {{ rule.condition }}
                        </div>
                        <div class="rule-stats">
                            <span class="stat">
                                <i class="el-icon-bell"></i>
                                触发: {{ rule.triggerCount }}
                            </span>
                            <span class="stat">
                                <i class="el-icon-date"></i>
                                {{ rule.lastTrigger }}
                            </span>
                        </div>
                    </div>

                    <div v-if="filteredRules.length === 0" class="empty-state">
                        <i class="el-icon-document-copy"></i>
                        <p>暂无规则</p>
                    </div>
                </div>
            </div>

            <!-- 右侧：告警内容 -->
            <div class="right-section">
                <!-- 活跃告警列表 -->
                <div class="alerts-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-bell-outline"></i>
                        活跃告警列表
                        <el-badge :value="activeAlerts.length" class="badge-count"></el-badge>
                    </h4>

                    <div class="alerts-container">
                        <div
                            v-for="alert in activeAlerts"
                            :key="alert.id"
                            class="alert-item"
                            :class="alert.severity"
                        >
                            <div class="alert-severity">
                                <i class="el-icon-warning-outline"></i>
                            </div>
                            <div class="alert-content">
                                <div class="alert-header">
                                    <span class="alert-title">{{ alert.ruleName }}</span>
                                    <el-tag
                                        :type="alert.severity === '严重' ? 'danger' : alert.severity === '警告' ? 'warning' : 'info'"
                                        size="mini"
                                    >
                                        {{ alert.severity }}
                                    </el-tag>
                                </div>
                                <div class="alert-message">{{ alert.message }}</div>
                                <div class="alert-meta">
                                    <span class="meta-item">
                                        <i class="el-icon-date"></i>
                                        {{ alert.triggerTime }}
                                    </span>
                                    <span class="meta-item">
                                        <i class="el-icon-info"></i>
                                        {{ alert.metric }}: {{ alert.value }}
                                    </span>
                                </div>
                            </div>
                            <div class="alert-actions">
                                <el-button
                                    type="text"
                                    size="small"
                                    @click="handleDismissAlert(alert)"
                                >
                                    关闭
                                </el-button>
                            </div>
                        </div>

                        <div v-if="activeAlerts.length === 0" class="empty-alert-state">
                            <i class="el-icon-success"></i>
                            <p>暂无活跃告警</p>
                        </div>
                    </div>
                </div>

                <!-- 告警历史 -->
                <div class="history-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-document"></i>
                        告警历史
                    </h4>

                    <div class="history-filter">
                        <el-select
                            v-model="historyFilter.severity"
                            placeholder="选择严重级别"
                            clearable
                            class="filter-select"
                        >
                            <el-option label="全部" value=""></el-option>
                            <el-option label="严重" value="严重"></el-option>
                            <el-option label="警告" value="警告"></el-option>
                            <el-option label="信息" value="信息"></el-option>
                        </el-select>
                        <el-date-picker
                            v-model="historyFilter.dateRange"
                            type="daterange"
                            range-separator="至"
                            start-placeholder="开始日期"
                            end-placeholder="结束日期"
                            class="filter-date"
                        ></el-date-picker>
                    </div>

                    <div class="history-container">
                        <div
                            v-for="(item, index) in filteredHistory"
                            :key="index"
                            class="history-item"
                            :class="item.severity"
                        >
                            <div class="history-time">
                                {{ item.time }}
                            </div>
                            <div class="history-content">
                                <div class="history-title">{{ item.ruleName }}</div>
                                <div class="history-message">{{ item.message }}</div>
                                <div class="history-stats">
                                    <span class="stat">
                                        <i class="el-icon-time"></i>
                                        持续时间: {{ item.duration }}
                                    </span>
                                    <span class="stat">
                                        <i class="el-icon-data-analysis"></i>
                                        触发值: {{ item.value }}
                                    </span>
                                </div>
                            </div>
                            <div class="history-status">
                                <el-tag
                                    :type="item.status === '已解决' ? 'success' : 'warning'"
                                    size="small"
                                >
                                    {{ item.status }}
                                </el-tag>
                            </div>
                        </div>

                        <div v-if="filteredHistory.length === 0" class="empty-history-state">
                            <i class="el-icon-document"></i>
                            <p>暂无告警历史</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 新建规则对话框 -->
        <el-dialog title="新建告警规则" :visible.sync="dialogFormVisible" width="650px">
            <el-form :model="newRuleForm" :rules="rules" ref="formRef" label-width="100px">
                <el-form-item label="规则名称" prop="name">
                    <el-input v-model="newRuleForm.name" placeholder="请输入规则名称"></el-input>
                </el-form-item>
                <el-form-item label="监控指标" prop="metric">
                    <el-select v-model="newRuleForm.metric" placeholder="选择监控指标">
                        <el-option label="损失值" value="loss"></el-option>
                        <el-option label="精确度" value="accuracy"></el-option>
                        <el-option label="mAP" value="mAP"></el-option>
                        <el-option label="GPU内存" value="gpu_memory"></el-option>
                        <el-option label="CPU使用率" value="cpu_usage"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="告警条件" prop="operator">
                    <el-select v-model="newRuleForm.operator" placeholder="选择条件">
                        <el-option label="大于" value=">"></el-option>
                        <el-option label="小于" value="<"></el-option>
                        <el-option label="等于" value="=="></el-option>
                        <el-option label="大于等于" value=">="></el-option>
                        <el-option label="小于等于" value="<="></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="阈值" prop="threshold">
                    <el-input-number
                        v-model="newRuleForm.threshold"
                        placeholder="请输入阈值"
                        :min="0"
                        :max="100"
                    ></el-input-number>
                </el-form-item>
                <el-form-item label="严重级别" prop="severity">
                    <el-select v-model="newRuleForm.severity" placeholder="选择严重级别">
                        <el-option label="严重" value="严重"></el-option>
                        <el-option label="警告" value="警告"></el-option>
                        <el-option label="信息" value="信息"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="通知方式" prop="notification">
                    <el-checkbox-group v-model="newRuleForm.notification">
                        <el-checkbox label="邮件" value="email"></el-checkbox>
                        <el-checkbox label="短信" value="sms"></el-checkbox>
                        <el-checkbox label="系统消息" value="system"></el-checkbox>
                    </el-checkbox-group>
                </el-form-item>
                <el-form-item label="规则描述" prop="description">
                    <el-input
                        v-model="newRuleForm.description"
                        type="textarea"
                        placeholder="请输入规则描述"
                        rows="3"
                    ></el-input>
                </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
                <el-button @click="dialogFormVisible = false">取 消</el-button>
                <el-button type="primary" @click="handleCreateRule">创 建</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
export default {
    name: 'AlarmRule',
    data() {
        return {
            searchText: '',
            selectedRule: null,
            dialogFormVisible: false,
            historyFilter: {
                severity: '',
                dateRange: null
            },
            rules: {
                name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
                metric: [{ required: true, message: '请选择监控指标', trigger: 'change' }],
                operator: [{ required: true, message: '请选择告警条件', trigger: 'change' }],
                threshold: [{ required: true, message: '请输入阈值', trigger: 'blur' }],
                severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }],
                notification: [{ required: true, message: '请选择通知方式', trigger: 'change' }],
                description: [{ required: true, message: '请输入规则描述', trigger: 'blur' }]
            },
            newRuleForm: {
                name: '',
                metric: '',
                operator: '',
                threshold: 0,
                severity: '',
                notification: [],
                description: ''
            },
            rulesList: [
                {
                    id: 1,
                    name: '损失值异常告警',
                    severity: '严重',
                    condition: 'loss > 1.5',
                    enabled: true,
                    triggerCount: 5,
                    lastTrigger: '2小时前'
                },
                {
                    id: 2,
                    name: '精确度下降',
                    severity: '警告',
                    condition: 'accuracy < 0.85',
                    enabled: true,
                    triggerCount: 3,
                    lastTrigger: '4小时前'
                },
                {
                    id: 3,
                    name: 'mAP指标预警',
                    severity: '信息',
                    condition: 'mAP < 0.75',
                    enabled: false,
                    triggerCount: 1,
                    lastTrigger: '1天前'
                },
                {
                    id: 4,
                    name: 'GPU内存溢出',
                    severity: '严重',
                    condition: 'gpu_memory > 90%',
                    enabled: true,
                    triggerCount: 12,
                    lastTrigger: '30分钟前'
                },
                {
                    id: 5,
                    name: '训练速度下降',
                    severity: '警告',
                    condition: 'training_speed < 50',
                    enabled: true,
                    triggerCount: 2,
                    lastTrigger: '6小时前'
                }
            ],
            activeAlerts: [
                {
                    id: 1,
                    ruleName: '损失值异常告警',
                    severity: '严重',
                    message: '模型在第100个epoch时损失值异常增高',
                    triggerTime: '2026-01-16 14:32:00',
                    metric: 'loss',
                    value: '1.87'
                },
                {
                    id: 2,
                    ruleName: 'GPU内存溢出',
                    severity: '严重',
                    message: 'GPU内存使用率超过阈值',
                    triggerTime: '2026-01-16 14:25:00',
                    metric: 'gpu_memory',
                    value: '94%'
                },
                {
                    id: 3,
                    ruleName: '精确度下降',
                    severity: '警告',
                    message: '验证集精确度下降到0.82',
                    triggerTime: '2026-01-16 14:10:00',
                    metric: 'accuracy',
                    value: '0.82'
                }
            ],
            historyList: [
                {
                    time: '2026-01-16 14:32:00',
                    ruleName: '损失值异常告警',
                    message: '模型在第100个epoch时损失值异常增高',
                    severity: '严重',
                    duration: '8分钟',
                    value: '1.87',
                    status: '已解决'
                },
                {
                    time: '2026-01-16 14:25:00',
                    ruleName: 'GPU内存溢出',
                    message: 'GPU内存使用率超过阈值',
                    severity: '严重',
                    duration: '进行中',
                    value: '94%',
                    status: '告警中'
                },
                {
                    time: '2026-01-16 14:10:00',
                    ruleName: '精确度下降',
                    message: '验证集精确度下降到0.82',
                    severity: '警告',
                    duration: '20分钟',
                    value: '0.82',
                    status: '已解决'
                },
                {
                    time: '2026-01-16 12:45:00',
                    ruleName: '训练速度下降',
                    message: '平均训练速度低于预期',
                    severity: '警告',
                    duration: '45分钟',
                    value: '45',
                    status: '已解决'
                },
                {
                    time: '2026-01-16 10:15:00',
                    ruleName: 'mAP指标预警',
                    message: 'mAP指标低于设定阈值',
                    severity: '信息',
                    duration: '2小时',
                    value: '0.72',
                    status: '已解决'
                },
                {
                    time: '2026-01-15 16:30:00',
                    ruleName: '损失值异常告警',
                    message: '模型在第50个epoch时损失值波动异常',
                    severity: '严重',
                    duration: '15分钟',
                    value: '1.92',
                    status: '已解决'
                }
            ]
        };
    },
    computed: {
        filteredRules() {
            return this.rulesList.filter(rule =>
                rule.name.toLowerCase().includes(this.searchText.toLowerCase())
            );
        },
        filteredHistory() {
            return this.historyList.filter(item => {
                // 严重级别筛选
                if (this.historyFilter.severity && item.severity !== this.historyFilter.severity) {
                    return false;
                }
                
                // 日期范围筛选
                if (this.historyFilter.dateRange && this.historyFilter.dateRange.length === 2) {
                    const itemDate = new Date(item.time);
                    const startDate = new Date(this.historyFilter.dateRange[0]);
                    const endDate = new Date(this.historyFilter.dateRange[1]);
                    
                    // 设置结束日期为当天的23:59:59
                    endDate.setHours(23, 59, 59, 999);
                    
                    if (itemDate < startDate || itemDate > endDate) {
                        return false;
                    }
                }
                
                return true;
            });
        }
    },
    methods: {
        selectRule(rule) {
            this.selectedRule = JSON.parse(JSON.stringify(rule));
        },
        handleRuleToggle(rule) {
            const status = rule.enabled ? '启用' : '禁用';
            this.$message.info(`规则已${status}`);
        },
        handleDismissAlert(alert) {
            this.$confirm(`确认关闭此告警吗？`, '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                const index = this.activeAlerts.findIndex(a => a.id === alert.id);
                if (index > -1) {
                    this.activeAlerts.splice(index, 1);
                }
                this.$message.success('告警已关闭');
            }).catch(() => {
                this.$message.info('已取消操作');
            });
        },
        handleCreateRule() {
            this.$refs.formRef.validate(valid => {
                if (valid) {
                    const newRule = {
                        id: Math.max(...this.rulesList.map(r => r.id), 0) + 1,
                        name: this.newRuleForm.name,
                        severity: this.newRuleForm.severity,
                        condition: `${this.newRuleForm.metric} ${this.newRuleForm.operator} ${this.newRuleForm.threshold}`,
                        enabled: true,
                        triggerCount: 0,
                        lastTrigger: '从未触发'
                    };
                    this.rulesList.push(newRule);
                    this.$message.success('规则创建成功');
                    this.dialogFormVisible = false;
                    this.newRuleForm = {
                        name: '',
                        metric: '',
                        operator: '',
                        threshold: 0,
                        severity: '',
                        notification: [],
                        description: ''
                    };
                    this.$refs.formRef.resetFields();
                }
            });
        }
    },
    mounted() {
        this.selectRule(this.rulesList[0]);
    }
};
</script>

<style scoped>
.alarm-rule-container {
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

/* 左侧：规则配置 */
.config-section {
    flex: 0 0 35%;
    max-width: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

/* 右侧：告警内容 */
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

.badge-count {
    margin-left: 8px;
}

/* 过滤区域 */
.filter-area {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
}

.search-input {
    width: 100%;
}

.history-filter {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.filter-select {
    flex: 0 0 120px;
}

.filter-date {
    flex: 1;
}

/* 规则列表 */
.rules-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    overflow-y: auto;
    padding-right: 6px;
}

.rule-item {
    padding: 12px;
    border-radius: 8px;
    background-color: #f9fafb;
    border: 2px solid #e8ecef;
    cursor: pointer;
    transition: all 0.3s ease;
}

.rule-item:hover {
    background-color: #f0f3f9;
    border-color: #111f68;
    transform: translateX(4px);
}

.rule-item.active {
    background-color: #e8ecf5;
    border-color: #111f68;
    box-shadow: 0 4px 12px rgba(17, 31, 104, 0.15);
}

.rule-item:not(.enabled) {
    opacity: 0.6;
}

.rule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.rule-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.rule-name {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

.severity-tag {
    font-size: 11px !important;
}

.rule-condition {
    font-size: 12px;
    color: #6c757d;
    margin-bottom: 8px;
    background-color: #f5f7fa;
    padding: 6px 8px;
    border-radius: 4px;
    font-family: monospace;
}

.rule-stats {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #8e9aaf;
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
.empty-state,
.empty-alert-state,
.empty-history-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    color: #8e9aaf;
    font-size: 14px;
}

.empty-state i,
.empty-alert-state i,
.empty-history-state i {
    font-size: 32px;
    color: #d5d5d5;
}

/* 活跃告警 */
.alerts-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
}

.alert-item {
    padding: 12px;
    border-radius: 8px;
    border-left: 4px solid #8e9aaf;
    background-color: #f9fafb;
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.alert-item.严重 {
    border-left-color: #f43f5e;
    background-color: #fef2f2;
}

.alert-item.警告 {
    border-left-color: #f59e0b;
    background-color: #fffbf0;
}

.alert-item.信息 {
    border-left-color: #06b6d4;
    background-color: #f0f9fc;
}

.alert-severity {
    font-size: 20px;
    color: #f43f5e;
    flex-shrink: 0;
}

.alert-item.警告 .alert-severity {
    color: #f59e0b;
}

.alert-item.信息 .alert-severity {
    color: #06b6d4;
}

.alert-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.alert-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

.alert-title {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
}

.alert-message {
    font-size: 13px;
    color: #6c757d;
}

.alert-meta {
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

.alert-actions {
    flex-shrink: 0;
}

/* 告警历史 */
.history-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 350px;
    overflow-y: auto;
}

.history-item {
    padding: 12px;
    border-radius: 8px;
    background-color: #f9fafb;
    border-left: 4px solid #8e9aaf;
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.history-item.严重 {
    border-left-color: #f43f5e;
    background-color: #fef2f2;
}

.history-item.警告 {
    border-left-color: #f59e0b;
    background-color: #fffbf0;
}

.history-item.信息 {
    border-left-color: #06b6d4;
    background-color: #f0f9fc;
}

.history-time {
    font-size: 12px;
    color: #8e9aaf;
    flex-shrink: 0;
    min-width: 140px;
}

.history-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.history-title {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
}

.history-message {
    font-size: 12px;
    color: #6c757d;
}

.history-stats {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #8e9aaf;
}

.history-status {
    flex-shrink: 0;
}

/* 按钮样式 */
.custom-primary-btn {
    background-color: #111f68 !important;
    border-color: #111f68 !important;
    color: #fff !important;
}

.custom-primary-btn:hover {
    background-color: #0d1554 !important;
    border-color: #0d1554 !important;
}

/* 对话框样式 */
.el-dialog {
    width: 650px !important;
}

.dialog-footer {
    padding: 10px 20px !important;
}
.search-input .el-icon-search{
    margin-top: 13px;
    margin-left: 2px;
}

/* 滚动条样式 */
.rules-container::-webkit-scrollbar,
.config-section::-webkit-scrollbar,
.right-section::-webkit-scrollbar,
.alerts-container::-webkit-scrollbar,
.history-container::-webkit-scrollbar {
    width: 6px;
}

.rules-container::-webkit-scrollbar-track,
.config-section::-webkit-scrollbar-track,
.right-section::-webkit-scrollbar-track,
.alerts-container::-webkit-scrollbar-track,
.history-container::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.rules-container::-webkit-scrollbar-thumb,
.config-section::-webkit-scrollbar-thumb,
.right-section::-webkit-scrollbar-thumb,
.alerts-container::-webkit-scrollbar-thumb,
.history-container::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.rules-container::-webkit-scrollbar-thumb:hover,
.config-section::-webkit-scrollbar-thumb:hover,
.right-section::-webkit-scrollbar-thumb:hover,
.alerts-container::-webkit-scrollbar-thumb:hover,
.history-container::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

/* 响应式设计 */
@media (max-width: 1400px) {
    .content-wrapper {
        height: auto;
        flex-direction: column;
    }

    .config-section {
        flex: 0 0 auto;
        max-width: none;
        max-height: 400px;
    }

    .right-section {
        flex: 1;
    }
}

@media (max-width: 1024px) {
    .alarm-rule-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .history-filter {
        flex-direction: column;
    }

    .filter-select {
        flex: 1;
    }

    .alerts-container,
    .history-container {
        max-height: none;
    }
}
</style>