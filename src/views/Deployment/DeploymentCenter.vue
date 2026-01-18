<template>
  <div class="deployment-center">
    <div class="top-bar">
      <div>
        <h3>部署</h3>
        <p class="subtitle">模型导出 / 格式转换</p>
      </div>
    </div>

    <div class="content">
      <FormatConversion />
    </div>
  </div>
</template>

<script>
import FormatConversion from "@/views/Models/FormatConversion.vue";

export default {
  name: "DeploymentCenter",
  components: { FormatConversion },
};
</script>

<style scoped>
.deployment-center {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.top-bar h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #111f68;
}

.subtitle {
  margin: 2px 0 0 0;
  color: #6c757d;
  font-size: 13px;
}

.content {
  margin-top: 4px;
}
</style>
