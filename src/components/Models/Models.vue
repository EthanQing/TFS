<template>
  <div class="projects" v-if="false">
    <!-- top 部分 -->
    <div class="top">
      <h3>任务列表</h3>
  <!-- 按钮已迁移到 ProjectsDetail 组件 -->
    </div>

    <!-- secondFloor 部分 -->
    <div class="secondFloor">
      <el-input
        v-model="searchQuery"
        placeholder="请输入模型名称搜索"
        class="input"
      ></el-input>
      <div class="topNavigation">
        <el-menu
          :default-active="activeIndex"
          class="el-menu-demo"
          mode="horizontal"
          @select="handleSelect"
        >
          <el-menu-item index="1" class="nav-item">全部</el-menu-item>
        </el-menu>
      </div>
    </div>
    <!-- clickShow部分 -->
    <!-- <div class="clickShow" v-show="isShow">
        <span>分类方式</span>
        <div class="buttons">
            <button :class="{ active: activeButton === 'model' }" @click="setActiveButton('model')">
                mAP
            </button>
            <button :class="{ active: activeButton === 'size' }" @click="setActiveButton('size')">
                大小
            </button>
            <button :class="{ active: activeButton === 'date' }" @click="setActiveButton('date')">
                日期
            </button>
        </div>
    </div> -->

    <!-- showList 部分 -->
    <div class="showList">
      <ul>
        <li
          v-for="job in filteredJobs"
          :key="job.job_id"
          @click="ShowModelDetail(job.job_id)"
        >
          <div class="circle" :class="statusClass(job.status)"></div>
          <div class="messagePart">
            <span class="title1">{{ job.job_name }}</span>
            <span class="title2">{{
              job.architecture?.model_variant || "-"
            }}</span>
            <!-- 添加项目信息显示 -->
            <span class="project-info"
              >项目名称: {{ job.project.project_name }}</span
            >
          </div>
          <div class="detailPart">
            <!-- 按钮移到状态左侧 -->
            <span class="detail3" v-if="job.status === 'pending'">
              <el-button
                type="success"
                size="mini"
                @click.stop="startJob(job.job_id)"
                :loading="startingJobs[job.job_id]"
                class="start-button"
                >开始训练</el-button
              >
            </span>
            <span class="detail1">{{ job.status }}</span>
            <span class="detail2"
              >{{ job.current_epoch }}/{{ job.parameters?.epochs || "-" }}</span
            >
            <!-- 新增模型大小显示 -->
            <span class="detail-size"
              >大小: {{ formatModelSize(job.model_size_mb) }}</span
            >
            <span class="more-options" @click.stop>
              <el-dropdown
                trigger="click"
                @command="handleCommand($event, job.job_id)"
              >
                <span class="el-dropdown-link">
                  <i class="el-icon-more"></i>
                </span>
                <el-dropdown-menu slot="dropdown">
                  <el-dropdown-item command="view">查看详情</el-dropdown-item>
                  <el-dropdown-item command="export" divided
                    >导出模型</el-dropdown-item
                  >
                  <el-dropdown-item command="delete" divided
                    >删除</el-dropdown-item
                  >
                </el-dropdown-menu>
              </el-dropdown>
            </span>
          </div>
        </li>
      </ul>
    </div>

    <!-- dialog部分 -->
    <el-dialog
      title=""
      :visible.sync="dialogVisible"
      width="58%"
      :style="{ minWidth: '900px' }"
      class="EldialogWrapper"
    >
      <div class="Eldialog">
        <component
          :is="currentDialogComponent"
          :project="selectedProjectFromContext"
          @use-project="handleUseProject"
          @task-added="onTaskAdded"
          @close="dialogVisible = false"
        />
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button
          class="custom-primary-btn"
          v-show="dialogVisible && $route.path !== '/models/modelsstep1'"
          @click="goLastStep"
          >上一步</el-button
        >
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { fetchTrainingJobs, startTrainingJob, DeleteTrainingJob } from "@/api";
import ModelsStep2 from "@/components/ModelsStep2/ModelsStep2.vue";
export default {
  name: "Models",
  data() {
    return {
      searchQuery: "", // 搜索关键词
      activeIndex: "1",
      isShow: true,
      activeButton: "model", // 默认选中"模型"按钮
      dialogVisible: false,
      stepsActive: 1,
      selectedProject: null, // 添加选中的项目数据
      trainingJobs: [],
      startingJobs: {},
      currentDialogComponent: null,
    };
  },
  computed: {
    // 根据搜索关键词筛选模型
    filteredJobs() {
      // 如果没有搜索关键词，返回所有模型
      if (!this.searchQuery) {
        return this.trainingJobs;
      }

      // 转换为小写以实现不区分大小写的搜索
      const query = this.searchQuery.toLowerCase();

      // 只根据模型名称(job_name)进行筛选
      return this.trainingJobs.filter((job) =>
        job.job_name.toLowerCase().includes(query)
      );
    },
    selectedProjectFromContext() {
      // 从路由或 localStorage 获取当前项目
      const pid = this.$route.query && this.$route.query.projectId
      if (pid) {
        try {
          const stored = localStorage.getItem('currentProject')
          if (stored) {
            const p = JSON.parse(stored)
            if (p && (p.project_id === pid || p.project_id === Number(pid))) return p
          }
        } catch (e) {}
      }
      return this.selectedProject
    },
  },
  methods: {
    statusClass(status){
      if(!status) return 'status-pending';
      const s = status.toLowerCase();
      if(s==='completed' || s==='copleted') return 'status-completed';
      if(s==='pending') return 'status-pending';
      if(s==='fail' || s==='failed' || s==='error') return 'status-fail';
      if(s==='running' || s==='training') return 'status-running';
      return 'status-pending';
    },
    // 处理导航菜单选择事件
    handleSelect(key, keyPath) {
      this.activeIndex = key;
    },
    // 控制searchShow显示/隐藏的事件
    changeShow() {
      this.isShow = !this.isShow;
    },
    // 设置激活的按钮
    setActiveButton(button) {
      this.activeButton = button;
    },
    ShowModelDetail(jobId) {
      if (this.$route.path !== "/projectscharts/trainpart") {
        this.$router.push({
          path: "/projectscharts/trainpart",
          query: {
            jobId: jobId,
          },
        });
      }
      // 将jobId保存在localStorage，以便在组件间切换时保持状态
      localStorage.setItem("currentJobId", jobId);
    },
    // 处理下拉菜单命令
    handleCommand(command, jobId) {
      switch (command) {
        case "view":
          this.ShowModelDetail(jobId);
          break;
        case "export":
          this.exportModel(jobId);
          break;
        case "delete":
          this.deleteModel(jobId);
          break;
        default:
          break;
      }
    },
    // 导出模型
    exportModel(jobId) {
      this.$message({
        message: "模型导出功能正在开发中",
        type: "info",
      });
    },
    // 删除模型
    async deleteModel(jobId) {
      this.$confirm("确定要删除该模型吗?", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      })
        .then(async () => {
          try {
            await DeleteTrainingJob(jobId);
            this.$message({
              type: "success",
              message: "删除成功!",
            });
            this.loadTrainingJobs(); // 重新加载数据
          } catch (error) {
            this.$message({
              type: "error",
              message: "删除失败: " + error.message,
            });
          }
        })
        .catch(() => {
          this.$message({
            type: "info",
            message: "已取消删除",
          });
        });
    },
    // 创建任务入口由 ProjectsDetail 触发（通过路由参数或 localStorage 标记）
    goStep1() {
      this.dialogVisible = true;
      this.currentDialogComponent = ModelsStep2
      this.stepsActive = 1;
    },
    onTaskAdded() {
      this.loadTrainingJobs()
    },
    goNextStep() {},
    goLastStep() {},
    // 处理项目选择事件
    handleUseProject(project) {
      this.selectedProject = project;
      this.$nextTick(() => {
        setTimeout(() => {
          this.EventBus.$emit("projectSelected", project);
        }, 200);
      });
    },
    async loadTrainingJobs() {
      try {
        this.trainingJobs = await fetchTrainingJobs();
      } catch (error) {
        this.$message.error("加载训练任务失败");
      }
    },
    async startJob(jobId) {
      this.$set(this.startingJobs, jobId, true);
      try {
        await startTrainingJob(jobId);
        this.$message.success("训练已开始");
        this.loadTrainingJobs();
      } catch (error) {
        this.$message.error("启动训练失败");
      } finally {
        this.$set(this.startingJobs, jobId, false);
      }
    },
    // 格式化模型大小显示
    formatModelSize(sizeMb) {
      if (sizeMb === undefined || sizeMb === null) return "-";
      return sizeMb.toFixed(1) + "MB";
    },
  },
  mounted() {
    this.loadTrainingJobs();
    this.EventBus.$on("taskAdded", this.loadTrainingJobs);
    this.EventBus.$on("closeDialog", () => {
      this.dialogVisible = false;
    });
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
  components: {},
};
</script>

