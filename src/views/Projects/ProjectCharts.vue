<template>
  <div class="project-charts">
    <header class="pc-hero">
      <div class="pc-hero-left">
        <button class="back-link" type="button" @click="goBackToProjectDetail">
          返回项目详情
        </button>
        <div class="pc-eyebrow">训练任务</div>
        <h1 class="pc-title">{{ modelTitle }}</h1>
        <p class="pc-subtitle">{{ updateTimeText }}</p>
      </div>
      <div class="pc-hero-right">
        <div class="pc-stat">
          <div class="pc-stat-label">模型架构</div>
          <div class="pc-stat-value">{{ modelArchitecture }}</div>
        </div>
        <div class="pc-stat">
          <div class="pc-stat-label">状态</div>
          <div class="pc-stat-value">{{ runStatusLabel }}</div>
        </div>
        <div class="pc-stat">
          <div class="pc-stat-label">轮次</div>
          <div class="pc-stat-value">{{ epochs || '-' }}</div>
        </div>
      </div>
    </header>

    <section v-if="loading" class="loading-info">
      <i class="el-icon-loading"></i>
      <span>正在加载任务详情...</span>
    </section>
    <section v-else class="pc-meta-panel">
      <div v-for="chip in paramChips" :key="chip.label" class="pc-chip">
        <span>{{ chip.label }}</span>
        <strong>{{ chip.value }}</strong>
      </div>
    </section>

    <nav class="pc-tabs">
      <button
        class="pc-tab"
        :class="{ active: activeTab === 'train' }"
        @click="setActiveTab('train'), goTrainPart()"
      >训练监控</button>
      <button
        class="pc-tab"
        :class="{ active: activeTab === 'config' }"
        @click="setActiveTab('config'), goConfiguration()"
      >参数配置</button>
      <button
        class="pc-tab"
        :class="{ active: activeTab === 'logs' }"
        @click="setActiveTab('logs'), goLogsPart()"
      >日志</button>
      <button
        class="pc-tab"
        :class="{ active: activeTab === 'preview' }"
        @click="setActiveTab('preview'), goPreviewPart()"
      >简单推理</button>
    </nav>

    <section class="pc-content">
      <keep-alive>
        <router-view></router-view>
      </keep-alive>
    </section>
  </div>
</template>

<script>
import { fetchTrainingJobs, FetchTrainingJobParameters } from "@/api/training";
import { API_BASE, WS_BASE } from "@/utils/request";

