<template>
  <div class="deployment-page page-container">
    <!-- Hero Section -->
    <header class="deploy-hero">
      <div class="hero-left">
        <div class="hero-eyebrow">生产就绪</div>
        <h1 class="hero-title">部署中心</h1>
        <p class="hero-subtitle">优化、转换和部署您的模型。</p>
      </div>
      <div class="hero-right">
        <!-- Placeholder Stats -->
        <div class="stat-card">
          <div class="stat-label">工具</div>
          <div class="stat-value">1</div>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <section class="deploy-body">
      <!-- Inner Sidebar for Tools -->
      <aside class="deploy-sidebar glass-panel">
        <div class="sidebar-header">
          <span>工具箱</span>
        </div>
        <ul class="tool-list">
          <li 
            :class="{ active: activeTool === 'conversion' }"
            @click="activeTool = 'conversion'"
          >
            <i class="el-icon-refresh"></i>
            <div class="tool-info">
              <span class="tool-name">格式转换</span>
              <span class="tool-desc">导出为 ONNX/TensorRT</span>
            </div>
          </li>
          <!-- Future tools can be added here -->
          <!-- <li class="disabled">
            <i class="el-icon-upload-cloud"></i>
            <div class="tool-info">
              <span class="tool-name">模型服务</span>
              <span class="tool-desc">敬请期待</span>
            </div>
          </li>
           <li class="disabled">
            <i class="el-icon-mobile"></i>
            <div class="tool-info">
              <span class="tool-name">端侧设备</span>
              <span class="tool-desc">敬请期待</span>
            </div>
          </li> -->
        </ul>
      </aside>

      <!-- Active Tool View -->
      <main class="deploy-main glass-panel">
        <transition name="fade" mode="out-in">
          <FormatConversion v-if="activeTool === 'conversion'" />
        </transition>
      </main>
    </section>
  </div>
</template>

<script>
import FormatConversion from "@/views/Models/FormatConversion.vue";

export default {
  name: "DeploymentCenter",
  components: { FormatConversion },
  data() {
    return {
      activeTool: 'conversion'
    };
  }
};
</script>

<style scoped>
.deployment-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Hero */
.deploy-hero {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  padding: 2rem;
  border-radius: var(--radius-lg);
  background: #ffffff;
  border-bottom: 1px solid var(--line-200);
  box-shadow: none;
  color: var(--text-main);
  position: relative;
  overflow: hidden;
}

.deploy-hero::before {
  content: none;
}

.hero-left {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hero-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  font-weight: 600;
}

.hero-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.hero-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.hero-right {
  position: relative;
  z-index: 1;
}

.stat-card {
  min-width: 90px;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  text-align: center;
}

.stat-label { font-size: 0.7rem; color: var(--text-secondary); }
.stat-value { font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin-top: 0.25rem; }

/* Body Layout */
.deploy-body {
  flex: 1;
  display: flex;
  gap: 1.5rem;
  min-height: 0; 
}

/* Sidebar */
.deploy-sidebar {
  flex: 0 0 280px;
  background: rgba(255,255,255,0.6);
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.sidebar-header {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.tool-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-list li {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.tool-list li:hover:not(.disabled) {
  background: rgba(255,255,255,0.5);
  transform: translateX(4px);
}

.tool-list li.active {
  background: white;
  box-shadow: var(--shadow-md);
  border-color: rgba(0,0,0,0.05);
}

.tool-list li.active i {
  color: var(--color-primary);
}

.tool-list li i {
  font-size: 1.5rem;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.tool-info {
  display: flex;
  flex-direction: column;
}

.tool-name {
  font-weight: 600;
  color: var(--text-main);
  font-size: 0.95rem;
}

.tool-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.tool-list li.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Main Content */
.deploy-main {
  flex: 1;
  background: rgba(255,255,255,0.6);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Prevent flex overflow */
  overflow: hidden;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}
</style>
