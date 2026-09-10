<template>
  <div class="version-manager">
    <header class="page-header">
      <div>
        <h2>模型版本管理</h2>
        <p>按项目管理训练任务注册的模型版本及其阶段。</p>
      </div>
      <div class="header-actions">
        <el-select
          v-model="projectId"
          filterable
          clearable
          placeholder="请选择 Project"
          :disabled="saving"
          @change="onProjectChange"
        >
          <el-option
            v-for="project in projects"
            :key="project.project_id"
            :label="project.project_name || project.name"
            :value="String(project.project_id)"
          />
        </el-select>
        <el-button
          type="primary"
          :disabled="!projectId || saving"
          @click="openCreateDialog"
          >发布新版本</el-button
        >
      </div>
    </header>

    <el-alert
      v-if="!projectId"
      title="请选择 Project 后查看模型版本。"
      type="info"
      :closable="false"
      show-icon
    />
    <template v-else>
      <section class="production-card">
        <div>
          <span class="section-label">当前生产版本</span>
          <span v-if="productionLoading">正在加载...</span>
          <span v-else-if="productionError" class="load-error">{{
            productionError
          }}</span>
          <template v-else-if="productionVersion">
            <strong>{{ productionVersion.version }}</strong
            ><span>Run {{ productionVersion.run_id }}</span
            ><span>更新于 {{ formatDate(productionVersion.updated_at) }}</span>
          </template>
          <span v-else>暂无生产版本</span>
        </div>
        <small>生产阶段是模型版本元数据，与部署状态相互独立。</small>
      </section>

      <div class="toolbar">
        <el-select
          v-model="stageFilter"
          clearable
          placeholder="全部阶段"
          :disabled="saving"
          @change="onStageFilterChange"
        >
          <el-option
            v-for="stage in stages"
            :key="stage.value"
            :label="stage.label"
            :value="stage.value"
          />
        </el-select>
        <el-button
          :loading="listLoading"
          :disabled="saving"
          @click="loadProjectData"
          >刷新</el-button
        >
      </div>

      <main class="content-grid">
        <section class="panel list-panel" v-loading="listLoading">
          <div v-if="versions.length" class="version-list">
            <button
              v-for="item in versions"
              :key="item.model_version_id"
              class="version-item"
              :disabled="saving"
              :class="{
                active:
                  selectedVersion &&
                  selectedVersion.model_version_id === item.model_version_id,
              }"
              type="button"
              @click="selectVersion(item)"
            >
              <div class="version-title">
                <strong>{{ item.version }}</strong
                ><el-tag size="mini" :type="stageType(item.stage)">{{
                  stageLabel(item.stage)
                }}</el-tag>
              </div>
              <div class="version-meta">Run {{ item.run_id }}</div>
              <div class="version-meta">{{ formatDate(item.created_at) }}</div>
              <p>{{ item.description || '暂无描述' }}</p>
            </button>
          </div>
          <el-alert
            v-if="listError"
            :title="listError"
            type="error"
            :closable="false"
            show-icon
          />
          <el-empty
            v-else-if="!listLoading && !versions.length"
            description="当前条件下暂无模型版本"
          />
          <el-pagination
            v-if="total > pageSize"
            background
            layout="prev, pager, next, total"
            :disabled="saving"
            :current-page="page"
            :page-size="pageSize"
            :total="total"
            @current-change="onPageChange"
          />
        </section>

        <section class="panel detail-panel">
          <template v-if="selectedVersion">
            <div class="panel-heading">
              <h3>版本详情</h3>
              <el-button
                size="small"
                type="primary"
                :disabled="saving || detailLoading"
                @click="openEditDialog"
                >编辑版本</el-button
              >
            </div>
            <div v-loading="detailLoading" class="details">
              <div>
                <span>ModelVersion ID</span
                ><strong>{{ selectedVersion.model_version_id }}</strong>
              </div>
              <div>
                <span>版本号</span
                ><strong>{{ selectedVersion.version }}</strong>
              </div>
              <div>
                <span>阶段</span
                ><el-tag
                  size="small"
                  :type="stageType(selectedVersion.stage)"
                  >{{ stageLabel(selectedVersion.stage) }}</el-tag
                >
              </div>
              <div>
                <span>Project ID</span
                ><strong>{{ selectedVersion.project_id }}</strong>
              </div>
              <div>
                <span>Run ID</span><strong>{{ selectedVersion.run_id }}</strong>
              </div>
              <div>
                <span>描述</span
                ><strong>{{ selectedVersion.description || '-' }}</strong>
              </div>
              <div>
                <span>创建时间</span
                ><strong>{{ formatDate(selectedVersion.created_at) }}</strong>
              </div>
              <div>
                <span>更新时间</span
                ><strong>{{ formatDate(selectedVersion.updated_at) }}</strong>
              </div>
              <div>
                <span>产物路径</span
                ><strong>{{ selectedVersion.weights_path || '-' }}</strong>
              </div>
            </div>
            <h3 class="metrics-title">Metrics</h3>
            <div v-if="metricEntries.length" class="metrics-grid">
              <div v-for="entry in metricEntries" :key="entry[0]">
                <span>{{ entry[0] }}</span
                ><strong>{{ formatMetric(entry[1]) }}</strong>
              </div>
            </div>
            <div v-else class="empty-text">暂无指标</div>
            <el-alert
              class="deprecation-hint"
              title="如不再使用此版本，请编辑版本并将阶段设为“已废弃”。"
              type="info"
              :closable="false"
            />
          </template>
          <el-empty v-else description="请选择一个模型版本" />
        </section>
      </main>
    </template>

    <el-dialog
      title="发布新版本"
      :visible.sync="createVisible"
      width="560px"
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form
        ref="createForm"
        :model="createForm"
        :rules="formRules"
        label-width="130px"
      >
        <el-form-item label="所属项目"
          ><el-input :value="currentProjectName" disabled
        /></el-form-item>
        <el-form-item label="来源 Training Run" prop="runId">
          <el-select
            v-model="createForm.runId"
            filterable
            class="full-width"
            placeholder="请选择已完成的训练任务"
            :disabled="saving"
            :loading="runsLoading"
          >
            <el-option
              v-for="run in runCandidates"
              :key="run.job_id"
              :label="runLabel(run)"
              :value="String(run.job_id)"
            />
          </el-select>
          <div v-if="runsError" class="field-error">{{ runsError }}</div>
        </el-form-item>
        <el-form-item label="版本号" prop="version"
          ><el-input
            v-model="createForm.version"
            maxlength="50"
            show-word-limit
            placeholder="例如 v1.0.0 或 release-2026-09"
            :disabled="saving"
        /></el-form-item>
        <el-form-item label="初始阶段" prop="stage"
          ><el-select
            v-model="createForm.stage"
            class="full-width"
            :disabled="saving"
            ><el-option
              v-for="stage in stages"
              :key="stage.value"
              :label="stage.label"
              :value="stage.value" /></el-select
        ></el-form-item>
        <el-form-item label="描述"
          ><el-input
            v-model="createForm.description"
            type="textarea"
            :rows="4"
            :disabled="saving"
        /></el-form-item>
      </el-form>
      <span slot="footer"
        ><el-button :disabled="saving" @click="createVisible = false"
          >取消</el-button
        ><el-button type="primary" :loading="saving" @click="submitCreate"
          >确认发布</el-button
        ></span
      >
    </el-dialog>

    <el-dialog
      title="编辑版本"
      :visible.sync="editVisible"
      width="560px"
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form
        ref="editForm"
        :model="editForm"
        :rules="formRules"
        label-width="110px"
      >
        <el-form-item label="Project ID"
          ><el-input v-model="editForm.projectId" disabled /></el-form-item
        ><el-form-item label="Run ID"
          ><el-input v-model="editForm.runId" disabled
        /></el-form-item>
        <el-form-item label="版本号" prop="version"
          ><el-input
            v-model="editForm.version"
            maxlength="50"
            show-word-limit
            :disabled="saving"
        /></el-form-item>
        <el-form-item label="阶段" prop="stage"
          ><el-select
            v-model="editForm.stage"
            class="full-width"
            :disabled="saving"
            ><el-option
              v-for="stage in stages"
              :key="stage.value"
              :label="stage.label"
              :value="stage.value" /></el-select
        ></el-form-item>
        <el-form-item label="描述"
          ><el-input
            v-model="editForm.description"
            type="textarea"
            :rows="4"
            :disabled="saving"
        /></el-form-item>
      </el-form>
      <span slot="footer"
        ><el-button :disabled="saving" @click="editVisible = false"
          >取消</el-button
        ><el-button type="primary" :loading="saving" @click="submitEdit"
          >保存</el-button
        ></span
      >
    </el-dialog>
  </div>