export default {
  name: "ProjectsCharts",
  data() {
    return {
      activeTab: "train",
      jobId: null,
      loading: false,
      trainJobInfo: null,
      trainJobParameters: null
    };
  },
  provide() {
    return {
      $API_BASE: () => API_BASE,
      $WS_BASE: () => WS_BASE
    };
  },
  computed: {
    modelTitle() {
      if (this.trainJobInfo) {
        const architecture = this.trainJobInfo.architecture?.model_variant || "未知架构";
        const jobName = this.trainJobInfo.job_name || this.trainJobInfo.name || "";
        return `${architecture} · ${jobName || "训练任务"}`;
      }
      return "训练任务";
    },
    modelArchitecture() {
      return this.trainJobInfo?.architecture?.model_variant || "未知";
    },
    runStatusLabel() {
      const s = String(this.trainJobInfo?.status || "").toLowerCase();
      if (!s) return "等待中";
      if (s === "created") return "已创建";
      if (s === "queued") return "排队中";
      if (s === "running") return "运行中";
      if (s === "completed") return "已完成";
      if (s === "failed") return "失败";
      if (s === "cancelled") return "已取消";
      return s;
    },
    updateTimeText() {
      if (this.trainJobInfo?.created_at) {
        const createTime = new Date(this.trainJobInfo.created_at);
        const now = new Date();
        const diffTime = Math.abs(now - createTime);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          return "创建于 1 天前";
        } else if (diffDays < 30) {
          return `创建于 ${diffDays} 天前`;
        } else if (diffDays < 365) {
          const months = Math.floor(diffDays / 30);
          return `创建于 ${months} 个月前`;
        } else {
          const years = Math.floor(diffDays / 365);
          return `创建于 ${years} 年前`;
        }
      }
      return "创建时间未知";
    },
    epochs() {
      return this.trainJobParameters?.epochs || this.trainJobInfo?.parameters?.epochs;
    },
    imageSize() {
      return (
        this.trainJobParameters?.img_size ||
        this.trainJobParameters?.imgsz ||
        this.trainJobInfo?.parameters?.img_size ||
        this.trainJobInfo?.parameters?.image_size
      );
    },
    patience() {
      return this.trainJobParameters?.patience || this.trainJobInfo?.parameters?.patience;
    },
    cache() {
      const cacheValue = this.trainJobParameters?.cache || this.trainJobInfo?.parameters?.cache;
      return cacheValue ? String(cacheValue).charAt(0).toUpperCase() + String(cacheValue).slice(1) : "RAM";
    },
    device() {
      const deviceValue = this.trainJobParameters?.device || this.trainJobInfo?.parameters?.device;
      if (deviceValue === 0 || deviceValue === "0") {
        return "GPU";
      } else if (deviceValue === "cpu") {
        return "CPU";
      }
      return deviceValue || "自动选择";
    },
    batchSize() {
      return (
        this.trainJobParameters?.batch_size ||
        this.trainJobParameters?.batch ||
        this.trainJobInfo?.parameters?.batch_size
      );
    },
    usePretrained() {
      return this.trainJobParameters?.use_pretrained || this.trainJobInfo?.parameters?.use_pretrained || false;
    },
    paramChips() {
      return [
        { label: "预训练", value: this.usePretrained ? "是" : "否" },
        { label: "轮次", value: this.epochs || "-" },
        { label: "图像尺寸", value: this.imageSize || "-" },
        { label: "早停轮数", value: this.patience || "-" },
        { label: "缓存", value: this.cache || "-" },
        { label: "设备", value: this.device || "-" },
        { label: "批次大小", value: this.batchSize || "-" }
      ];
    }
  },
  created() {
    this.getJobId();

    if (this.$route.path.includes("/projectscharts/trainpart")) {
      this.activeTab = "train";
    } else if (this.$route.path.includes("/projectscharts/logs")) {
      this.activeTab = "logs";
    } else if (this.$route.path.includes("/projectscharts/configuration")) {
      this.activeTab = "config";
    } else if (this.$route.path.includes("/projectscharts/chartspart")) {
      this.activeTab = "charts";
    } else if (this.$route.path.includes("/projectscharts/previewpart")) {
      this.activeTab = "preview";
    }
  },
  watch: {
    "$route.query.jobId": {
      handler(newJobId) {
        if (newJobId && newJobId !== this.jobId) {
          this.jobId = newJobId;
          localStorage.setItem("currentJobId", newJobId);
          this.loadJobDetails(newJobId);
        }
      },
      immediate: true
    }
  },
  methods: {
    setActiveTab(tab) {
      this.activeTab = tab;
    },
    goBackToProjectDetail() {
      const pid = this.$route.query.projectId || (this.trainJobInfo && (this.trainJobInfo.project_id || this.trainJobInfo.project?.project_id));
      if (pid) this.$router.push({ path: "/projectsdetail", query: { projectId: pid } });
      else this.$router.push({ path: "/projects" });
    },
    getJobId() {
      const routeJobId = this.$route.query.jobId;
      if (routeJobId) {
        this.jobId = routeJobId;
        localStorage.setItem("currentJobId", routeJobId);
        this.loadJobDetails(routeJobId);
      } else {
        const storedJobId = localStorage.getItem("currentJobId");
        if (storedJobId) {
          this.jobId = storedJobId;
          this.loadJobDetails(storedJobId);
        }
      }
    },
    async loadJobDetails(jobId) {
      if (!jobId) return;

      this.loading = true;
      try {
        const [jobsResponse, parametersResponse] = await Promise.allSettled([
          fetchTrainingJobs(),
          FetchTrainingJobParameters(jobId)
        ]);

        if (jobsResponse.status === "fulfilled" && jobsResponse.value) {
          const currentJob = jobsResponse.value.find(job => job.job_id === jobId);
          if (currentJob) {
            this.trainJobInfo = currentJob;
          }
        }

        if (parametersResponse.status === "fulfilled" && parametersResponse.value) {
          this.trainJobParameters = parametersResponse.value;
        }
      } catch (error) {
        console.error("Failed to fetch training job detail:", error);
      } finally {
        this.loading = false;
      }
    },
    goTrainPart() {
      if (this.$route.path !== "/projectscharts/trainpart") {
        this.$router.push({
          path: "/projectscharts/trainpart",
          query: { jobId: this.jobId }
        });
      }
    },
    goConfiguration() {
      if (this.$route.path !== "/projectscharts/configuration") {
        this.$router.push({
          path: "/projectscharts/configuration",
          query: { jobId: this.jobId }
        });
      }
    },
    goLogsPart() {
      if (this.$route.path !== "/projectscharts/logs") {
        this.$router.push({
          path: "/projectscharts/logs",
          query: { jobId: this.jobId }
        });
      }
    },
    goChartsPart() {
      if (this.$route.path !== "/projectscharts/chartspart") {
        this.$router.push({
          path: "/projectscharts/chartspart",
          query: { jobId: this.jobId }
        });
      }
    },
    goPreviewPart() {
      if (this.$route.path !== "/projectscharts/previewpart") {
        this.$router.push({
          path: "/projectscharts/previewpart",
          query: { jobId: this.jobId }
        });
      }
    }
  }
};
</script>

