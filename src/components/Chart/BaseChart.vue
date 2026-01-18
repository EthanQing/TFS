<template>
  <div class="BaseChart" :style="{ width, height }" ref="chart"></div>
</template>

<script>
export default {
  name: "BaseChart",
  props: {
    options: {
      type: Object,
      default: () => ({})
    },
    width: {
      type: String,
      default: "100%"
    },
    height: {
      type: String,
      default: "400px"
    },
    autoresize: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      chart: null,
      onResize: null
    };
  },
  mounted() {
    // Uses `Vue.prototype.$echarts` from `src/main.js`.
    const echarts = this.$echarts;
    if (!echarts || !this.$refs.chart) return;

    this.chart = echarts.init(this.$refs.chart);
    this.chart.setOption(this.options || {}, true);

    if (this.autoresize) {
      this.onResize = () => {
        if (this.chart) this.chart.resize();
      };
      window.addEventListener("resize", this.onResize);
    }
  },
  beforeDestroy() {
    if (this.onResize) window.removeEventListener("resize", this.onResize);
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
  },
  watch: {
    options: {
      deep: true,
      handler(next) {
        if (!this.chart) return;
        this.chart.setOption(next || {}, true);
      }
    }
  }
};
</script>

<style scoped>
.BaseChart {
  min-height: 100px;
}
</style>
