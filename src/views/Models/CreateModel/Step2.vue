<template>
  <div class="models-step2">
    <header class="step-hero">
      <div class="hero-text">
        <div class="hero-eyebrow">训练参数配置</div>
        <h2 class="hero-title">配置您的运行环境</h2>
        <p class="hero-sub">
          选择模型架构并调整此项目的训练参数。
        </p>
      </div>
      <div class="hero-cards">
        <div class="hero-card">
          <div class="hero-label">项目</div>
          <div class="hero-value">{{ projectName }}</div>
        </div>
        <div class="hero-card">
          <div class="hero-label">数据集</div>
          <div class="hero-value">{{ datasetName }}</div>
        </div>
        <div class="hero-card">
          <div class="hero-label">模型</div>
          <div class="hero-value">{{ modelName }}</div>
        </div>
      </div>
    </header>

    <section class="step-body">
      <div class="step-toolbar">
        <div class="tab-switcher">
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: currentTab === 'detection' }"
            @click="currentTab = 'detection'"
          >
            目标检测
          </button>
          <!-- <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: currentTab === 'segmentation' }"
            @click="currentTab = 'segmentation'"
          >
            图像分割
          </button> -->
        </div>
        <div class="tab-note" v-if="currentTab === 'detection'"></div>
        <div class="tab-note" v-else>Ultralytics 分割架构</div>
      </div>

      <div class="step-panel">
        <Official
          :task-type="currentTab"
          @model-selected="handleModelSelected"
          @config-changed="handleConfigChanged"
          :selected-project="selectedProject"
        />
      </div>
    </section>

    <footer class="step-footer">
      <div class="footer-note" :class="{ ready: canSubmit }">
        {{ footerMessage }}
      </div>
      <el-button
        type="primary"
        size="large"
        @click="addTrainingTask"
        :loading="isAdding"
        :disabled="!canSubmit"
        class="primary-btn"
      >
        {{ isAdding ? '添加中...' : '添加训练任务' }}
      </el-button>
    </footer>
  </div>
</template>

<script>
import { createTrainingJob } from "@/api/training";
import Official from "@/views/Models/Official.vue";

export default {
  name: "ModelsStep2",
  components: { Official },
  props: {
    project: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      currentTab: 'detection',
      selectedProject: null,
      selectedModel: null,
      isAdding: false,
      trainParams: {
        project_id: null,
        project_name: "",
        dataset_name: "",
        model_architecture: "",
        architecture_id: null,
        epochs: 100,
        batch_size: 16,
        learning_rate: 0.01,
        img_size: 640,
        optimizer: "auto",
        device: "cpu",
        workers: 8,
        patience: 50,
        use_pretrained: true,
        pretrained_model_path: "",
        resume_training: false,
        resume_job_id: "",
        resume_from_epoch: 0,
        momentum: 0.937,
        weight_decay: 0.0005,
        warmup_epochs: 3,
        warmup_momentum: 0.8,
        warmup_bias_lr: 0.1
      }
    };
  },
  computed: {
    projectName() {
      return this.selectedProject?.project_name || "No project selected";
    },
    datasetName() {
      const fromProject = this.selectedProject?.dataset?.dataset_name;
      const fromParams = this.trainParams.dataset_name;
      return fromProject || fromParams || "No dataset linked";
    },
    modelName() {
      return this.selectedModel ? this.formatModelLabel(this.selectedModel) : "Select a model";
    },
    canSubmit() {
      return !!(this.selectedProject && this.selectedModel && this.trainParams.dataset_name);
    },
    footerMessage() {
      if (!this.selectedProject) return "选择一个项目以继续。";
      if (!this.selectedModel) return "选择一个模型架构以启用训练。";
      if (!this.trainParams.dataset_name) return "该项目未关联数据集。";
      return "准备添加训练任务。";
    }
  },
  methods: {
    formatModelLabel(value) {
      const v = String(value || "").trim();
      if (!v) return "";
      return v.replace(/^yolo/i, "YOLO");
    },
    handleModelSelected(modelData) {
      this.selectedModel = modelData.model;
      this.trainParams.model_architecture = modelData.model;
      this.trainParams.architecture_id = modelData.architecture_id || null;
      console.log("Training modal - selected model:", modelData);
    },
    handleConfigChanged(configData) {
      this.trainParams = { ...this.trainParams, ...configData };
      if (this.selectedProject?.dataset?.dataset_name && !this.trainParams.dataset_name) {
        this.trainParams.dataset_name = this.selectedProject.dataset.dataset_name;
      }
      console.log("Training modal - config updated:", configData);
    },
    async addTrainingTask() {
      if (!this.selectedProject) {
        this.$message.error("Please select a project first.");
        return;
      }
      if (!this.selectedModel) {
        this.$message.error("Please choose a model architecture.");
        return;
      }
      if (!this.trainParams.dataset_name) {
        this.$message.error("This project has no dataset linked. Please attach one first.");
        return;
      }
      this.isAdding = true;
      try {
        const trainingData = {
          ...this.trainParams,
          project_id: this.selectedProject.project_id,
          project_name: this.selectedProject.project_name,
          model_architecture: this.selectedModel
        };
        console.log("Submitting training job:", trainingData);
        const result = await createTrainingJob(trainingData);
        this.$message.success("Training job added successfully (status pending).");
        this.EventBus && this.EventBus.$emit("taskAdded", result);
        this.$emit("task-added", result);
        this.$emit("close");
      } catch (error) {
        console.error("Failed to add training job:", error);
        this.$message.error("Failed to add training job: " + (error.message || "Unknown error"));
      } finally {
        this.isAdding = false;
      }
    },
    updateProjectInfo(project) {
      if (!project) return;
      this.selectedProject = project;
      this.trainParams.project_id = project.project_id;
      this.trainParams.project_name = project.project_name || "";
      this.trainParams.dataset_name = project?.dataset?.dataset_name || "";

      console.log("Training modal - project selected:", project);
    }
  },
  mounted() {
    this._projectSelectedHandler = (project) => {
      this.updateProjectInfo(project);
    };
    this.EventBus && this.EventBus.$on("projectSelected", this._projectSelectedHandler);
    if (this.project) {
      this.updateProjectInfo(this.project);
    } else {
      const projectId = this.$route && this.$route.query && this.$route.query.projectId;
      if (projectId) {
        try {
          const stored = localStorage.getItem("currentProject");
          if (stored) {
            const p = JSON.parse(stored);
            if (p && (p.project_id === projectId || p.project_id === Number(projectId))) {
              this.updateProjectInfo(p);
            }
          }
        } catch (e) {}
      }
    }
  },
  watch: {
    project: {
      handler(p) {
        if (p) this.updateProjectInfo(p);
      },
      immediate: true
    }
  },
  beforeDestroy() {
    if (this.EventBus && this._projectSelectedHandler) {
      this.EventBus.$off("projectSelected", this._projectSelectedHandler);
    }
  }
};
</script>