</template>

<script>
import { fetchProjects } from '@/api/projects';
import { fetchTrainingJobsPage } from '@/api/training';
import {
  createModelVersion,
  fetchModelVersion,
  fetchModelVersionsPage,
  updateModelVersion,
} from '@/api/modelVersions';
import { resolveFramework } from '@/utils/trainingFramework';

const STAGES = [
  { value: 'development', label: '开发' },
  { value: 'testing', label: '测试' },
  { value: 'production', label: '生产' },
  { value: 'deprecated', label: '已废弃' },
];
function normalizeId(value) {
  return String(value == null ? '' : value).trim();
}

export default {
  name: 'VersionManager',
  data() {
    return {
      projects: [],
      projectId: '',
      versions: [],
      selectedVersion: null,
      productionVersion: null,
      productionError: '',
      listError: '',
      runCandidates: [],
      runsError: '',
      page: 1,
      pageSize: 20,
      total: 0,
      stageFilter: '',
      listLoading: false,
      productionLoading: false,
      detailLoading: false,
      runsLoading: false,
      saving: false,
      createVisible: false,
      editVisible: false,
      destroyed: false,
      loadGeneration: 0,
      listRequestToken: 0,
      productionRequestToken: 0,
      detailRequestToken: 0,
      runsRequestToken: 0,
      stages: STAGES,
      createForm: {
        runId: '',
        version: '',
        stage: 'development',
        description: '',
      },
      editForm: {
        projectId: '',
        runId: '',
        version: '',
        stage: 'development',
        description: '',
      },
      editingOriginalStage: '',
      editingModelVersionId: null,
      formRules: {
        runId: [
          {
            required: true,
            message: '请选择来源 Training Run',
            trigger: 'change',
          },
        ],
        version: [
          { required: true, message: '请输入版本号', trigger: 'blur' },
          {
            min: 1,
            max: 50,
            message: '版本号长度应为 1 到 50 个字符',
            trigger: 'blur',
          },
        ],
        stage: [{ required: true, message: '请选择阶段', trigger: 'change' }],
      },
    };
  },
  computed: {
    currentProjectName() {
      const project = this.projects.find(
        (item) => String(item.project_id) === String(this.projectId)
      );
      return project ? project.project_name || project.name : this.projectId;
    },
    metricEntries() {
      const metrics = this.selectedVersion && this.selectedVersion.metrics;
      return metrics && typeof metrics === 'object' && !Array.isArray(metrics)
        ? Object.entries(metrics).slice(0, 12)
        : [];
    },
  },
  watch: {
    '$route.query.project_id'(value) {
      const id = normalizeId(value);
      if (id === normalizeId(this.projectId)) return;
      this.projectId = id;
      this.resetProjectState();
      this.loadProjectData();
    },
  },
  created() {
    this.bootstrap();
  },
  beforeDestroy() {
    this.destroyed = true;
    this.loadGeneration += 1;
    this.listRequestToken += 1;
    this.productionRequestToken += 1;
    this.detailRequestToken += 1;
    this.runsRequestToken += 1;
  },
  methods: {
    isCurrent(generation, projectId) {
      return (
        !this.destroyed &&
        generation === this.loadGeneration &&
        normalizeId(this.projectId) === projectId
      );
    },
    async bootstrap() {
      this.projectId =
        normalizeId(this.$route.query.project_id) || this.storedProjectId();
      const projectDataPromise = this.projectId
        ? this.loadProjectData()
        : Promise.resolve();
      try {
        const projects = await fetchProjects(1, 500);
        if (this.destroyed) return;
        this.projects = projects;
        await projectDataPromise;
      } catch (error) {
        if (!this.destroyed)
          this.$message.error(error.message || '加载项目失败');
      }
    },
    storedProjectId() {
      try {
        const raw = localStorage.getItem('currentProject');
        const project = raw ? JSON.parse(raw) : null;
        return normalizeId(project && project.project_id);
      } catch (_) {
        return '';
      }
    },
    async onProjectChange() {
      const projectId = normalizeId(this.projectId);
      this.projectId = projectId;
      this.resetProjectState();
      const query = { ...this.$route.query };
      if (projectId) query.project_id = projectId;
      else delete query.project_id;
      if (normalizeId(this.$route.query.project_id) !== projectId)
        await this.$router
          .replace({ path: '/modelversionmanagement', query })
          .catch(() => {});
      await this.loadProjectData();
    },
    resetProjectState() {
      this.loadGeneration += 1;
      this.listRequestToken += 1;
      this.productionRequestToken += 1;
      this.detailRequestToken += 1;
      this.runsRequestToken += 1;
      this.page = 1;
      this.versions = [];
      this.total = 0;
      this.selectedVersion = null;
      this.productionVersion = null;
      this.listError = '';
      this.productionError = '';
      this.runCandidates = [];
      this.runsError = '';
      this.listLoading = false;
      this.productionLoading = false;
      this.detailLoading = false;
      this.runsLoading = false;
      this.createVisible = false;
      this.editVisible = false;
      this.editingModelVersionId = null;
    },
    async loadProjectData() {
      const projectId = normalizeId(this.projectId);
      if (!projectId) return;
      const generation = this.loadGeneration;
      await Promise.all([
        this.loadVersions(generation, projectId),
        this.loadProduction(generation, projectId),
      ]);
    },
    async loadVersions(
      generation = this.loadGeneration,
      projectId = normalizeId(this.projectId)
    ) {
      const token = ++this.listRequestToken;
      this.detailRequestToken += 1;
      this.detailLoading = false;
      this.listLoading = true;
      this.listError = '';
      try {
        const data = await fetchModelVersionsPage({
          page: this.page,
          pageSize: this.pageSize,
          projectId,
          stage: this.stageFilter || undefined,
        });
        if (
          !this.isCurrent(generation, projectId) ||
          token !== this.listRequestToken
        )
          return;
        this.versions = Array.isArray(data && data.items) ? data.items : [];
        this.total = Number(data && data.meta && data.meta.total) || 0;
        if (this.selectedVersion)
          this.selectedVersion =
            this.versions.find(
              (item) =>
                item.model_version_id === this.selectedVersion.model_version_id
            ) || null;
      } catch (error) {
        if (
          this.isCurrent(generation, projectId) &&
          token === this.listRequestToken
        ) {
          this.versions = [];
          this.total = 0;
          this.selectedVersion = null;
          this.listError = error.message || '加载模型版本失败';
        }
      } finally {
        if (
          this.isCurrent(generation, projectId) &&
          token === this.listRequestToken
        )
          this.listLoading = false;
      }
    },
    async loadProduction(
      generation = this.loadGeneration,
      projectId = normalizeId(this.projectId)
    ) {
      const token = ++this.productionRequestToken;
      this.productionLoading = true;
      this.productionError = '';
      try {
        const data = await fetchModelVersionsPage({
          page: 1,
          pageSize: 1,
          projectId,
          stage: 'production',
        });
        if (
          !this.isCurrent(generation, projectId) ||
          token !== this.productionRequestToken
        )
          return;
        this.productionVersion = Array.isArray(data && data.items)
          ? data.items[0] || null
          : null;
      } catch (error) {
        if (
          this.isCurrent(generation, projectId) &&
          token === this.productionRequestToken
        ) {
          this.productionVersion = null;
          this.productionError = error.message || '加载生产版本失败';
        }
      } finally {
        if (
          this.isCurrent(generation, projectId) &&
          token === this.productionRequestToken
        )
          this.productionLoading = false;
      }
    },
    onStageFilterChange() {
      if (this.saving) return;
      this.page = 1;
      this.selectedVersion = null;
      this.loadVersions();
    },
    onPageChange(page) {
      if (this.saving) return;
      this.page = page;
      this.selectedVersion = null;
      this.loadVersions();
    },
    async selectVersion(item) {
      this.selectedVersion = item;
      const generation = this.loadGeneration;
      const projectId = normalizeId(this.projectId);
      const token = ++this.detailRequestToken;
      this.detailLoading = true;
      try {
        const detail = await fetchModelVersion(item.model_version_id);
        if (
          this.isCurrent(generation, projectId) &&
          token === this.detailRequestToken
        )
          this.selectedVersion = detail;
      } catch (error) {
        if (
          this.isCurrent(generation, projectId) &&
          token === this.detailRequestToken
        )
          this.$message.error(error.message || '加载版本详情失败');
      } finally {
        if (
          this.isCurrent(generation, projectId) &&
          token === this.detailRequestToken
        )
          this.detailLoading = false;
      }
    },
    async openCreateDialog() {
      this.createForm = {
        runId: '',
        version: '',
        stage: 'development',
        description: '',
      };
      this.createVisible = true;
      this.$nextTick(
        () => this.$refs.createForm && this.$refs.createForm.clearValidate()
      );
      await this.loadRunCandidates();
    },
    async loadRunCandidates() {
      const generation = this.loadGeneration;
      const projectId = normalizeId(this.projectId);
      const token = ++this.runsRequestToken;
      this.runsLoading = true;
      this.runsError = '';
      try {
        const data = await fetchTrainingJobsPage(1, 500, {
          project_id: projectId,
          status: 'completed',
        });
        if (
          !this.isCurrent(generation, projectId) ||
          token !== this.runsRequestToken
        )
          return;
        this.runCandidates = (
          Array.isArray(data && data.items) ? data.items : []
        ).filter((run) => run.status === 'completed');
      } catch (error) {
        if (
          this.isCurrent(generation, projectId) &&
          token === this.runsRequestToken
        )
          this.runsError = error.message || '加载训练任务失败';
      } finally {
        if (
          this.isCurrent(generation, projectId) &&
          token === this.runsRequestToken
        )
          this.runsLoading = false;
      }
    },
    runLabel(run) {
      const framework =
        run.framework_label || resolveFramework(run.engine).frameworkLabel;
      return `${run.job_name || '未命名训练任务'} · ${
        run.job_id
      } · ${framework}`;
    },
    openEditDialog() {
      const item = this.selectedVersion;
      this.editingModelVersionId = item.model_version_id;
      this.editingOriginalStage = item.stage;
      this.editForm = {
        projectId: String(item.project_id),
        runId: String(item.run_id),
        version: item.version || '',
        stage: item.stage,
        description: item.description || '',
      };
      this.editVisible = true;
      this.$nextTick(
        () => this.$refs.editForm && this.$refs.editForm.clearValidate()
      );
    },
    validate(refName) {
      return new Promise((resolve) => this.$refs[refName].validate(resolve));
    },
    confirmProduction(message) {
      return this.$confirm(message, '生产阶段确认', {
        type: 'warning',
        confirmButtonText: '确认继续',
        cancelButtonText: '取消',
      });
    },
    async submitCreate() {
      if (this.saving) return;
      const generation = this.loadGeneration;
      const projectId = normalizeId(this.projectId);
      this.saving = true;
      try {
        const valid = await this.validate('createForm');
        if (!valid || !this.isCurrent(generation, projectId)) return;
        const payload = {
          runId: this.createForm.runId,
          version: this.createForm.version.trim(),
          stage: this.createForm.stage,
          description: this.createForm.description.trim() || null,
        };
        if (payload.stage === 'production') {
          await this.confirmProduction(
            '设为生产版本后，当前生产版本将由后端自动标记为已废弃。确认继续？'
          );
        }
        if (!this.isCurrent(generation, projectId)) return;
        this.detailRequestToken += 1;
        await createModelVersion(payload);
        if (!this.isCurrent(generation, projectId)) return;
        this.createVisible = false;
        this.$message.success('模型版本创建成功');
        await this.loadProjectData();
      } catch (error) {
        if (
          error !== 'cancel' &&
          error !== 'close' &&
          this.isCurrent(generation, projectId)
        ) {
          this.$message.error(error.message || '创建模型版本失败');
        }
      } finally {
        this.saving = false;
      }
    },
    async submitEdit() {
      if (this.saving) return;
      const generation = this.loadGeneration;
      const projectId = normalizeId(this.projectId);
      const modelVersionId = this.editingModelVersionId;
      this.saving = true;
      try {
        const valid = await this.validate('editForm');
        if (!valid || !this.isCurrent(generation, projectId)) return;
        const patch = {
          version: this.editForm.version.trim(),
          stage: this.editForm.stage,
          description: this.editForm.description.trim() || null,
        };
        if (this.editingOriginalStage !== patch.stage) {
          if (
            this.editingOriginalStage !== 'production' &&
            patch.stage === 'production'
          ) {
            await this.confirmProduction(
              '设为生产版本后，该项目当前其它生产版本会自动变为“已废弃”。是否继续？'
            );
          } else {
            await this.$confirm(
              `确认将版本阶段改为“${this.stageLabel(patch.stage)}”？`,
              '版本阶段确认',
              {
                type: 'warning',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
              }
            );
          }
        }
        if (!this.isCurrent(generation, projectId)) return;
        this.detailRequestToken += 1;
        await updateModelVersion(modelVersionId, patch);
        if (!this.isCurrent(generation, projectId)) return;
        this.editVisible = false;
        this.$message.success('模型版本更新成功');
        await this.loadProjectData();
      } catch (error) {
        if (
          error !== 'cancel' &&
          error !== 'close' &&
          this.isCurrent(generation, projectId)
        ) {
          this.$message.error(error.message || '更新模型版本失败');
        }
      } finally {
        this.saving = false;
      }
    },
    stageLabel(value) {
      return (
        (STAGES.find((stage) => stage.value === value) || {}).label ||
        value ||
        '-'
      );
    },
    stageType(value) {
      return (
        {
          development: 'info',
          testing: 'warning',
          production: 'success',
          deprecated: 'danger',
        }[value] || 'info'
      );
    },
    formatDate(value) {
      return value ? new Date(value).toLocaleString('zh-CN') : '-';
    },
    formatMetric(value) {
      if (typeof value === 'number')
        return Number.isInteger(value)
          ? String(value)
          : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      return String(value);
    },
  },
};
</script>