<style scoped>
.projects {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  box-sizing: border-box;
  width: 100%;
  padding-right: 30px;
}

@media (max-width: 1200px) {
  .projects {
    margin-left: 5px;
    padding-right: 10px;
  }
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

.top button {
  width: 112px;
  height: 40px;
  border-radius: 20px;
  background-color: #111f68;
  color: #fff;
  line-height: 40px;
  font-weight: 450;
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 14px;
}

/* secondFloor 部分样式 */
.secondFloor {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.input {
  /* margin-left: 10px; */
  width: 300px;
  max-width: 100%;
  min-width: 200px;
}

@media (max-width: 768px) {
  .secondFloor {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .input {
    margin: 0;
    width: 100%;
    min-width: auto;
  }
}

.circle {
  display: flex;
  align-items: center;
  margin-right: 20px;
  height: 100%;
  width: 10px;
  transition: background-color .25s;
}

/* 状态颜色 */
.status-completed { background-color: #087922 !important; }
.status-pending { background-color: #c9c9c9 !important; }
.status-fail { background-color: #ff4d4f !important; }
.status-running { background-color: #111f68 !important; }

/* 导航菜单样式 */
.el-menu-demo {
  display: flex;
  border-bottom: none !important;
}

.el-menu-demo .nav-item {
  margin: 0 10px !important;
  min-width: 80px !important;
  text-align: center !important;
}

.el-menu-demo .el-menu-item.is-active {
  color: #111f68 !important;
  border-bottom: 2px solid #111f68 !important;
}

.showList {
  width: 100%;
  background-color: #fff;
  margin-left: -10px;
}

.showList ul {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  background-color: #FBFCFD;
}

.showList ul li {
  width: 100%;
  height: 90px;
  background-color: #fff;
  margin: 10px;
  box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  position: relative;
  align-items: center;
  padding-right: 120px; /* 为右侧按钮留出空间 */
}

.showList ul li:hover {
  box-shadow: 0 0 12px 3px rgba(0, 0, 0, 0.1);
}

.clickShow span {
  color: #111f68;
  font-weight: 500;
  font-size: 15px;
}

.buttons {
  margin: 20px 0;
}

.buttons button {
  width: 70px;
  height: 34px;
  background-color: #f3f3f3;
  border-radius: 15px;
  color: #111f68;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
}

.buttons button:nth-child(2) {
  margin: 0 10px;
}

/* 激活状态的按钮样式 */
.buttons button.active {
  background-color: #111f68;
  color: #fff;
}

.showList img {
  width: 24px;
  height: 24px;
}

.Last {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f5f2f2;
  margin: 25px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.messagePart {
  display: flex;
  flex-direction: column;
  margin: 18px 0 0 10px;
  color: #111f68;
  flex: 1;
  min-width: 0; /* 允许内容收缩 */
  max-width: calc(100% - 120px); /* 限制最大宽度，为右侧按钮留空间 */
}

.title1 {
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title2 {
  font-size: 13px;
  margin-top: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 新增项目ID样式 */
.project-info {
  font-size: 12px;
  margin-top: 5px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detailPart {
  display: flex;
  align-items: center;
  color: #111f68;
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  gap: 10px;
  flex-wrap: nowrap;
}

.detailPart .detail1 {
  font-weight: bolder;
  white-space: nowrap;
}

.detailPart .detail2 {
  margin: 0 15px;
  white-space: nowrap;
}

/* 新增模型大小显示样式 */
.detail-size {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 更多选项按钮样式 */
.more-options {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.more-options .el-dropdown-link {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.more-options .el-dropdown-link:hover {
  background-color: #f5f7fa;
}

.more-options i {
  font-size: 18px;
  color: #606266;
}

@media (max-width: 1024px) {
  .showList ul li {
    padding-right: 60px; /* 在中等屏幕上减少右侧空间 */
  }

  .detailPart {
    right: 10px;
    gap: 5px;
  }

  .detailPart .detail2 {
    margin: 0 8px;
  }
}

@media (max-width: 768px) {
  .showList ul li {
    padding-right: 40px; /* 在小屏幕上进一步减少右侧空间 */
    height: auto;
    min-height: 90px;
    padding-top: 15px;
    padding-bottom: 15px;
  }

  .messagePart {
    margin: 0 10px;
    max-width: calc(100% - 50px);
  }

  .detailPart {
    right: 5px;
    flex-direction: column;
    gap: 5px;
    align-items: flex-end;
  }

  .detailPart .detail2 {
    margin: 0;
  }
}

.leftPart {
  display: flex;
  flex-direction: column;
  color: #111f68;
  margin-left: 40px;
  width: 350px;
  height: 700px;
  margin-top: -30px;
  border-right: 1px solid rgba(0, 0, 0, 0.15);
}

.leftPart span:nth-child(1) {
  font-size: 20px;
  margin-bottom: 40px;
}

.leftPart span:nth-child(2) {
  margin-bottom: 80px;
}

/* 对话框样式 */
.el-dialog__wrapper {
  position: fixed !important;
  top: -10% !important;
  /* 按视口比例定位，适配不同屏幕 */
}

/* 确保对话框内容自适应 */
.EldialogWrapper .el-dialog {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  max-height: 90vh;
}

.EldialogWrapper .el-dialog__body {
  overflow: auto;
  padding: 15px 20px;
}

.Eldialog {
  display: flex;
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.dialog-footer {
  position: absolute;
  right: 50px;
  bottom: 30px;
}

/* 自定义按钮样式 */
.custom-primary-btn {
  background-color: #111f68 !important;
  border-color: #111f68 !important;
  color: #fff !important;
}

/* 按钮悬停状态 */
.custom-primary-btn:hover,
.custom-primary-btn:focus {
  background-color: #182a8f !important;
  border-color: #182a8f !important;
}

/* 按钮点击状态 */
.custom-primary-btn:active {
  background-color: #0c164a !important;
  border-color: #0c164a !important;
}
.start-button{
    margin-right: 15px;
}
</style>
