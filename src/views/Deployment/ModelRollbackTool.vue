<template>
  <div class="rollback-tool">
    <div class="tool-header premium-header">
      <div class="header-content">
        <h3 class="gradient-text"><i class="el-icon-refresh-left"></i> 模型回滚</h3>
        <p>将当前生效的部署回滚到之前成功部署的模型版本。</p>
      </div>
      <div class="tool-actions">
        <el-button class="action-btn" size="medium" @click="reloadAll" :loading="loading">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never" class="card-block">
      <div class="row">
        <div class="field">
          <label>所属项目</label>
          <el-select
            v-model="projectId"
            filterable
            clearable
            placeholder="选择项目"
            size="small"
            @change="onProjectChange"
          >
            <el-option
              v-for="p in projectList"
              :key="p.project_id"
              :label="p.name || p.project_name || `Project #${p.project_id}`"
              :value="p.project_id"
            />
          </el-select>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="card-block" v-loading="loadingDeployment">
      <template v-if="activeDeployment">
        <div class="card-title">生效的部署</div>
        <div class="kv-grid">
          <div><span class="k">ID</span><span class="v">#{{ activeDeployment.deployment_id }}</span></div>
          <div><span class="k">部署名称</span><span class="v">{{ activeDeployment.name }}</span></div>
          <div><span class="k">部署平台</span><span class="v">{{ activeDeployment.platform }}</span></div>
          <div><span class="k">当前状态</span><span class="v">{{ activeDeployment.status }}</span></div>
          <div><span class="k">当前模型版本 ID</span><span class="v">#{{ currentModelVersionId || "-" }}</span></div>
        </div>
      </template>
      <el-empty
        v-else
        :description="projectId ? '该项目下未找到生效的部署。' : '请先选择一个项目。'"
      />
    </el-card>

    <el-card shadow="never" class="card-block" v-if="activeDeployment" v-loading="loadingCandidates">
      <div class="card-title">可回滚的候选版本</div>
      <template v-if="candidateList.length">
        <el-radio-group v-model="targetModelVersionId" class="candidate-list">
          <el-radio
            v-for="item in candidateList"
            :key="item.model_version_id"
            :label="item.model_version_id"
            border
            class="candidate-item"
          >
            <div class="candidate-main">
              <div class="candidate-title">
                <span>#{{ item.model_version_id }}</span>
                <span class="version">{{ item.version }}</span>
                <el-tag size="mini">{{ item.stage }}</el-tag>
              </div>
              <div class="candidate-sub">run_id={{ item.run_id }}</div>
            </div>
          </el-radio>
        </el-radio-group>
      </template>
      <el-empty v-else description="没有可用的回滚候选版本。" />
    </el-card>

    <el-card shadow="never" class="card-block" v-if="activeDeployment">
      <div class="card-title">执行回滚</div>
      <el-form label-position="top" size="small">
        <el-form-item label="操作人">
          <el-input v-model="operator" placeholder="操作人" />
        </el-form-item>
        <el-form-item label="回滚原因" required>
          <el-input
            v-model="reason"
            type="textarea"
            :rows="3"
            placeholder="请简要说明回滚原因"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
        <div class="actions">
          <el-button
            type="primary"
            :disabled="!canSubmit"
            :loading="submitting"
            @click="submitRollback"
          >
            提交回滚
          </el-button>
        </div>
      </el-form>
    </el-card>

    <el-card shadow="never" class="card-block" v-if="activeDeployment" v-loading="loadingHistory">
      <div class="card-title">回滚时间线</div>
      <template v-if="historyList.length">
        <div class="timeline">
          <div class="timeline-item" v-for="item in historyList" :key="item.log_id">
            <div class="timeline-time">{{ formatTime(item.created_at) }}</div>
            <div class="timeline-body">
              <div class="timeline-line">
                {{ item.from_version || "-" }} (#{{ item.from_model_version_id || "-" }})
                ->
                {{ item.to_version || "-" }} (#{{ item.to_model_version_id || "-" }})
              </div>
              <div class="timeline-meta">
                <span>操作人={{ item.operator || "-" }}</span>
                <span>原因={{ item.reason || "-" }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <el-empty v-else description="暂无回滚记录。" />
    </el-card>
  </div>
</template>

<script>
import { fetchProjects } from "@/api/projects";
import {
  fetchActiveDeployment,
  fetchDeploymentRollbackCandidates,
  fetchDeploymentRollbackHistory,
  rollbackDeployment,
} from "@/api/deployments";

function parseProjectId(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default {
  name: "ModelRollbackTool",
  data() {
    return {
      loading: false,
      loadingDeployment: false,
      loadingCandidates: false,
      loadingHistory: false,
      submitting: false,
      projectList: [],
      projectId: null,
      activeDeployment: null,
      currentModelVersionId: null,
      candidateList: [],
      targetModelVersionId: null,
      reason: "",
      operator: "管理员",
      historyList: [],
    };
  },
  computed: {
    canSubmit() {
      return (
        !!this.activeDeployment &&
        Number.isFinite(Number(this.targetModelVersionId)) &&
        String(this.reason || "").trim().length > 0 &&
        !this.submitting
      );
    },
  },
  watch: {
    "$route.query.project_id"() {
      this.hydrateProjectFromContext();
    },
  },
  created() {
    this.bootstrap();
  },
  methods: {
    async bootstrap() {
      this.loading = true;
      try {
        await this.loadProjects();
        this.hydrateProjectFromContext();
        if (this.projectId) await this.loadProjectData();
      } finally {
        this.loading = false;
      }
    },
    async loadProjects() {
      try {
        this.projectList = await fetchProjects(1, 500);
      } catch (e) {
        this.projectList = [];
      }
    },
    hydrateProjectFromContext() {
      const qid = parseProjectId(this.$route?.query?.project_id);
      if (qid) {
        this.projectId = qid;
        return;
      }
      try {
        const raw = localStorage.getItem("currentProject");
        const obj = raw ? JSON.parse(raw) : null;
        const pid = parseProjectId(obj?.project_id);
        if (pid) {
          this.projectId = pid;
          return;
        }
      } catch (_) {
        0;
      }
      if (!this.projectId && this.projectList.length === 1) {
        this.projectId = this.projectList[0].project_id;
      }
    },
    onProjectChange() {
      const pid = parseProjectId(this.projectId);
      if (pid) {
        this.$router
          .replace({ path: "/deployment", query: { ...this.$route.query, tool: "rollback", project_id: pid } })
          .catch(() => {});
      }
      this.loadProjectData();
    },
    async reloadAll() {
      await this.loadProjects();
      this.hydrateProjectFromContext();
      await this.loadProjectData();
    },
    async loadProjectData() {
      this.activeDeployment = null;
      this.currentModelVersionId = null;
      this.candidateList = [];
      this.targetModelVersionId = null;
      this.historyList = [];

      const pid = parseProjectId(this.projectId);
      if (!pid) return;

      this.loadingDeployment = true;
      try {
        const dep = await fetchActiveDeployment(pid);
        this.activeDeployment = dep || null;
      } catch (e) {
        this.activeDeployment = null;
        this.$message.error(`Failed to load deployment: ${e.message || e}`);
      } finally {
        this.loadingDeployment = false;
      }

      if (!this.activeDeployment) return;
      await Promise.all([this.loadCandidates(), this.loadHistory()]);
    },
    async loadCandidates() {
      if (!this.activeDeployment) return;
      this.loadingCandidates = true;
      try {
        const data = await fetchDeploymentRollbackCandidates(this.activeDeployment.deployment_id);
        this.currentModelVersionId = Number(data?.current_model_version_id || this.activeDeployment.model_version_id || 0) || null;
        this.candidateList = Array.isArray(data?.candidates) ? data.candidates : [];
        const keep = Number(this.targetModelVersionId);
        if (!this.candidateList.some((it) => Number(it.model_version_id) === keep)) {
          this.targetModelVersionId = this.candidateList.length ? this.candidateList[0].model_version_id : null;
        }
      } catch (e) {
        this.$message.error(`Failed to load rollback candidates: ${e.message || e}`);
        this.candidateList = [];
        this.targetModelVersionId = null;
      } finally {
        this.loadingCandidates = false;
      }
    },
    async loadHistory() {
      if (!this.activeDeployment) return;
      this.loadingHistory = true;
      try {
        this.historyList = await fetchDeploymentRollbackHistory(this.activeDeployment.deployment_id, { limit: 200 });
      } catch (e) {
        this.historyList = [];
        this.$message.error(`Failed to load rollback history: ${e.message || e}`);
      } finally {
        this.loadingHistory = false;
      }
    },
    async submitRollback() {
      if (!this.canSubmit || !this.activeDeployment) return;
      try {
        await this.$confirm(
          "回滚操作会将当前生效的部署切换至选定的模型版本。是否继续？",
          "确认",
          { type: "warning", confirmButtonText: "确认回滚", cancelButtonText: "取消" }
        );
      } catch (_) {
        return;
      }

      this.submitting = true;
      try {
        const payload = {
          target_model_version_id: Number(this.targetModelVersionId),
          reason: String(this.reason || "").trim(),
          operator: String(this.operator || "").trim() || "管理员",
        };
        await rollbackDeployment(this.activeDeployment.deployment_id, payload);
        this.$message.success("回滚成功");
        this.reason = "";
        await this.loadProjectData();
      } catch (e) {
        this.$message.error(`回滚失败: ${e.message || e}`);
      } finally {
        this.submitting = false;
      }
    },
    formatTime(v) {
      if (!v) return "-";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
      return d.toLocaleString();
    },
  },
};
</script>

<style scoped>
.rollback-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.premium-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 20px 28px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(226, 232, 240, 0.8);
}
.header-content h3 {
  margin: 0 0 6px 0;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #0ea5e9, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.header-content h3 i {
  -webkit-text-fill-color: #0ea5e9;
}
.header-content p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  letter-spacing: 0.3px;
}
.tool-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.action-btn {
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 10px 18px;
}
.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.card-block {
  border-radius: 10px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}
.row {
  display: flex;
  gap: 12px;
}
.field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 12px;
  color: var(--text-secondary);
}
.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 8px 12px;
}
.k {
  display: inline-block;
  min-width: 150px;
  color: var(--text-secondary);
  font-size: 12px;
}
.v {
  color: var(--text-main);
}
.candidate-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.candidate-item {
  margin-right: 0 !important;
}
.candidate-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.candidate-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.version {
  color: var(--text-main);
}
.candidate-sub {
  color: var(--text-secondary);
  font-size: 12px;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.timeline-item {
  padding: 10px;
  border: 1px solid var(--line-200);
  border-radius: 8px;
}
.timeline-time {
  color: var(--text-secondary);
  font-size: 12px;
}
.timeline-line {
  margin-top: 4px;
  font-weight: 600;
}
.timeline-meta {
  margin-top: 4px;
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}
</style>
