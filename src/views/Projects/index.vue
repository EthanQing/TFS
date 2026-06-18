<template>
  <div class="projects-page page-container">
    <header class="pr-hero">
      <div class="pr-hero-content">
         <div class="pr-eyebrow">项目工作室</div>
        <h1 class="pr-title">项目管理</h1>
        <p class="pr-subtitle">将数据集和模型分组到专注的工作区中进行训练。</p>

        <div class="pr-actions">
           <el-button type="primary" icon="el-icon-plus" @click="dialogFormVisible = true">
            新建项目
          </el-button>
        </div>
      </div>

      <div class="pr-hero-stats">
        <div class="hero-stat">
          <div class="stat-value">{{ totalProjects }}</div>
          <div class="stat-label">项目</div>
        </div>
        <div class="hero-stat">
          <div class="stat-value">{{ totalModels }}</div>
          <div class="stat-label">模型</div>
        </div>
      </div>
    </header>

    <section class="pr-toolbar">
      <div class="toolbar-left">
        <div class="search-shell">
          <i class="el-icon-search"></i>
          <el-input
            v-model="searchQuery"
            placeholder="搜索项目..."
            class="search-input"
            clearable
          ></el-input>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="filter-group">
          <el-select v-model="activeFilter" placeholder="排序方式" class="filter-select" clearable>
            <el-option
              v-for="item in sortOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            ></el-option>
          </el-select>
        </div>
      </div>
    </section>

    <section class="pr-body">
      <section v-if="filteredProjects.length" class="project-grid">
        <article
          v-for="project in filteredProjects"
          :key="project.project_id"
          class="project-card"
          @click="goProjectsDetail(project)"
        >
          <div class="card-body">
            <div class="card-top-row">
              <span class="card-pill">
                {{ project.dataset?.dataset_name || '无标准数据集' }}
              </span>
              <div class="card-menu" @click.stop>
                <el-dropdown trigger="click" @command="handleProjectCommand($event, project)">
                  <span class="el-dropdown-link">
                    <i class="el-icon-more"></i>
                  </span>
                  <el-dropdown-menu slot="dropdown">
                    <el-dropdown-item command="view">查看详情</el-dropdown-item>
                    <el-dropdown-item command="delete" divided class="text-danger">删除项目</el-dropdown-item>
                  </el-dropdown-menu>
                </el-dropdown>
              </div>
            </div>

            <div class="card-header-group">
                <div class="card-title-row">
                  <div class="card-title">{{ project.project_name }}</div>
                  <span class="project-id-chip">ID {{ project.project_id }}</span>
                </div>
                <div class="card-date">
                   <i class="el-icon-time"></i> {{ formatDate(project.created_at) || '未知' }}
                </div>
            </div>

            <div class="card-desc">
              {{ project.description && project.description.trim() ? project.description : '暂无描述' }}
            </div>

            <div v-if="project.training_alert_view" class="training-alert" :class="project.training_alert_view.type">
              <i :class="project.training_alert_view.icon"></i>
              <span>{{ project.training_alert_view.text }}</span>
              <small v-if="project.training_alert_view.detail">{{ project.training_alert_view.detail }}</small>
            </div>

            <div class="card-stats">
              <div class="stat-item">
                <div class="stat-label">模型</div>
                <div class="stat-value">{{ project.completed_models_count }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">大小</div>
                <div class="stat-value">{{ formatSize(project.total_size_mb) }}</div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <div v-else class="empty-state">
        <div class="empty-icon"><i class="el-icon-data-board"></i></div>
        <div class="empty-title">暂无项目</div>
        <div class="empty-desc">创建您的第一个项目以开始训练模型。</div>
        <el-button type="primary" @click="dialogFormVisible = true">创建项目</el-button>
      </div>
    </section>

    <el-dialog title="创建新项目" :visible.sync="dialogFormVisible" width="700px" custom-class="project-dialog" append-to-body>
      <div class="dialog-layout">
        <div class="dialog-sidebar">
          <div class="sidebar-icon"><i class="el-icon-folder-add"></i></div>
          <h3>项目设置</h3>
          <p>项目帮助您将数据集和模型版本组织在一起。</p>
        </div>
        <div class="dialog-main">
          <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
            <el-form-item label="项目名称" prop="name">
              <el-input v-model="form.name" autocomplete="off" placeholder="例如：零售检测"></el-input>
            </el-form-item>
            <el-form-item label="描述" prop="description">
              <el-input type="textarea" :rows="2" v-model="form.description" autocomplete="off" placeholder="选填描述"></el-input>
            </el-form-item>
            <el-form-item label="关联标准数据集" prop="dataset">
              <el-select v-model="form.dataset" placeholder="选择数据集" clearable filterable style="width: 100%">
                <el-option
                  v-for="dataset in datasetList"
                  :key="dataset.dataset_id"
                  :label="dataset.dataset_name"
                  :value="dataset.dataset_id"
                >
                  <span style="float: left">{{ dataset.dataset_name }}</span>
                  <span style="float: right; color: #8492a6; font-size: 13px">{{ dataset.dataset_type }}</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogFormVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateProject">创建项目</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
// Keep logic intact, update styling structures
import { fetchProjects, createProject, deleteProject, FetchProjectsModelsSize, fetchProjectTrainingAlerts } from "@/api/projects";
import { fetchStandardDatasetOptions } from "@/api/standardDatasets";
import { cameFromTrainingAlertSource, consumeProjectTrainingAlertsDirty } from "@/utils/projectTrainingAlerts";
export default {
  name: "ProjectsIndex",
  data() {
    return {
      searchQuery: "",
      activeFilter: null,
      sortOptions: [
        { value: "time", label: "时间" },
        { value: "model", label: "模型" },
        { value: "size", label: "大小" },
      ],
      dialogFormVisible: false,
      form: { name: "", description: "", dataset: "" , user: "" },
      projects: [],
      datasetList: [],
      trainingAlertsRefreshing: false,
      rules: {
        name: [{ required: true, message: "请输入项目名称", trigger: "blur" }],
        dataset: [{ required: true, message: "请选择标准数据集", trigger: "blur" }]
      },
    };
  },
  computed: {
    totalProjects() {
      return Array.isArray(this.projects) ? this.projects.length : 0;
    },
    totalModels() {
      return Array.isArray(this.projects)
        ? this.projects.reduce((sum, p) => sum + (Number(p.completed_models_count) || 0), 0)
        : 0;
    },
    filteredProjects() {
      if (!this.searchQuery && !this.activeFilter) return this.projects;
      let result = [...this.projects];
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(project =>
          project.project_name.toLowerCase().includes(query)
        );
      }
      if (this.activeFilter === 'time') {
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } else if (this.activeFilter === 'model') {
        result.sort((a, b) => (b.completed_models_count || 0) - (a.completed_models_count || 0));
      } else if (this.activeFilter === 'size') {
        result.sort((a, b) => this.parseSize(b.total_size_mb) - this.parseSize(a.total_size_mb));
      }
      return result;
    }
  },
  methods: {
    handleProjectCommand(command, project) {
      if (!project) return;
      if (command === "view") {
        this.goProjectsDetail(project);
      } else if (command === "delete") {
        this.deleteOneProject(project);
      }
    },
    async deleteOneProject(project) {
      const pid = project?.project_id;
      const pname = project?.project_name || project?.name;
      try {
        await this.$confirm(
          `Delete project "${pname || pid}"? Associated models may need manual cleanup.`,
          'Confirm Delete',
          { confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning' }
        );
        await deleteProject(pid, { force: false });
        this.projects = this.projects.filter(p => Number(p.project_id) !== Number(pid));
        this.$message.success('Project deleted');
      } catch (e) {
        if (e === 'cancel' || e === 'close') return;
        if (this.isDeleteConflict(e)) {
          try {
            await this.$confirm(
              '该项目包含训练任务/模型版本，是否强制链式删除？',
              '确认强制删除',
              { confirmButtonText: '强制删除', cancelButtonText: '取消', type: 'warning' }
            );
            await deleteProject(pid, { force: true });
            this.projects = this.projects.filter(p => Number(p.project_id) !== Number(pid));
            this.$message.success('Project deleted');
          } catch (forceError) {
            if (forceError !== 'cancel' && forceError !== 'close') {
              this.$message.error('Delete failed: ' + (forceError.message || forceError));
            }
          }
          return;
        }
        this.$message.error('Delete failed: ' + (e.message || e));
      }
    },
    isDeleteConflict(error) {
      if (error && error.status === 409) return true;
      const msg = String((error && error.message) || '').toLowerCase();
      return msg.includes('cannot delete') || msg.includes('still reference');
    },
    hydrateProjectsWithDatasets() {
      if (!this.projects.length || !this.datasetList.length) return;
      const dsMap = new Map(this.datasetList.map(d => [Number(d.dataset_id), d]));
      this.projects = this.projects.map(p => {
        const ds = dsMap.get(Number(p.standard_dataset_id ?? p.dataset_id));
        return ds ? { ...p, dataset: { dataset_id: ds.dataset_id, dataset_name: ds.dataset_name, dataset_type: ds.dataset_type } } : p;
      });
    },
    getImageSource(src) {
      const defaultImage = require("@/assets/images/Models/image.png");
      if (!src) return defaultImage;
      if (src.startsWith("data:image") || src.startsWith("http")) return src;
      return defaultImage;
    },
    async goProjectsDetail(project) {
      localStorage.setItem('currentProject', JSON.stringify(project));
      this.$router.push({
        path: "/projectsdetail",
        query: {
          projectId: project.project_id,
          projectName: project.project_name,
          modelCount: project.completed_models_count || 0,
          modelSize: project.total_size_mb || '0MB'
        }
      });
    },
    async handleCreateProject() {
      this.$refs.formRef.validate(async (valid) => {
        if (!valid) return;
        const newProject = {
          project_name: this.form.name,
          description: this.form.description,
          standard_dataset_id: this.form.dataset,
          created_by:''
        };
        try {
          const result = await createProject({
            ...newProject,
            task_type: (this.datasetList.find(d => Number(d.dataset_id) === Number(newProject.standard_dataset_id))?.dataset_type) || 'detection'
          });
          const created = result || newProject;
          const ds = this.datasetList.find(d => Number(d.dataset_id) === Number(created.standard_dataset_id ?? created.dataset_id));
          if (ds) created.dataset = { dataset_id: ds.dataset_id, dataset_name: ds.dataset_name, dataset_type: ds.dataset_type };

          this.projects.unshift(created);
          this.$message.success("Project Created");
          this.dialogFormVisible = false;
          this.form = { name: "", description: "", dataset: ""};
        } catch (error) {
          this.$message.error("Creation failed");
        }
      });
    },
    async fetchProjectsList() {
      try {
        this.projects = await fetchProjects();
        this.hydrateProjectsWithDatasets();
        // Batch fetch sizes logic omitted for brevity, assume simple flow or keep existing
        try {
          const ids = this.projects.map(p => p.project_id).filter(Boolean);
          const sizeList = await FetchProjectsModelsSize(ids);
          const sizeMap = new Map(sizeList.map(s => [Number(s.project_id), s]));
          this.projects.forEach(project => {
             const s = sizeMap.get(Number(project.project_id));
             this.$set(project, 'completed_models_count', (s?.completed_models_count) || 0);
             this.$set(project, 'total_size_mb', (s?.total_size_mb) || '0MB');
          });
        } catch (_) {
          0;
        }
        await this.fetchProjectTrainingAlerts();
      } catch (e) {
        console.error(e);
      }
    },
    async fetchDatasetsList() {
      try {
        const list = await fetchStandardDatasetOptions();
        this.datasetList = Array.isArray(list) ? list : [];
        this.hydrateProjectsWithDatasets();
      } catch (e) {
        0;
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },
    formatSize(size) {
      if (!size) return '0MB';
      return (typeof size === 'string' && size.includes('MB')) ? size : `${parseFloat(size).toFixed(1)}MB`;
    },
    parseSize(sizeStr) {
      if (!sizeStr) return 0;
      if (typeof sizeStr === 'number') return sizeStr;
      const match = String(sizeStr).match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    },
    projectTrainingAlert(project) {
      const alert = project && project.training_alert;
      if (!alert || typeof alert !== 'object') return null;
      const runningCount = Number(alert.running_count) || 0;
      if (runningCount > 0) {
        const run = alert.latest_running_run || {};
        const progress = Number(run.progress);
        const detail = Number.isFinite(progress) && progress > 0 ? `${Math.round(progress)}%` : this.formatRunEpoch(run);
        return {
          type: 'is-running',
          icon: 'el-icon-loading',
          text: `训练中 · ${runningCount} 个任务`,
          detail,
        };
      }
      const unreviewedCount = Number(alert.unreviewed_completed_count) || 0;
      if (unreviewedCount > 0) {
        return {
          type: 'is-review',
          icon: 'el-icon-document',
          text: `待检查 · ${unreviewedCount} 个完成任务`,
          detail: '',
        };
      }
      return null;
    },
    formatRunEpoch(run) {
      const current = Number(run && run.current_epoch);
      const total = Number(run && run.total_epochs);
      if (Number.isFinite(current) && current > 0 && Number.isFinite(total) && total > 0) {
        return `${current}/${total}`;
      }
      return '';
    },
    shouldRefreshTrainingAlerts(fromRoute) {
      return cameFromTrainingAlertSource(fromRoute) || consumeProjectTrainingAlertsDirty();
    },
    async refreshProjectTrainingAlerts({ force = false } = {}) {
      if (this.trainingAlertsRefreshing) return;
      if (!force && !this.shouldRefreshTrainingAlerts(null)) return;
      if (!Array.isArray(this.projects) || !this.projects.length) {
        await this.fetchProjectsList();
        return;
      }
      await this.fetchProjectTrainingAlerts();
    },
    async fetchProjectTrainingAlerts() {
      const ids = this.projects.map(p => p.project_id).filter(Boolean);
      if (!ids.length) return;
      this.trainingAlertsRefreshing = true;
      try {
        const list = await fetchProjectTrainingAlerts(ids);
        const alertMap = new Map((Array.isArray(list) ? list : []).map(item => [Number(item.project_id), item]));
        this.projects.forEach(project => {
          const alert = alertMap.get(Number(project.project_id)) || null;
          this.$set(project, 'training_alert', alert);
          this.$set(project, 'training_alert_view', this.projectTrainingAlert({ training_alert: alert }));
        });
      } catch (e) {
        console.warn('Failed to fetch project training alerts:', e);
      } finally {
        this.trainingAlertsRefreshing = false;
      }
    },
  },
  mounted() {
    this.fetchProjectsList();
    this.fetchDatasetsList();
  },
  activated() {
    this.refreshProjectTrainingAlerts();
  },
  beforeRouteEnter(to, from, next) {
    next(vm => {
      if (cameFromTrainingAlertSource(from) || consumeProjectTrainingAlertsDirty()) {
        vm.refreshProjectTrainingAlerts({ force: true });
      }
    });
  },
  beforeRouteUpdate(to, from, next) {
    next();
    if (cameFromTrainingAlertSource(from) || consumeProjectTrainingAlertsDirty()) {
      this.refreshProjectTrainingAlerts({ force: true });
    }
  },
};
</script>

<style scoped>
.projects-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Hero */
.pr-hero {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
}

.pr-hero-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pr-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary);
  font-weight: 700;
}

