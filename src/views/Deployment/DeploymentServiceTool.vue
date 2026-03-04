<template>
  <div class="deploy-service-tool">
    <div class="tool-head">
      <div>
        <h3>模型部署服务</h3>
        <p>手动部署，包含完整步骤、进度、日志、重试及回滚入口。</p>
      </div>
      <div class="head-actions">
        <el-button size="small" @click="reloadAll" :loading="loading">刷新</el-button>
        <el-button size="small" type="warning" @click="goRollback" :disabled="!projectId">回滚</el-button>
      </div>
    </div>

    <el-card shadow="never" class="card-block">
      <div class="card-title">流水线配置</div>
      <el-form label-position="top" size="small" class="form-grid">
        <el-form-item label="所属项目">
          <el-select v-model="projectId" filterable clearable placeholder="选择项目" @change="onProjectChange">
            <el-option
              v-for="p in projectList"
              :key="p.project_id"
              :label="p.name || p.project_name || `Project #${p.project_id}`"
              :value="p.project_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="模型版本">
          <el-select v-model="modelVersionId" filterable clearable placeholder="选择模型版本">
            <el-option
              v-for="mv in modelVersions"
              :key="mv.model_version_id"
              :label="`${mv.version} (#${mv.model_version_id})`"
              :value="mv.model_version_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部署名称">
          <el-input v-model="deploymentName" placeholder="例如 production-gateway" />
        </el-form-item>
        <el-form-item label="部署平台">
          <el-select v-model="platform" disabled>
            <el-option label="local (v1)" value="local" />
          </el-select>
        </el-form-item>
        <el-form-item label="复用已有部署 (可选)">
          <el-select v-model="selectedDeploymentId" clearable placeholder="留空则创建新部署">
            <el-option
              v-for="d in deployments"
              :key="d.deployment_id"
              :label="`${d.name} (#${d.deployment_id}) [${d.status}]`"
              :value="d.deployment_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="API Key 轮换">
          <el-switch v-model="rotateApiKey" active-text="执行并轮换" inactive-text="保留现有" />
        </el-form-item>
        <el-form-item label="默认置信度">
          <el-slider v-model="defaults.conf" :min="0" :max="1" :step="0.01" show-input />
        </el-form-item>
        <el-form-item label="默认 IoU">
          <el-slider v-model="defaults.iou" :min="0" :max="1" :step="0.01" show-input />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="card-block">
      <div class="card-title">触发配置</div>
      <div class="trigger-row">
        <el-tag type="success">手动触发已开启</el-tag>
        <el-tag type="info">Webhook (敬请期待)</el-tag>
        <el-tag type="info">定时调度 (敬请期待)</el-tag>
      </div>
      <el-form label-position="top" size="small" class="trigger-form">
        <el-form-item label="操作人">
          <el-input v-model="operator" />
        </el-form-item>
        <el-form-item label="部署原因">
          <el-input v-model="reason" type="textarea" :rows="2" placeholder="选填，部署原因描述" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="card-block">
      <div class="card-title">7.4 步骤编排</div>
      <div class="step-list">
        <div v-for="s in steps" :key="s.key" class="step-item" :class="`st-${s.status || 'pending'}`">
          <div class="step-name">{{ s.name }}</div>
          <div class="step-status">{{ s.status || "等待中" }}</div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="card-block">
      <div class="card-title">部署进度</div>
      <el-progress :percentage="Number(progress || 0)" :status="progressStatus" :stroke-width="16" />
      <div class="progress-meta">
        <span>状态: <b>{{ runStatus || "-" }}</b></span>
        <span>阶段: <b>{{ phase || "-" }}</b></span>
        <span>当前步骤: <b>{{ currentStep || "-" }}</b></span>
        <span v-if="runId">运行 ID: <b>{{ runId }}</b></span>
      </div>
      <div v-if="wsHint" class="warn-line">{{ wsHint }}</div>
      <div v-if="errorMessage" class="error-line">{{ errorMessage }}</div>
    </el-card>

    <el-card shadow="never" class="card-block">
      <div class="card-title">执行日志</div>
      <div class="log-box">
        <div v-if="!logs.length" class="empty-tip">暂无日志。</div>
        <div v-for="row in logs" :key="row.seq" class="log-row">
          <span class="log-seq">#{{ row.seq }}</span>
          <span class="log-lvl">[{{ row.level }}]</span>
          <span class="log-msg">{{ row.message }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="card-block">
      <div class="card-title">重试与回滚</div>
      <div class="action-row">
        <el-button type="primary" :loading="executing" :disabled="!canExecute" @click="startDeployment">
          执行部署
        </el-button>
        <el-button type="warning" :disabled="!canRetry" :loading="executing" @click="retryDeployment">重试</el-button>
        <el-button type="danger" :disabled="!canCancel" :loading="cancelLoading" @click="cancelRun">取消</el-button>
        <el-button @click="goRollback" :disabled="!projectId">前往回滚工具</el-button>
      </div>

      <div v-if="issuedApiKey" class="key-box">
        <div class="key-title">部署 API Key (仅显示一次)</div>
        <el-input :value="issuedApiKey" readonly size="small">
          <el-button slot="append" @click="copyIssuedKey">复制</el-button>
        </el-input>
        <div class="key-hint">提示: {{ apiKeyHint || "-" }}</div>
      </div>

      <div v-if="deploymentInfo && deploymentInfo.endpoint_url" class="endpoint-box">
        <div><b>推理接口:</b> {{ deploymentInfo.endpoint_url }}</div>
        <div><b>健康检查:</b> {{ deploymentInfo.health_check_url || "-" }}</div>
        <div><b>API Key 提示:</b> {{ deploymentInfo.api_key_hint || "-" }}</div>
      </div>
    </el-card>
  </div>
</template>

<script>
import { API_BASE } from "@/utils/request";
import { fetchProjects } from "@/api/projects";
import { createDeployment, fetchDeployment, fetchDeploymentsPage } from "@/api/deployments";
import {
  cancelDeploymentRun,
  executeDeployment,
  fetchDeploymentRun,
  fetchDeploymentRunLogs,
  openDeploymentRunStream,
  retryDeploymentRun,
} from "@/api/deploymentRuntime";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

function parseProjectId(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function statusToProgressStatus(st) {
  if (st === "failed") return "exception";
  if (st === "cancelled") return "warning";
  if (st === "completed") return "success";
  return null;
}

export default {
  name: "DeploymentServiceTool",
  data() {
    return {
      loading: false,
      executing: false,
      cancelLoading: false,
      projectList: [],
      projectId: null,
      modelVersions: [],
      modelVersionId: null,
      deploymentName: "production-gateway",
      platform: "local",
      deployments: [],
      selectedDeploymentId: null,
      rotateApiKey: true,
      defaults: { conf: 0.25, iou: 0.45 },
      operator: "admin",
      reason: "",

      runId: "",
      runStatus: "",
      phase: "",
      progress: 0,
      currentStep: "",
      steps: [
        { key: "validate_artifacts", name: "校验产物", status: "pending" },
        { key: "materialize_runtime", name: "准备环境", status: "pending" },
        { key: "smoke_test", name: "冒烟测试", status: "pending" },
        { key: "activate", name: "激活生效", status: "pending" },
      ],
      logs: [],
      lastSeq: 0,
      streamHandle: null,
      pollTimer: null,
      wsHint: "",
      errorMessage: "",
      issuedApiKey: "",
      apiKeyHint: "",
      deploymentInfo: null,
    };
  },
  computed: {
    canExecute() {
      return !!this.projectId && (!!this.selectedDeploymentId || !!this.modelVersionId) && !this.isRunning;
    },
    isRunning() {
      return this.runStatus === "queued" || this.runStatus === "running";
    },
    canRetry() {
      return !!this.runId && (this.runStatus === "failed" || this.runStatus === "cancelled");
    },
    canCancel() {
      return !!this.runId && this.isRunning;
    },
    progressStatus() {
      return statusToProgressStatus(this.runStatus);
    },
  },
  created() {
    this.bootstrap();
  },
  beforeDestroy() {
    this.stopStream();
    this.stopPolling();
  },
  methods: {
    async bootstrap() {
      this.loading = true;
      try {
        this.projectList = await fetchProjects(1, 500);
        this.hydrateProjectFromContext();
        if (this.projectId) await this.loadProjectData();
      } catch (e) {
        this.$message.error(`Failed to load project context: ${e.message || e}`);
      } finally {
        this.loading = false;
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
        if (pid) this.projectId = pid;
      } catch (_) {
        0;
      }
    },
    async reloadAll() {
      await this.bootstrap();
    },
    async onProjectChange() {
      const pid = parseProjectId(this.projectId);
      if (!pid) return;
      this.$router.replace({ path: "/deployment", query: { ...this.$route.query, tool: "deploy-service", project_id: pid } }).catch(() => {});
      await this.loadProjectData();
    },
    async loadProjectData() {
      const pid = parseProjectId(this.projectId);
      if (!pid) return;
      this.stopStream();
      this.stopPolling();
      this.resetRunState();

      await Promise.all([this.loadModelVersions(pid), this.loadDeployments(pid)]);
      if (!this.modelVersionId && this.modelVersions.length) this.modelVersionId = this.modelVersions[0].model_version_id;
    },
    async loadModelVersions(projectId) {
      const url = `${API_BASE}/api/v2/model-versions?project_id=${encodeURIComponent(projectId)}&page=1&page_size=500`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || data?.message || "Failed to load model versions");
      this.modelVersions = Array.isArray(data?.items) ? data.items : [];
    },
    async loadDeployments(projectId) {
      const page = await fetchDeploymentsPage({ projectId, page: 1, pageSize: 500 });
      this.deployments = Array.isArray(page?.items) ? page.items : [];
      if (this.selectedDeploymentId && !this.deployments.some((d) => Number(d.deployment_id) === Number(this.selectedDeploymentId))) {
        this.selectedDeploymentId = null;
      }
    },
    async ensureDeploymentId() {
      if (this.selectedDeploymentId) return Number(this.selectedDeploymentId);
      if (!this.modelVersionId) throw new Error("Please select model version");
      const payload = {
        model_version_id: Number(this.modelVersionId),
        name: String(this.deploymentName || "").trim() || `deployment-${Date.now()}`,
        platform: this.platform || "local",
      };
      const created = await createDeployment(payload);
      const depId = Number(created?.deployment_id);
      if (!Number.isFinite(depId)) throw new Error("Create deployment failed: missing deployment_id");
      this.selectedDeploymentId = depId;
      await this.loadDeployments(this.projectId);
      return depId;
    },
    async startDeployment() {
      if (!this.canExecute) return;
      this.executing = true;
      this.errorMessage = "";
      this.wsHint = "";
      this.issuedApiKey = "";
      this.apiKeyHint = "";
      try {
        const depId = await this.ensureDeploymentId();
        const out = await executeDeployment(depId, {
          operator: String(this.operator || "admin").trim() || "admin",
          reason: String(this.reason || "").trim() || null,
          rotate_api_key: !!this.rotateApiKey,
          conf: Number(this.defaults.conf),
          iou: Number(this.defaults.iou),
        });
        this.applyRun(out?.run || {});
        this.issuedApiKey = String(out?.issued_api_key || "");
        this.apiKeyHint = String(out?.api_key_hint || "");
        this.startStream(this.runId);
        await this.refreshDeploymentInfo(depId);
      } catch (e) {
        this.errorMessage = e.message || String(e);
        this.$message.error(`Execute failed: ${this.errorMessage}`);
      } finally {
        this.executing = false;
      }
    },
    async retryDeployment() {
      if (!this.canRetry || !this.runId) return;
      this.executing = true;
      this.errorMessage = "";
      this.wsHint = "";
      try {
        const out = await retryDeploymentRun(this.runId, {
          operator: String(this.operator || "admin").trim() || "admin",
          reason: String(this.reason || "").trim() || null,
          rotate_api_key: !!this.rotateApiKey,
          conf: Number(this.defaults.conf),
          iou: Number(this.defaults.iou),
        });
        this.logs = [];
        this.lastSeq = 0;
        this.applyRun(out?.run || {});
        this.issuedApiKey = String(out?.issued_api_key || "");
        this.apiKeyHint = String(out?.api_key_hint || "");
        this.startStream(this.runId);
        if (this.selectedDeploymentId) await this.refreshDeploymentInfo(this.selectedDeploymentId);
      } catch (e) {
        this.errorMessage = e.message || String(e);
        this.$message.error(`Retry failed: ${this.errorMessage}`);
      } finally {
        this.executing = false;
      }
    },
    async cancelRun() {
      if (!this.runId || !this.canCancel) return;
      this.cancelLoading = true;
      try {
        const run = await cancelDeploymentRun(this.runId);
        this.applyRun(run || {});
      } catch (e) {
        this.$message.error(`Cancel failed: ${e.message || e}`);
      } finally {
        this.cancelLoading = false;
      }
    },
    goRollback() {
      const pid = parseProjectId(this.projectId);
      if (!pid) return;
      this.$router.replace({ path: "/deployment", query: { ...this.$route.query, tool: "rollback", project_id: pid } }).catch(() => {});
    },
    applyRun(run) {
      if (!run || !run.run_id) return;
      this.runId = String(run.run_id);
      this.runStatus = String(run.status || "");
      this.phase = String(run.phase || "");
      this.progress = Number(run.progress || 0);
      this.currentStep = String(run.current_step || "");
      const ss = run.snapshot && Array.isArray(run.snapshot.steps) ? run.snapshot.steps : null;
      if (ss && ss.length) {
        this.steps = ss.map((x) => ({
          key: String(x.key || ""),
          name: String(x.name || x.key || ""),
          status: String(x.status || "pending"),
        }));
      }
      if (run.error_message) this.errorMessage = String(run.error_message);
    },
    appendLog(row) {
      const seq = Number(row?.seq || 0);
      if (!Number.isFinite(seq) || seq <= this.lastSeq) return;
      this.lastSeq = seq;
      this.logs.push({
        seq,
        level: String(row.level || "INFO"),
        message: String(row.message || ""),
      });
      if (this.logs.length > 1000) this.logs = this.logs.slice(this.logs.length - 1000);
    },
    startStream(runId) {
      this.stopStream();
      this.stopPolling();
      if (!runId) return;
      this.streamHandle = openDeploymentRunStream(
        runId,
        {
          onSnapshot: (data) => this.applyRun(data),
          onProgress: (data) => this.applyRun(data),
          onLog: (row) => this.appendLog(row),
          onDone: async () => {
            this.stopStream();
            this.stopPolling();
            if (this.selectedDeploymentId) await this.refreshDeploymentInfo(this.selectedDeploymentId);
          },
          onError: () => {
            this.wsHint = "Realtime stream disconnected, fallback polling enabled.";
            this.startPolling();
          },
          onOpen: () => {
            this.wsHint = "";
          },
          onReconnect: () => {
            this.wsHint = "Realtime reconnecting...";
          },
        },
        { fromSeq: this.lastSeq }
      );
    },
    stopStream() {
      if (this.streamHandle && typeof this.streamHandle.close === "function") {
        this.streamHandle.close();
      }
      this.streamHandle = null;
    },
    startPolling() {
      if (!this.runId || this.pollTimer) return;
      this.pollTimer = setInterval(async () => {
        try {
          const run = await fetchDeploymentRun(this.runId);
          this.applyRun(run || {});
          const rows = await fetchDeploymentRunLogs(this.runId, { fromSeq: this.lastSeq, limit: 500 });
          rows.forEach((r) => this.appendLog(r));
          if (TERMINAL.has(String(this.runStatus || "").toLowerCase())) this.stopPolling();
        } catch (_) {
          0;
        }
      }, 10000);
    },
    stopPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    },
    resetRunState() {
      this.runId = "";
      this.runStatus = "";
      this.phase = "";
      this.progress = 0;
      this.currentStep = "";
      this.logs = [];
      this.lastSeq = 0;
      this.wsHint = "";
      this.errorMessage = "";
      this.issuedApiKey = "";
      this.apiKeyHint = "";
      this.deploymentInfo = null;
      this.steps = [
        { key: "validate_artifacts", name: "校验产物", status: "pending" },
        { key: "materialize_runtime", name: "准备环境", status: "pending" },
        { key: "smoke_test", name: "冒烟测试", status: "pending" },
        { key: "activate", name: "激活生效", status: "pending" },
      ];
    },
    async refreshDeploymentInfo(depId) {
      try {
        this.deploymentInfo = await fetchDeployment(depId);
      } catch (_) {
        this.deploymentInfo = null;
      }
    },
    async copyIssuedKey() {
      if (!this.issuedApiKey) return;
      try {
        await navigator.clipboard.writeText(this.issuedApiKey);
        this.$message.success("API key copied");
      } catch (_) {
        this.$message.warning("Copy failed, please copy manually.");
      }
    },
  },
};
</script>

