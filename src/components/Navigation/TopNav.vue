<template>
  <div class="sidebar-container">
    <div class="brand">
        <div class="logo-mark">
            <i class="el-icon-s-platform"></i>
        </div>
        <span class="brand-text">训练平台</span>
    </div>
    
    <nav class="nav-menu">
      <ul>
        <li 
          @click="navigate('/datasets')" 
          :class="{ active: isDataActive }"
        >
          <div class="nav-item">
            <i class="el-icon-picture-outline nav-icon"></i>
            <span>数据集</span>
          </div>
        </li>
        
        <li 
          @click="navigate('/architecture')" 
          :class="{ active: isArchitectureActive }"
        >
          <div class="nav-item">
             <i class="el-icon-connection nav-icon"></i>
             <span>模型库</span>
          </div>
        </li>

        <li 
          @click="navigate('/projects')" 
          :class="{ active: isProjectActive }"
        >
          <div class="nav-item">
            <i class="el-icon-folder-opened nav-icon"></i>
            <span>项目</span>
          </div>
        </li>

        <li 
          @click="navigate('/deployment')" 
          :class="{ active: isDeploymentActive }"
        >
          <div class="nav-item">
            <i class="el-icon-s-promotion nav-icon"></i>
            <span>部署</span>
          </div>
        </li>
      </ul>
    </nav>
    
    <div class="sidebar-footer">
        <div class="user-profile">
            <div class="avatar"><i class="el-icon-user-solid"></i></div>
            <div class="user-info">
                <div class="user-name">管理员</div>
                <div class="user-role">系统管理员</div>
            </div>
        </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "TopNav",
  computed: {
    isDataActive() {
      const p = this.$route.path;
      return p === "/datasets" || p.startsWith("/datadetail") || p.includes("/imagespart");
    },
    isProjectActive() {
      const p = this.$route.path;
      return p === "/projects" || p.startsWith("/projectsdetail") || p.includes("/projectscharts") || p.includes("/models/modelsstep1");
    },
    isArchitectureActive() {
      return this.$route.path === "/architecture";
    },
    isDeploymentActive() {
      const p = this.$route.path;
      return p === "/deployment" || p.startsWith("/deployment");
    },
  },
  methods: {
    navigate(path) {
      if (this.$route.path !== path) {
        this.$router.push(path);
      }
    },
  },
};
</script>

<style scoped>
.sidebar-container {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 240px;
  background: var(--bg-sidebar); /* White */
  border-right: 1px solid var(--border-color); /* Slate 200 */
  display: flex;
  flex-direction: column;
  z-index: 1000;
  box-shadow: 1px 0 16px rgba(0,0,0,0.03);
}

/* Brand */
.brand {
    height: 80px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 24px;
    border-bottom: 1px solid var(--border-light);
}

.logo-mark {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
    box-shadow: var(--shadow-md);
}

.brand-text {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: -0.01em;
}

/* Menu */
.nav-menu {
    flex: 1;
    padding: 24px 16px;
    overflow-y: auto;
}

.nav-menu ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.nav-menu li {
    cursor: pointer;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.95rem;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid transparent;
}

.nav-icon {
    font-size: 1.25rem;
    color: #94a3b8; /* Slate 400 */
    transition: color 0.2s;
}

/* Hover State */
.nav-menu li:hover .nav-item {
    background-color: var(--bg-body);
    color: var(--text-main);
}

.nav-menu li:hover .nav-icon {
    color: var(--text-secondary);
}

/* Active State */
.nav-menu li.active .nav-item {
    background-color: var(--color-primary-light); /* Blue 50 */
    color: var(--color-primary); /* Blue 600 */
    font-weight: 600;
}

.nav-menu li.active .nav-icon {
    color: var(--color-primary);
}

/* Footer */
.sidebar-footer {
    padding: 20px 24px;
    border-top: 1px solid var(--border-light);
}

.user-profile {
    display: flex;
    align-items: center;
    gap: 12px;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 1.2rem;
}

.user-info {
    display: flex;
    flex-direction: column;
}

.user-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-main);
}

.user-role {
    font-size: 0.75rem;
    color: var(--text-light);
}
</style>