.pr-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  line-height: 1.2;
}

.pr-subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0;
}

.pr-actions {
    margin-top: 16px;
}

.pr-hero-stats {
  display: flex;
  gap: 24px;
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
.pr-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.filter-group {
  min-width: 140px;
}

.search-shell {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  padding: 6px 16px;
  width: 320px;
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

.search-input ::v-deep .el-input__inner:focus {
  border: none;
  box-shadow: none;
  outline: none;
}

/* Grid */
.pr-body {
    flex: 1;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.project-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-normal);
  display: flex;
  flex-direction: column;
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary-subtle);
}

.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-pill {
  background: rgba(37, 99, 235, 0.1);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-dark);
}

.card-menu {
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.card-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.project-id-chip {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-light);
  background: var(--bg-body);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.5;
}

.card-date {
    font-size: 0.8rem;
    color: var(--text-light);
}

.card-desc {
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.5;
    height: 2.8em; /* 2 lines approx */
    overflow: hidden;
    text-overflow: ellipsis;
}

.training-alert {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-size: 0.8rem;
  font-weight: 700;
}

.training-alert small {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 700;
}

.training-alert.is-running {
  color: #1d4ed8;
  background: #eff6ff;
  border-color: #bfdbfe;
}

.training-alert.is-review {
  color: #047857;
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.card-stats {
  display: flex;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
  margin-top: auto;
}

.stat-item .stat-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-main);
}

.stat-item .stat-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    text-transform: uppercase;
}

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
.dialog-layout {
    display: flex;
    margin: -30px -20px; /* Offset dialog padding */
}

.dialog-sidebar {
    width: 220px;
    background: var(--bg-panel);
    padding: 30px 24px;
    border-right: 1px solid var(--border-light);
}

.sidebar-icon {
    font-size: 2rem;
    color: var(--color-primary);
    margin-bottom: 16px;
}

.dialog-sidebar h3 {
    font-size: 1.1rem;
    margin: 0 0 8px 0;
    color: var(--text-main);
}

.dialog-sidebar p {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
}

.dialog-main {
    flex: 1;
    padding: 30px 40px;
    max-height: 50vh;
    overflow-y: auto;
}

.text-danger {
    color: var(--color-danger);
}
</style>