<style scoped>
.deploy-service-tool { display: flex; flex-direction: column; gap: 12px; }
.tool-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.tool-head h3 { margin: 0; font-size: 18px; }
.tool-head p { margin: 4px 0 0; color: #6b7280; font-size: 13px; }
.head-actions { display: flex; gap: 8px; }
.card-block { border: 1px solid #edf0f4; }
.card-title { font-weight: 600; margin-bottom: 10px; font-size: 14px; color: #111827; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
.trigger-row { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.trigger-form { max-width: 520px; }
.step-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.step-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; }
.step-item.st-running { border-color: #f59e0b; background: #fffbeb; }
.step-item.st-completed { border-color: #10b981; background: #ecfdf5; }
.step-item.st-failed { border-color: #ef4444; background: #fef2f2; }
.step-item.st-cancelled { border-color: #9ca3af; background: #f9fafb; }
.step-name { font-weight: 500; }
.step-status { font-size: 12px; color: #4b5563; text-transform: uppercase; }
.progress-meta { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; flex-wrap: wrap; color: #4b5563; }
.warn-line { margin-top: 8px; color: #d97706; font-size: 12px; }
.error-line { margin-top: 8px; color: #dc2626; font-size: 12px; }
.log-box { max-height: 260px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #0f172a; }
.log-row { color: #e5e7eb; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.6; }
.log-seq { color: #93c5fd; margin-right: 6px; }
.log-lvl { color: #86efac; margin-right: 6px; }
.log-msg { color: #e5e7eb; }
.empty-tip { color: #94a3b8; font-size: 12px; }
.action-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.key-box { border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
.key-title { font-weight: 600; margin-bottom: 6px; font-size: 13px; }
.key-hint { margin-top: 6px; font-size: 12px; color: #92400e; }
.endpoint-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; font-size: 12px; color: #374151; display: grid; gap: 6px; }
@media (max-width: 1100px) {
  .form-grid { grid-template-columns: 1fr; }
  .step-list { grid-template-columns: 1fr; }
}
</style>
