<template>
  <div class="projects-page page-container">
    <header class="pr-hero">
      <div class="pr-hero-left">
        <div class="pr-eyebrow">项目工作室</div>
        <h1 class="pr-title">项目管理</h1>
        <p class="pr-subtitle">将数据集和模型分组到专注的工作区中。</p>
      </div>
      <div class="pr-hero-right">
        <div class="pr-stat">
          <div class="pr-stat-label">项目数</div>
          <div class="pr-stat-value">{{ totalProjects }}</div>
        </div>
        <div class="pr-stat">
          <div class="pr-stat-label">模型数</div>
          <div class="pr-stat-value">{{ totalModels }}</div>
        </div>
        <div class="search-shell">
          <i class="el-icon-search"></i>
          <el-input
            v-model="searchQuery"
            placeholder="搜索项目"
            class="search-input"
            clearable
          ></el-input>
        </div>
        <el-button type="primary" class="primary-action" @click="dialogFormVisible = true">
          新建项目
        </el-button>
      </div>
    </header>

    <section class="pr-body">
      <section v-if="filteredProjects.length" class="project-grid">
        <article
          v-for="project in filteredProjects"
          :key="project.project_id"
          class="project-card"
          @click="goProjectsDetail(project)"
        >
          <div class="card-media">
            <img :src="getImageSource(project.imageUrl)" alt="Project" />
            <span class="card-pill">
              {{ project.dataset?.dataset_name || '无数据集' }}
            </span>
            <div class="card-menu" @click.stop>
              <el-dropdown trigger="click" @command="handleProjectCommand($event, project)">
                <span class="el-dropdown-link">
                  <i class="el-icon-more"></i>
                </span>
                <el-dropdown-menu slot="dropdown">
                  <el-dropdown-item command="view">查看详情</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除项目</el-dropdown-item>
                </el-dropdown-menu>
              </el-dropdown>
            </div>
          </div>

          <div class="card-body">
            <div class="card-header-group">
                <div class="card-title">{{ project.project_name }}</div>
                <div class="card-meta">
                <span class="meta-chip">
                    <i class="el-icon-time"></i>
                    {{ formatDate(project.created_at) || '未知日期' }}
                </span>
                </div>
            </div>
            <div class="card-desc">
              {{ project.description && project.description.trim() ? project.description : '暂无描述' }}
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
        <div class="empty-title">暂无项目</div>
        <div class="empty-desc">创建一个项目以开始训练模型。</div>
        <el-button type="primary" class="primary-action" @click="dialogFormVisible = true">创建项目</el-button>
      </div>
    </section>

    <el-dialog title="创建项目" :visible.sync="dialogFormVisible" width="760px" custom-class="project-dialog">
      <div class="dialog-shell">
        <div class="dialog-aside">
          <div class="aside-badge">工作区</div>
          <div class="aside-title">项目简介</div>
          <p class="aside-text">项目可以帮助您组织相关的数据集和模型。</p>
          <div class="aside-pills">
            <span>数据集</span>
            <span>训练</span>
            <span>模型</span>
          </div>
        </div>
        <div class="dialog-form">
          <el-form :model="form" :rules="rules" ref="formRef">
            <el-form-item label="项目名称" :label-width="formLabelWidth" prop="name">
              <el-input v-model="form.name" autocomplete="off" placeholder="例如：零售检测"></el-input>
            </el-form-item>
            <el-form-item label="描述" :label-width="formLabelWidth" prop="description">
              <el-input v-model="form.description" autocomplete="off" placeholder="选填备注"></el-input>
            </el-form-item>
            <el-form-item label="数据集" :label-width="formLabelWidth" prop="dataset">
              <el-select v-model="form.dataset" placeholder="选择一个数据集" clearable filterable>
                <el-option
                  v-for="dataset in datasetList"
                  :key="dataset.dataset_id"
                  :label="dataset.dataset_name"
                  :value="dataset.dataset_id"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogFormVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateProject">创建</el-button>
      </div>
    </el-dialog>
  </div>