<style scoped>
.project-charts {
  --ink-900: #111315;
  --ink-700: #3e4a5b;
  --ink-500: #6a7482;
  --line-200: #e4e7ee;
  --brand-700: #2b3a67;
  --brand-500: #4f63c7;
  --brand-300: #9bb0ff;
  --card-shadow: 0 18px 35px rgba(16, 18, 24, 0.12);
  padding: 24px;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f9fafb;
  font-family: "Space Grotesk", "Sora", "Manrope", "Segoe UI", sans-serif;
  color: var(--ink-900);
  box-sizing: border-box;
}

.pc-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  padding: 20px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  color: var(--text-main);
  box-shadow: none;
  flex-shrink: 0;
}

.pc-hero-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.back-link {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-link:hover {
  background: #f3f4f6;
  color: var(--text-main);
}

.pc-eyebrow {
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.7;
  color: var(--text-secondary);
}

.pc-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-main);
}

.pc-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.pc-hero-right {
  display: flex;
  flex-direction: row;
  gap: 12px;
  flex-shrink: 0;
}

.pc-stat {
  padding: 10px 14px;
  border-radius: 14px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.pc-stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.pc-stat-value {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 700;
}

.loading-info {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 18px 0 10px;
  color: var(--ink-500);
  font-size: 13px;
}

.loading-info i {
  animation: spin 1s linear infinite;
}

.pc-meta-panel {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  flex-shrink: 0;
}

.pc-chip {
  padding: 10px 14px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--line-200);
  box-shadow: 0 10px 24px rgba(16, 18, 24, 0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pc-chip span {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ink-500);
}

.pc-chip strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-900);
}

.pc-tabs {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex-shrink: 0;
}

.pc-tab {
  border: none;
  padding: 8px 18px;
  border-radius: 999px;
  background: #fff;
  color: var(--ink-700);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--line-200);
  transition: all 0.2s ease;
}

.pc-tab.active {
  background: #f3f4f6;
  border-color: #e5e7eb;
  color: var(--text-main);
  font-weight: 700;
}

.pc-tab:hover {
  transform: translateY(-1px);
}

.pc-content {
  margin-top: 16px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 960px) {
  .pc-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .pc-hero-right {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .project-charts {
    padding: 16px;
  }

  .pc-hero {
    padding: 18px;
  }
}
</style>
