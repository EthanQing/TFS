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
    goModels() {
      // 任务列表页已移除，此入口不做跳转
    },
    getIconPath(type, isActive) {
      const iconMap = {
        data: '图片',
        architecture: '模型', 
        project: '项目'
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
  margin-right: 10px;
  box-shadow: 4px 0 13px rgba(0, 0, 0, 0.2);
}

.sidebar ul li {
  width: 100%;
  height: 80px;
  font-size: 18px;
  transition: background-color 0.3s;
  border-bottom: 1px solid #f0f1f2;
}
.sidebar ul li:hover {
  background-color: #f0f1f2;
}

/* 激活状态样式 */
.sidebar ul li.active {
  background-color: #111f68;
  color: white;
}

/* 确保链接颜色跟随父元素 */
.sidebar ul li a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: inherit;
  text-decoration: none;
  box-sizing: border-box;
}

/* 图片样式 */
.sidebar ul li a img {
  width: 24px;
  height: 24px;
  margin-right: 12px;
  flex-shrink: 0;
}

/* 文字样式 */
.sidebar ul li a span {
  font-size: 18px;
  font-weight: 500;
}
</style>