</template>


<script>
import { fetchProjects, createProject, deleteProject, FetchProjectModelsSize, FetchProjectsModelsSize } from "@/api/projects";
import { fetchDatasets } from "@/api/datasets";
export default {
  name: "Projects",
  data() {
    return {
      searchQuery: "", // Search keywords
      dialogFormVisible: false,
      form: { name: "", description: "", dataset: "" , user: "" },
      formLabelWidth: "120px",
      projects: [],
      datasetList: [],
      bodyOverflowBackup: "",
      htmlOverflowBackup: "",
      rules: {
        name: [{ required: true, message: "请输入项目名称", trigger: "blur" }],
        description: [
          { message: "请输入描述", trigger: "blur" },
        ],
        dataset: [{ required: true, message: "请选择数据集", trigger: "blur" }]
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
    // 实时筛选项目列表
    filteredProjects() {
      // 如果没有搜索关键词，返回所有项目
      if (!this.searchQuery) {
        return this.projects;
      }
      
      // 转换为小写以实现不区分大小写的搜索
      const query = this.searchQuery.toLowerCase();
      
      // 只根据项目名称进行筛选
      return this.projects.filter(project => 
        project.project_name.toLowerCase().includes(query)
      );
    }
  },
  methods: {
    handleProjectCommand(command, project) {
      if (!project) return;
      if (command === "view") {
        this.goProjectsDetail(project);
        return;
      }
      if (command === "delete") {
        this.deleteOneProject(project);
      }
    },
    async deleteOneProject(project) {
      const pid = project && project.project_id;
      const pname = project && (project.project_name || project.name) || '';
      try {
        await this.$confirm(
          `确定要删除项目 \"${pname || pid}\" 吗? 如果它包含训练任务或模型版本，删除可能会被阻止。`,
          '确认删除',
          {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
      } catch (_) {
        return;
      }

      try {
        await deleteProject(pid, { force: true });
        this.projects = Array.isArray(this.projects) ? this.projects.filter(p => Number(p.project_id) !== Number(pid)) : [];

        // 清理本地缓存的 currentProject（避免删除后仍进入详情）
        try {
          const stored = localStorage.getItem('currentProject');
          if (stored) {
            const cp = JSON.parse(stored);
            if (cp && Number(cp.project_id) === Number(pid)) {
              localStorage.removeItem('currentProject');
            }
          }
        } catch (_) {}

        this.$message({ type: 'success', message: '项目已删除' });
      } catch (e) {
        this.$message({ type: 'error', message: '删除失败: ' + (e && e.message ? e.message : e) });
      }
    },
    // 用 dataset_id 将项目补齐 dataset 信息（后端 ProjectOut 只返回 dataset_id）
    hydrateProjectsWithDatasets() {
      if (!Array.isArray(this.projects) || !Array.isArray(this.datasetList) || this.datasetList.length === 0) return;
      const dsMap = new Map(this.datasetList.map(d => [Number(d.dataset_id), d]));
      this.projects = this.projects.map(p => {
        const ds = dsMap.get(Number(p.dataset_id));
        if (!ds) return p;
        return {
          ...p,
          dataset: {
            dataset_id: ds.dataset_id,
            dataset_name: ds.dataset_name,
            dataset_type: ds.dataset_type
          }
        };
      });
    },
    // 处理图片路径（支持本地和网络图片）
    getImageSource(src) {
      // 使用静态导入避免 webpack 警告
      const defaultImage = require("@/assets/images/Models/image.png");
      
      if (!src) return defaultImage;
      if (src.startsWith("data:image") || src.startsWith("http")) return src;
      
      // 对于相对路径，直接返回默认图片避免动态 require
      return defaultImage;
    },

    // 跳转到项目详情
    async goProjectsDetail(project) {
      // 确保项目对象已经包含最新的模型数量和大小信息
      if (project.project_id && (project.completed_models_count === undefined || !project.total_size_mb)) {
        console.log("Project missing model stats, refreshing:", project.project_id);
        try {
          // 直接获取项目模型大小信息
          const sizeResult = await FetchProjectModelsSize(project.project_id);
          console.log("Project model stats:", sizeResult);
          
          // 更新项目对象
          this.$set(project, 'completed_models_count', sizeResult.completed_models_count || 0);
          this.$set(project, 'total_size_mb', sizeResult.total_size_mb || '0MB');
          
          // 立即保存到localStorage，确保数据被更新
          console.log("Updated project:", project);
          localStorage.setItem('currentProject', JSON.stringify(project));
        } catch (error) {
          console.error(`Failed to fetch model stats for project ${project.project_id}:`, error);
          // 设置默认值
          project.completed_models_count = 0;
          project.total_size_mb = '0MB';
        }
      } else {
        console.log("Project already has model stats:", project);
      }
      
      // 保存项目信息到localStorage，以便其他组件访问
      localStorage.setItem('currentProject', JSON.stringify(project));
      
      // 执行路由跳转
      if (this.$route.path !== "/projectsdetail") {
        this.$router.push({
          path: "/projectsdetail",
          query: {
            projectId: project.project_id,
            projectName: project.project_name,
            modelCount: project.completed_models_count || 0,
            modelSize: project.total_size_mb || '0MB'
          }
        });
      }
    },

    // 创建新项目
    async handleCreateProject() {
      this.$refs.formRef.validate(async (valid) => {
        if (valid) {
          // 创建新项目对象
          const newProject = {
            project_name: this.form.name,
            description: this.form.description,
            dataset_id: this.form.dataset,
            // created_by 字段已移除，后端若有默认将自动填充
            created_by:''
          };

          try {
            console.log("Creating project payload:", newProject);
            const result = await createProject({
              ...newProject,
              // project 的 task_type 由所选数据集决定（与后端校验保持一致）
              task_type: (this.datasetList.find(d => Number(d.dataset_id) === Number(newProject.dataset_id))?.dataset_type) || 'detection'
            });
            console.log("Create project result:", result);

            const created = result || newProject;
            // 补齐 dataset 用于列表展示
            const ds = this.datasetList.find(d => Number(d.dataset_id) === Number(created.dataset_id));
            if (ds) {
              created.dataset = {
                dataset_id: ds.dataset_id,
                dataset_name: ds.dataset_name,
                dataset_type: ds.dataset_type
              };
            }

            // 添加到项目列表（用后端返回为准，避免缺字段）
            this.projects.unshift(created);
            this.$message({ message: "项目已创建", type: "success" });

            // 重置状态
            this.resetForm();
            return;
          } catch (error) {
            console.error("Create project failed:", error);
            this.$message.error("创建失败，请重试");
            return;
          }
        } else {
          this.$message.error("请填写必填项");
          return false;
        }
      });
    },

    // 重置表单状态
    resetForm() {
      this.dialogFormVisible = false;
  this.form = { name: "", description: "", dataset: ""};
    },
    async fetchProjectsList() {
      try {
        const result = await fetchProjects();
        this.projects = result;
        this.hydrateProjectsWithDatasets();
        // console.log("获取项目列表:", this.projects);

        // 批量获取所有项目的模型数量/大小（更高性能，避免逐个请求）
        try {
          const ids = Array.isArray(this.projects) ? this.projects.map(p => p && p.project_id).filter(Boolean) : [];
          const sizeList = await FetchProjectsModelsSize(ids);
          const sizeMap = new Map((Array.isArray(sizeList) ? sizeList : []).map(s => [Number(s.project_id), s]));

          for (const project of this.projects) {
            const projectId = Number(project && project.project_id);
            const s = sizeMap.get(projectId);
            this.$set(project, 'completed_models_count', (s && s.completed_models_count) || 0);
            this.$set(project, 'total_size_mb', (s && s.total_size_mb) || '0MB');
          }
        } catch (error) {
          console.error("Batch model stats fetch failed:", error);
          // 回退：全部置零，避免页面报错
          for (const project of this.projects) {
            project.completed_models_count = 0;
            project.total_size_mb = '0MB';
          }
        }
        
        // 强制更新视图以确保数据变化被检测到
        this.$forceUpdate();
        
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      }
    },
    async fetchDatasetsList() {
      try {
        const result = await fetchDatasets();
        // console.log("获取数据集列表:", result);
        this.datasetList = result;
        this.hydrateProjectsWithDatasets();
      } catch (error) {
        console.error("Failed to fetch datasets:", error);
      }
    },

    // 格式化日期
    formatDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US');
    },

    // 格式化大小，确保都有MB单位
    formatSize(size) {
      if (!size) return '0MB';
      
      // 如果已经包含MB单位，直接返回
      if (typeof size === 'string' && size.includes('MB')) {
        return size;
      }
      
      // 如果是数字或者纯数字字符串，添加MB单位
      const numericSize = typeof size === 'string' ? parseFloat(size) : size;
      if (!isNaN(numericSize)) {
        return `${numericSize}MB`;
      }
      
      // 默认返回0MB
      return '0MB';
    },
  },
  mounted() {
    this.fetchProjectsList();
    this.fetchDatasetsList();
    // Removed old body overflow hacks for cleaner layout control
  },
};
</script>

<style scoped>
.projects-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Hero Section */
.pr-hero {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  padding: 2rem;
  border-radius: var(--radius-lg);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: var(--text-main);
  position: relative;
  overflow: hidden;
}

/* Decorative background bloom for hero */
.pr-hero::before {
  content: none;
}

.pr-hero-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
}

.pr-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-primary);
  font-weight: 600;
}

