<template>
  <div>
    <div class="sidebar">
      <ul>
        <li @click="goDataSets" :class="{ active: isDataActive }">
          <a href="javascript:void(0)">
            <img :src="getIconPath('data', isDataActive)" alt="数据">
            <span>数据</span>
          </a>
        </li>
        <li @click="goArchitecture" :class="{ active: isArchitectureActive }">
          <a href="javascript:void(0)">
            <img :src="getIconPath('architecture', isArchitectureActive)" alt="架构">
            <span>架构</span>
          </a>
        </li>

        <li @click="goProjects" :class="{ active: isProjectActive }">
          <a href="javascript:void(0)">
            <img :src="getIconPath('project', isProjectActive)" alt="项目">
            <span>项目</span>
          </a>
        </li>

        <li @click="goDeployment" :class="{ active: isDeploymentActive }">
          <a href="javascript:void(0)">
            <img :src="getIconPath('deployment', isDeploymentActive)" alt="部署">
            <span>部署</span>
          </a>
        </li>

        <!-- <li @click="goModels" :class="{ active: isModelActive }">
          <a href="javascript:void(0)">任务</a>
        </li> -->
        
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  name: "Navigation",
  computed: {
    isDataActive() {
      return (
        this.$route.path === "/datasets" ||
        this.$route.path.startsWith("/datadetail") ||
        this.$route.path.includes("/imagespart")
      );
    },
    isProjectActive() {
      return (
        this.$route.path === "/projects" ||
        this.$route.path.startsWith("/projectsdetail") ||
       this.$route.path.includes("/projectsdetail") ||
  this.$route.path.includes("/projectscharts") ||
  // 在创建任务第一步(modelsstep1)时仍视为项目上下文
  this.$route.path.includes("/models/modelsstep1")
      );
    },
    isArchitectureActive() {
      return this.$route.path === "/architecture";
    },
    isDeploymentActive() {
      return (
        this.$route.path === "/deployment" ||
        this.$route.path.startsWith("/deployment") ||
        this.$route.path.startsWith("/deploymentprocess")
      );
    },
    isModelActive() {
      return false;
    },
  },
  methods: {
    goDataSets() {
      if (this.$route.path !== "/datasets") {
        this.$router.push("/datasets");
      }
    },
    goProjects() {
      if (this.$route.path !== "/projects") {
        this.$router.push("/projects");
      }
    },
    goArchitecture() {
      if (this.$route.path !== "/architecture") {
        this.$router.push("/architecture");
      }
    },
    goDeployment() {
      if (this.$route.path !== "/deployment") {
        this.$router.push({ path: "/deployment" });
      }
    },
    goModels() {
      // 任务列表页已移除，此入口不做跳转
    },
    getIconPath(type, isActive) {
      const iconMap = {
        data: '图片',
        architecture: '模型', 
        project: '项目',
        // 暂无专用图标，复用“模型”图标
        deployment: '模型'
      };
      
      const iconName = iconMap[type];
      const suffix = isActive ? '' : '-蓝';
      
      return require(`@/assets/images/Navigation/${iconName}${suffix}.png`);
    },
  },
};
</script>

<style>
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 200px;
  background: var(--bg-sidebar);
  border-right: 1px solid #e5e7eb;
  z-index: 100;
  padding-top: 2rem;
  /* Reduced shadow for cleaner look */
  box-shadow: 1px 0 10px rgba(0, 0, 0, 0.02);
}

.sidebar ul {
  list-style: none;
  padding: 0 1rem;
}

.sidebar ul li {
  width: 100%;
  margin-bottom: 0.5rem;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  border: none;
}

.sidebar ul li:hover {
  background-color: #f3f4f6;
  transform: translateX(4px);
}

/* 激活状态样式 */
.sidebar ul li.active {
  background: #f3f4f6;
  /* Use a border or darkened background for active state instead of color */
  border: 1px solid #e5e7eb;
  box-shadow: none;
}

.sidebar ul li a {
  display: flex;
  align-items: center;
  padding: 1rem;
  text-decoration: none;
  color: var(--text-secondary);
  font-weight: 500;
  transition: color 0.2s;
}

.sidebar ul li.active a {
  color: var(--text-main);
  font-weight: 600;
}

/* 图片样式 */
.sidebar ul li a img {
  width: 20px;
  height: 20px;
  margin-right: 12px;
  flex-shrink: 0;
  /* Remove invert filter so icons are dark (assuming source is dark/black) */
  filter: none; 
  opacity: 0.6;
}

.sidebar ul li.active a img {
  opacity: 1;
  filter: none;
}

/* 文字样式 */
.sidebar ul li a span {
  font-size: 16px;
  letter-spacing: 0.02em;
}
</style>
