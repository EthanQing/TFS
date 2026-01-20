<template>
  <div class="echarts-container" :class="chartType">
    <div ref="chartContainer" :style="containerStyle"></div>
  </div>
</template>

<script>
export default {
  name: "TrainingChart",
  props: {
    metrics: {
      type: Object,
      default: null
    },
    customSeries: {
      type: Array,
      default: () => []
    },
    customTitle: {
      type: String,
      default: ""
    },
    customYAxisName: {
      type: String,
      default: ""
    },
    chartType: {
      type: String,
      default: "metrics"
    },
    totalEpoch: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      chartInstance: null,
      containerStyle: {
        width: "90%",
        height: "350px",
        margin: "0 auto"
      }
    };
  },
  watch: {
    metrics: {
      deep: true,
      handler() {
        this.updateChart();
      }
    },
    customSeries: {
      deep: true,
      handler() {
        this.updateChart();
      }
    },
    totalEpoch() {
      this.updateChart();
    },
    chartType: {
      handler() {
        this.updateContainerStyle();
        this.updateChart();
      },
      immediate: true
    }
  },
  mounted() {
    this.updateContainerStyle();
    this.initChart();
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.resizeChart);
    if (this.chartInstance) {
      this.chartInstance.dispose();
      this.chartInstance = null;
    }
  },
  methods: {
    updateContainerStyle() {
      const hasCustom = Array.isArray(this.customSeries) && this.customSeries.length > 0;
      if (this.chartType === "metrics" || (hasCustom && this.chartType === "overview")) {
        this.containerStyle = {
          width: "90%",
          height: "380px",
          margin: "0 auto 20px auto"
        };
        return;
      }
      this.containerStyle = {
        width: "95%",
        height: "260px",
        margin: "0 auto"
      };
    },
    initChart() {
      const echarts = this.$echarts;
      if (!echarts || !this.$refs.chartContainer) return;

      this.chartInstance = echarts.init(this.$refs.chartContainer);
      this.chartInstance.setOption(this.getChartOption());
      window.addEventListener("resize", this.resizeChart);
    },
    updateChart() {
      if (!this.chartInstance) return;
      this.chartInstance.setOption(this.getChartOption(), true);
    },
    _inferMaxLen(data) {
      try {
        const keys = Object.keys(data || {});
        let maxLen = 0;
        keys.forEach(k => {
          const arr = data[k];
          if (Array.isArray(arr)) maxLen = Math.max(maxLen, arr.length);
        });
        return maxLen || 0;
      } catch (_) {
        return 0;
      }
    },
    _inferMaxLenFromSeries(series) {
      try {
        let maxLen = 0;
        (series || []).forEach(item => {
          const arr = item && item.data;
          if (Array.isArray(arr)) maxLen = Math.max(maxLen, arr.length);
        });
        return maxLen || 0;
      } catch (_) {
        return 0;
      }
    },
    _toXYData(arr) {
      // Transform [y0, y1, y2...] to [[1, y0], [2, y1], [3, y2]...] for value xAxis
      if (!Array.isArray(arr)) return [];
      return arr.map((val, idx) => [idx + 1, val]);
    },
    getChartOption() {
      const data = this.metrics?.metrics || {};
      const useCustom = Array.isArray(this.customSeries) && this.customSeries.length > 0;
      let series = [];
      let title = "";
      let yAxisName = "";
      const palette = [
        "#3b82f6", // Blue 500
        "#6366f1", // Indigo 500
        "#0ea5e9", // Sky 500
        "#10b981", // Emerald 500
        "#f59e0b", // Amber 500
        "#ef4444", // Red 500
        "#8b5cf6", // Violet 500
        "#64748b"  // Slate 500
      ];

      if (useCustom) {
        title = this.customTitle || "指标";
        yAxisName = this.customYAxisName || "";
        series = this.customSeries.map((item, idx) => {
          const color = item && item.color ? item.color : palette[idx % palette.length];
          return {
            name: item && item.name ? item.name : `系列 ${idx + 1}`,
            type: "line",
            data: this._toXYData((item && item.data) || []),
            symbol: "circle",
            symbolSize: 4,
            showSymbol: false,
            itemStyle: { color },
            lineStyle: { color }
          };
        });
      } else {
        switch (this.chartType) {
          case "metrics":
            title = "模型指标";
            yAxisName = "值";
            series = [
              {
                name: "精确率",
                type: "line",
                data: this._toXYData(data["metrics/precision(B)"] || []),
                symbol: "circle",
                symbolSize: 6,
                showSymbol: false,
                itemStyle: { color: "#f43f5e" } // Rose 500
              },
              {
                name: "召回率",
                type: "line",
                data: this._toXYData(data["metrics/recall(B)"] || []),
                symbol: "rect",
                symbolSize: 6,
                showSymbol: false,
                itemStyle: { color: "#14b8a6" } // Teal 500
              },
              {
                name: "mAP50",
                type: "line",
                data: this._toXYData(data["metrics/mAP50(B)"] || []),
                symbol: "triangle",
                symbolSize: 6,
                showSymbol: false,
                itemStyle: { color: "#f59e0b" } // Amber 500
              },
              {
                name: "mAP50-95",
                type: "line",
                data: this._toXYData(data["metrics/mAP50-95(B)"] || []),
                symbol: "diamond",
                symbolSize: 6,
                showSymbol: false,
                itemStyle: { color: "#3b82f6" } // Blue 500
              }
            ];
            break;
          case "box_loss":
            title = "边界框损失";
            yAxisName = "损失";
            series = [
              {
                name: "训练集",
                type: "line",
                data: this._toXYData(data["train/box_loss"] || []),
                symbol: "circle",
                symbolSize: 4,
                showSymbol: false,
                itemStyle: { color: "#3b82f6" }
              },
              {
                name: "验证集",
                type: "line",
                data: this._toXYData(data["val/box_loss"] || []),
                symbol: "circle",
                symbolSize: 4,
                showSymbol: false,
                itemStyle: { color: "#f43f5e" }
              }
            ];
            break;
          case "cls_loss":
            title = "分类损失";
            yAxisName = "损失";
            series = [
              {
                name: "训练集",
                type: "line",
                data: this._toXYData(data["train/cls_loss"] || []),
                symbol: "circle",
                symbolSize: 4,
                showSymbol: false,
                itemStyle: { color: "#3b82f6" }
              },
              {
                name: "验证集",
                type: "line",
                data: this._toXYData(data["val/cls_loss"] || []),
                symbol: "circle",
                symbolSize: 4,
                showSymbol: false,
                itemStyle: { color: "#f43f5e" }
              }
            ];
            break;
          case "dfl_loss":
            title = "DFL损失";
            yAxisName = "损失";
            series = [
              {
                name: "训练集",
                type: "line",
                data: this._toXYData(data["train/dfl_loss"] || []),
                symbol: "circle",
                symbolSize: 4,
                showSymbol: false,
                itemStyle: { color: "#3b82f6" }
              },
              {
                name: "验证集",
                type: "line",
                data: this._toXYData(data["val/dfl_loss"] || []),
                symbol: "circle",
                symbolSize: 4,
                showSymbol: false,
                itemStyle: { color: "#f43f5e" }
              }
            ];
            break;
          default:
            series = [];
        }
      }

      const maxLen =
        this.totalEpoch ||
        (useCustom ? this._inferMaxLenFromSeries(series) : this._inferMaxLen(data)) ||
        100;

      return {
        title: {
          text: title,
          left: "center",
          top: 5,
          padding: [0, 0, 10, 0],
          textStyle: { fontSize: this.chartType === "metrics" ? 18 : 14 }
        },
        legend: {
          data: series.map(item => item.name),
          top: this.chartType === "metrics" ? 35 : 25,
          left: "center",
          orient: "horizontal",
          textStyle: { fontSize: this.chartType === "metrics" ? 12 : 10 },
          itemWidth: this.chartType === "metrics" ? 25 : 15,
          itemHeight: this.chartType === "metrics" ? 14 : 10,
          itemGap: this.chartType === "metrics" ? 30 : 10
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "10%",
          top: this.chartType === "metrics" ? "80px" : "25%",
          containLabel: true
        },
        tooltip: {
          trigger: "axis",
          formatter: function (params) {
            // For value type xAxis with [x, y] data, axisValue is the x value
            let result = `<div style="font-weight:bold;margin-bottom:5px">轮次 ${
              params[0]?.data?.[0] ?? params[0]?.axisValue ?? "-"
            } </div>`;
            params.forEach(param => {
              const colorSpan = `<span style="display:inline-block;margin-right:5px;width:10px;height:10px;border-radius:50%;background-color:${
                param.color
              }"></span>`;
              // For [x, y] data format, value is the array, so extract y (index 1)
              let yVal = param.value;
              if (Array.isArray(param.value) && param.value.length >= 2) {
                yVal = param.value[1];
              }
              const v =
                yVal != null && isFinite(yVal)
                  ? Number(yVal).toFixed(4)
                  : "-";
              result += `${colorSpan}${param.seriesName}: <strong>${v}</strong><br/>`;
            });
            return result;
          },
          axisPointer: {
            type: "cross",
            label: { backgroundColor: "#6a7985" }
          }
        },
        xAxis: {
          type: "value",
          min: 0,
          max: maxLen,
          interval: 5,
          name: "轮次",
          nameLocation: "middle",
          nameGap: 25,
          axisLabel: {
            fontSize: this.chartType === "metrics" ? 12 : 10
          }
        },
        yAxis: {
          type: "value",
          name: yAxisName,
          nameLocation: "middle",
          nameGap: 35,
          axisLabel: { fontSize: this.chartType === "metrics" ? 12 : 10 }
        },
        series,
        dataZoom: [
          {
            type: "inside",
            xAxisIndex: 0,
            start: 0,
            end: 100
          }
        ]
      };
    },
    resizeChart() {
      if (this.chartInstance) this.chartInstance.resize();
    }
  }
};
</script>

<style scoped>
.echarts-container {
  width: 100%;
  margin: 5px 0;
}

.echarts-container.metrics {
  margin-bottom: 20px;
}

.echarts-container.box_loss,
.echarts-container.cls_loss,
.echarts-container.dfl_loss {
  padding: 0;
}

@media (max-width: 768px) {
  .echarts-container {
    margin: 10px 0;
  }

  .echarts-container.metrics {
    margin-bottom: 15px;
  }
}
</style>
