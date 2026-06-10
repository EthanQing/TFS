<template>
  <div class="models-page page-container">
    <header class="md-hero">
      <div class="md-hero-content">
        <div class="md-eyebrow">训练中心</div>
        <h1 class="md-title">任务与模型</h1>
        <p class="md-subtitle">管理训练任务并查看模型性能指标。</p>
        
        <div class="md-actions">
           <!-- Action buttons can be added here if needed, currently on card or sub-nav -->
        </div>
      </div>
      
      <div class="md-hero-stats">
        <div class="hero-stat">
           <div class="stat-value">{{ filteredJobs.length }}</div>
           <div class="stat-label">任务总数</div>
        </div>
      </div>
    </header>

    <section class="md-toolbar">
       <div class="toolbar-left">
        <el-radio-group v-model="activeFramework" size="small" class="framework-filter">
            <el-radio-button
              v-for="item in frameworkTabs"
              :key="item.key"
              :label="item.key"
            >
              {{ item.label }} ({{ frameworkCounts[item.key] || 0 }})
            </el-radio-button>
        </el-radio-group>
        <div class="search-shell">
            <i class="el-icon-search"></i>
            <el-input
                v-model="searchQuery"
                placeholder="搜索模型..."
                class="search-input"
                clearable
            ></el-input>
        </div>
        
        <el-radio-group v-model="statusFilter" size="small" class="status-filter">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="running">运行中</el-radio-button>
            <el-radio-button label="completed">已完成</el-radio-button>
        </el-radio-group>
       </div>
       
       <div class="toolbar-right">
           <el-button type="primary" icon="el-icon-plus" @click="goStep1">新建 {{ activeFrameworkMeta.shortLabel }} 训练任务</el-button>
       </div>
    </section>

    <section class="md-body">
       <div v-if="filteredJobs.length === 0" class="empty-state">
           <div class="empty-icon"><i class="el-icon-cpu"></i></div>
           <div class="empty-title">暂无 {{ activeFrameworkMeta.shortLabel }} 训练任务</div>
           <div class="empty-desc">在 {{ activeFrameworkMeta.label }} 框架下创建训练任务以生成模型。</div>
           <el-button type="primary" @click="goStep1">开始 {{ activeFrameworkMeta.shortLabel }} 训练</el-button>
       </div>

       <div v-else class="models-grid">
           <article 
             v-for="job in filteredJobs" 
             :key="job.job_id" 
             class="model-card"
             @click="ShowModelDetail(job.job_id)"
           >
              <div class="card-status-strip" :class="statusClass(job.status)"></div>
              
              <div class="card-body">
                  <div class="card-header">
                      <div class="model-name" :title="job.job_name">{{ job.job_name }}</div>
                      <div class="model-sub">
                        {{ job.architecture?.model_variant || '未知变体' }}
                        <span class="framework-tag">{{ jobFrameworkLabel(job) }}</span>
                      </div>
                  </div>
                  
                  <div class="card-meta">
                      <div class="meta-row">
                          <i class="el-icon-folder-opened"></i>
                          <span>{{ job.project?.project_name || '无项目' }}</span>
                      </div>
                      <div class="meta-row">
                          <i class="el-icon-data-line"></i>
                          <span>{{ job.current_epoch }}/{{ job.parameters?.epochs || '-' }} 轮</span>
                      </div>
                  </div>
                  
                  <div class="card-footer">
                      <div class="status-badge" :class="statusClass(job.status)">
                          <span class="status-dot"></span>
                          {{ job.status || '等待中' }}
                      </div>
                      <div class="model-size">{{ formatModelSize(job.model_size_mb) }}</div>
                  </div>
              </div>

              <div class="card-actions" @click.stop>
                  <el-button 
                    v-if="job.status === 'pending'" 
                    type="success" 
                    size="mini" 
                    class="action-btn"
                    :loading="startingJobs[job.job_id]"
                    @click="startJob(job.job_id)"
                  >开始</el-button>
                  
                  <el-dropdown trigger="click" @command="handleCommand($event, job.job_id)">
                    <span class="more-btn">
                        <i class="el-icon-more"></i>
                    </span>
                    <el-dropdown-menu slot="dropdown">
                        <el-dropdown-item command="view">查看详情</el-dropdown-item>
                        <el-dropdown-item command="export" divided :disabled="jobFrameworkKey(job) === 'paddle'">
                          导出模型<span v-if="jobFrameworkKey(job) === 'paddle'">（暂不支持）</span>
                        </el-dropdown-item>
                        <el-dropdown-item command="delete" divided class="text-danger">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </el-dropdown>
              </div>
           </article>
       </div>
    </section>

    <!-- Dialogs -->
    <el-dialog
      :title="`创建 ${activeFrameworkMeta.label} 训练任务`"
      :visible.sync="dialogVisible"
      width="900px"
      custom-class="training-dialog"
      :close-on-click-modal="false"
    >
      <div class="dialog-content-wrapper">
        <component
          :is="currentDialogComponent"
          :key="activeEngine"
          :engine="activeEngine"
          :framework-label="activeFrameworkMeta.label"
          :project="selectedProjectFromContext"
          @use-project="handleUseProject"
          @task-added="onTaskAdded"
          @close="dialogVisible = false"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { fetchTrainingJobs, startTrainingJob, DeleteTrainingJob } from "@/api/training";