.pr-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.pr-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.pr-hero-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.pr-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 1.25rem;
  background: #f3f4f6;
  border-radius: var(--radius-md);
  border: 1px solid #e5e7eb;
}

.pr-stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.pr-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
}

/* Search */
.search-shell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border-radius: var(--radius-full);
  border: 1px solid #e5e7eb;
  transition: all 0.3s ease;
}

.search-shell:focus-within {
  background: #ffffff;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
}

.search-shell i {
  color: var(--text-secondary);
}

.search-input ::v-deep .el-input__inner {
  border: none;
  background: transparent;
  color: var(--text-main);
  height: auto;
  padding: 0;
  line-height: normal;
}

.search-input ::v-deep .el-input__inner::placeholder {
  color: var(--text-secondary);
  opacity: 0.7;
}

.primary-action {
  border-radius: var(--radius-full) !important;
  padding-left: 1.5rem !important;
  padding-right: 1.5rem !important;
  font-weight: 600;
}

/* Grid & Cards */
.pr-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: var(--bg-card-glass);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-normal);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
}

.project-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary-light);
}

.card-media {
  height: 140px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(30, 41, 59, 0.05) 100%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-media img {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
}

.card-pill {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(255, 255, 255, 0.9);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  box-shadow: var(--shadow-sm);
}

.card-menu {
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: var(--text-secondary);
  padding: 0.25rem;
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.6em;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: rgba(0,0,0,0.03);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}

.card-stats {
  margin-top: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  border-top: 1px solid rgba(0,0,0,0.05);
  padding-top: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  background: var(--bg-card-glass);
  border-radius: var(--radius-lg);
  border: 1px dashed rgba(0,0,0,0.1);
  text-align: center;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.empty-desc {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

/* Dialog Styles Override (Scoped to this component but applied via deep) */
.project-dialog ::v-deep .el-dialog {
  overflow: hidden;
}

.dialog-shell {
  display: flex;
  gap: 0;
  margin: -20px -24px -8px;
  height: 400px;
}

.dialog-aside {
  width: 240px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-right: 1px solid #e2e8f0;
}

.aside-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: var(--radius-full);
  align-self: flex-start;
}

.aside-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}

.aside-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.aside-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.aside-pills span {
  padding: 0.25rem 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.dialog-form {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.dialog-footer {
  padding: 1rem 1.5rem;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

@media (max-width: 960px) {
  .pr-hero {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