<style scoped>
.version-manager {
  padding: 20px;
  color: #1f2937;
}
.page-header,
.header-actions,
.toolbar,
.panel-heading,
.version-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.page-header {
  margin-bottom: 18px;
}
.page-header h2 {
  margin: 0 0 6px;
  color: #111f68;
}
.page-header p {
  margin: 0;
  color: #6b7280;
}
.header-actions .el-select {
  width: 280px;
}
.production-card,
.panel {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}
.production-card {
  margin-bottom: 16px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.production-card div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.production-card small,
.version-meta,
.production-card span {
  color: #6b7280;
}
.production-card .section-label {
  color: #111827;
  font-weight: 600;
}
.production-card .load-error,
.field-error {
  color: #ef4444;
}
.toolbar {
  justify-content: flex-end;
  margin-bottom: 14px;
}
.toolbar .el-select {
  width: 160px;
}
.content-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(420px, 1.4fr);
  gap: 18px;
}
.panel {
  padding: 18px;
  min-height: 420px;
}
.version-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}
.version-item {
  width: 100%;
  padding: 14px;
  text-align: left;
  font: inherit;
  color: inherit;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
}
.version-item:hover,
.version-item.active {
  border-color: #111f68;
  background: #f1f3fa;
}
.version-item p {
  margin: 8px 0 0;
  color: #4b5563;
  line-height: 1.45;
}
.version-meta {
  margin-top: 6px;
  font-size: 12px;
  word-break: break-all;
}
.panel-heading h3,
.metrics-title {
  margin: 0;
  color: #111f68;
}
.details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}
.details > div,
.metrics-grid > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px;
  border-radius: 7px;
  background: #f9fafb;
  min-width: 0;
}
.details span,
.metrics-grid span {
  color: #6b7280;
  font-size: 12px;
}
.details strong,
.metrics-grid strong {
  word-break: break-word;
  font-size: 13px;
}
.metrics-title {
  margin-top: 22px;
  font-size: 16px;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.empty-text {
  margin-top: 12px;
  color: #9ca3af;
}
.deprecation-hint {
  margin-top: 20px;
}
.full-width {
  width: 100%;
}
.field-error {
  margin-top: 6px;
  font-size: 12px;
}
@media (max-width: 1000px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  .page-header,
  .production-card {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 640px) {
  .version-manager {
    padding: 12px;
  }
  .header-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  .header-actions .el-select {
    width: 100%;
  }
  .details,
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