import ModelsStep2 from "@/views/Models/CreateModel/Step2.vue";
import { resolveFramework } from "@/utils/trainingFramework";

const FRAMEWORK_TABS = [
  { key: "pytorch", label: "PyTorch (YOLO)", shortLabel: "PyTorch", engine: "ultralytics-yolo" },
  { key: "paddle", label: "Paddle", shortLabel: "Paddle", engine: "paddle-det" },
];

export default {
  name: "ModelsIndex",
  data() {
    return {
      searchQuery: "",
      statusFilter: "all",
      activeFramework: "pytorch",
      frameworkTabs: FRAMEWORK_TABS,
      dialogVisible: false,
      trainingJobs: [],
      startingJobs: {},
      currentDialogComponent: null,
      selectedProject: null, 
    };
  },
  computed: {
    selectedProjectFromContext() {
      const pid = this.$route.query && this.$route.query.projectId
      if (pid) {
        try {
          const stored = localStorage.getItem('currentProject')
          if (stored) {
            const p = JSON.parse(stored)
            if (p && (p.project_id === pid || p.project_id === Number(pid))) return p
          }
        } catch (e) {
          0;
        }
      }
      return this.selectedProject
    },
    activeFrameworkMeta() {
      return this.frameworkTabs.find(item => item.key === this.activeFramework) || this.frameworkTabs[0];
    },
    activeEngine() {
      return this.activeFrameworkMeta.engine;
    },
    frameworkCounts() {
      return this.trainingJobs.reduce((acc, job) => {
        const key = this.jobFrameworkKey(job);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    },
    filteredJobs() {
      let jobs = this.trainingJobs.filter(job => this.jobFrameworkKey(job) === this.activeFramework);
      
      // Status Filter
      if (this.statusFilter !== 'all') {
          if (this.statusFilter === 'running') {
              jobs = jobs.filter(j => ['running', 'training'].includes(j.status?.toLowerCase()));
          } else if (this.statusFilter === 'completed') {
              jobs = jobs.filter(j => ['completed', 'success'].includes(j.status?.toLowerCase()));
          }
      }

      // Search Filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        jobs = jobs.filter(job => job.job_name.toLowerCase().includes(query));
      }
      return jobs;
    }
  },
  methods: {
    jobFramework(job) {
      if (job?.framework_key) {
        return {
          frameworkKey: job.framework_key,
          frameworkLabel: job.framework_label || (job.framework_key === "paddle" ? "Paddle" : "PyTorch"),
        };
      }
      return resolveFramework(job?.engine || job?.architecture?.engine || job?.framework_key || "");
    },
    jobFrameworkKey(job) {
      return job?.framework_key || this.jobFramework(job).frameworkKey;
    },
    jobFrameworkLabel(job) {
      return job?.framework_label || this.jobFramework(job).frameworkLabel;
    },
    statusClass(status){
      if(!status) return 'status-pending';
      const s = status.toLowerCase();
      if(s === 'completed' || s === 'success') return 'status-completed';
      if(s === 'fail' || s === 'failed' || s === 'error') return 'status-fail';
      if(s === 'running' || s === 'training') return 'status-running';
      return 'status-pending';
    },
    goStep1() {
      this.dialogVisible = true;
      this.currentDialogComponent = ModelsStep2
    },
    ShowModelDetail(jobId) {
      if (this.$route.path !== "/projectscharts/trainpart") {
        this.$router.push({
          path: "/projectscharts/trainpart",
          query: { jobId: jobId },
        });
      }
      localStorage.setItem("currentJobId", jobId);
    },
    handleCommand(command, jobId) {
      if (command === "view") this.ShowModelDetail(jobId);
      else if (command === "export") {
        const job = this.trainingJobs.find(item => String(item.job_id) === String(jobId));
        if (this.jobFrameworkKey(job) === "paddle") {
          this.$message.warning("Paddle 模型导出暂不支持。");
        } else {
          this.$message.info("Export feature coming soon");
        }
      }
      else if (command === "delete") this.deleteModel(jobId);
    },
    async deleteModel(jobId) {
      try {
        await this.$confirm("Delete this training task? This action cannot be undone.", "Confirm Delete", {
          confirmButtonText: "Delete",
          cancelButtonText: "Cancel",
          type: "warning",
        });
        await DeleteTrainingJob(jobId, { force: false });
        this.$message.success("Deleted successfully");
        this.loadTrainingJobs();
      } catch (e) {
        if (e === 'cancel' || e === 'close') return;
        if (this.isDeleteConflict(e)) {
          try {
            await this.$confirm(
              "This training task has related model versions/deployments. Force cascade delete?",
              "Force Delete",
              { confirmButtonText: "Force Delete", cancelButtonText: "Cancel", type: "warning" }
            );
            await DeleteTrainingJob(jobId, { force: true });
            this.$message.success("Deleted successfully");
            this.loadTrainingJobs();
          } catch (forceError) {
            if (forceError !== 'cancel' && forceError !== 'close') {
              this.$message.error("Delete failed: " + (forceError.message || forceError));
            }
          }
          return;
        }
        this.$message.error("Delete failed: " + (e.message || e));
      }
    },
    isDeleteConflict(error) {
      if (error && error.status === 409) return true;
      const msg = String((error && error.message) || '').toLowerCase();
      return msg.includes('cannot delete') || msg.includes('still reference');
    },
    async loadTrainingJobs() {
      try {
        this.trainingJobs = await fetchTrainingJobs();
      } catch (error) {
        this.$message.error("Failed to load tasks");
      }
    },
    async startJob(jobId) {
      this.$set(this.startingJobs, jobId, true);
      try {
        await startTrainingJob(jobId);
        this.$message.success("Training started");
        this.loadTrainingJobs();
      } catch (error) {
        this.$message.error("Failed to start training");
      } finally {
        this.$set(this.startingJobs, jobId, false);
      }
    },
    onTaskAdded() {
        this.loadTrainingJobs();
    },
    handleUseProject(project) {
       this.selectedProject = project;
       this.$nextTick(() => {
        setTimeout(() => {
          this.EventBus.$emit("projectSelected", project);
        }, 200);
      });
    },
    formatModelSize(sizeMb) {
      if (!sizeMb) return "-";
      return sizeMb.toFixed(1) + "MB";
    },
  },
  mounted() {
    this.loadTrainingJobs();
    this.EventBus.$on("taskAdded", this.loadTrainingJobs);
    this.EventBus.$on("closeDialog", () => { this.dialogVisible = false; });
    
    // Auto open logic
    const autoFlag = localStorage.getItem('autoOpenCreateJob');
    if (this.$route.query.openCreate === '1' || autoFlag === '1') {
      this.goStep1();
      if (autoFlag === '1') localStorage.removeItem('autoOpenCreateJob');
    }
  },
  beforeDestroy() {
    this.EventBus.$off("taskAdded", this.loadTrainingJobs);
    this.EventBus.$off("closeDialog");
  },
};
</script>

<style scoped>
.models-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Hero */
.md-hero {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
}

.md-hero-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.md-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary);
  font-weight: 700;
}