<style scoped>
.models-step2 {
  --ink-900: #111315;
  --ink-700: #3e4a5b;
  --ink-500: #6a7482;
  --line-200: #e4e7ee;
  --brand-700: #2b3a67;
  --brand-500: #4f63c7;
  --brand-300: #9bb0ff;
  --card-shadow: 0 18px 35px rgba(16, 18, 24, 0.12);
  font-family: "Space Grotesk", "Sora", "Manrope", "Segoe UI", sans-serif;
  color: var(--ink-900);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.step-hero {
  background: linear-gradient(120deg, #1b1f3b 0%, #2f3f7a 45%, #4f63c7 100%);
  color: #fff;
  border-radius: 20px;
  padding: 20px;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
  box-shadow: var(--card-shadow);
}

.hero-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-eyebrow {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  opacity: 0.7;
}

.hero-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}

.hero-sub {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.5;
}

.hero-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.hero-card {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  flex-direction: column;
  gap: 4px;
  backdrop-filter: blur(6px);
}

.hero-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  opacity: 0.7;
}

.hero-value {
  font-size: 14px;
  font-weight: 600;
  word-break: break-word;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tab-switcher {
  display: flex;
  background: #f2f4fb;
  padding: 4px;
  border-radius: 999px;
  gap: 4px;
}

.tab-btn {
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--ink-500);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--brand-700);
}

.tab-btn.active {
  background: #fff;
  color: var(--brand-700);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.tab-note {
  font-size: 12px;
  color: var(--ink-500);
}

.step-panel {
  background: #fff;
  border-radius: 18px;
  padding: 18px;
  border: 1px solid var(--line-200);
  box-shadow: var(--card-shadow);
}

.step-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.footer-note {
  font-size: 12px;
  color: var(--ink-500);
  padding: 6px 12px;
  border-radius: 999px;
  background: #f4f6fb;
}

.footer-note.ready {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.12);
}

.primary-btn {
  border-radius: 999px !important;
  background: #f9d86e !important;
  border-color: #f9d86e !important;
  color: #222 !important;
  font-weight: 600;
  padding: 10px 22px;
  box-shadow: 0 8px 18px rgba(249, 216, 110, 0.35);
}

.primary-btn:hover {
  background: #f6c949 !important;
  border-color: #f6c949 !important;
}

@media (max-width: 900px) {
  .step-hero {
    grid-template-columns: 1fr;
  }
  .hero-cards {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}

@media (max-width: 600px) {
  .models-step2 {
    padding: 16px;
  }
  .step-hero {
    padding: 16px;
  }
}
</style>