.md-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  line-height: 1.2;
}

.md-subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0;
}

.hero-stat {
    text-align: center;
    padding: 12px 24px;
    background: var(--bg-body);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
}

.stat-value {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-primary);
    line-height: 1;
}

.stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 4px;
    text-transform: uppercase;
}

/* Toolbar */
.md-toolbar {
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
}

.framework-filter {
  flex-shrink: 0;
}

.search-shell {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  padding: 6px 16px;
  width: 280px;
}

.search-shell:focus-within {
  border-color: var(--color-primary);
}

.search-input ::v-deep .el-input__inner {
  border: none;
  background: transparent;
  padding: 0;
  height: auto;
}

/* Grid */
.md-body {
    flex: 1;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.model-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-normal);
  display: flex;
  flex-direction: column;
  position: relative;
  cursor: pointer;
}

.model-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary-subtle);
}

.card-status-strip {
    height: 4px;
    width: 100%;
}

.status-completed { background-color: var(--color-success) !important; color: var(--color-success); }
.status-pending { background-color: #cbd5e1 !important; color: #64748b; }
.status-fail { background-color: var(--color-danger) !important; color: var(--color-danger); }
.status-running { background-color: var(--color-primary) !important; color: var(--color-primary); }

.card-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.card-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.model-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.model-sub {
    font-size: 0.85rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.framework-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border-color);
    background: var(--bg-panel);
    color: var(--text-secondary);
    font-size: 0.7rem;
    font-weight: 600;
}

.card-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
    border-top: 1px solid var(--border-light);
    border-bottom: 1px solid var(--border-light);
}

.meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: currentColor;
}

.model-size {
    font-size: 0.85rem;
    color: var(--text-main);
    font-weight: 500;
    background: var(--bg-panel);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
}

.card-actions {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
}

.more-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--text-secondary);
    transition: all 0.2s;
}

.more-btn:hover {
    background: var(--bg-panel);
    color: var(--text-main);
}

.text-danger { color: var(--color-danger); }

/* Empty */
.empty-state {
  text-align: center;
  padding: 60px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-color);
}

.empty-icon {
  font-size: 3rem;
  color: var(--text-light);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}
.empty-desc {
    color: var(--text-secondary);
    margin-bottom: 24px;
}

/* Dialog */
.dialog-content-wrapper {
    padding: 10px;
}
</style>
