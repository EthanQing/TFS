<template>
  <div class="echarts-container" :class="chartType">
    <!-- 图表容器，根据类型设置不同尺寸 -->
    <div ref="chartContainer" :style="containerStyle"></div>
  </div>
</template>

<script>
export default {
  name: "Chart",
  props: ["metrics", "chartType", "totalEpoch"],
  data() {
    return {
      chartInstance: null, // ECharts实例
      containerStyle: {
        width: '90%',
        height: '350px',
        margin: '0 auto'
      }
    };
  },
  watch: {
    // 监听metrics变化，当数据加载完成后更新图表
    metrics: {
      deep: true,
      handler() {
        this.updateChart();
      },
    },
    // 监听totalEpoch变化，更新图表
    totalEpoch: {
      handler() {
        this.updateChart();
      }
    },
    // 监听chartType变化，更新图表
    chartType: {
      handler() {
        this.updateContainerStyle();
        this.updateChart();
      },
      immediate: true
    },
  },
  mounted() {
    this.updateContainerStyle();
    this.initChart(); // 组件挂载后初始化图表
  },
  methods: {
    updateContainerStyle() {
      if (this.chartType === 'metrics') {
        this.containerStyle = {
          width: '90%',
          height: '380px',
          margin: '0 auto 20px auto'
        };
      } else {
        // 对于loss图表使用更小的尺寸
        this.containerStyle = {
          width: '95%',
          height: '260px',
          margin: '0 auto'
        };
      }
    },
    initChart() {
      // 通过ref获取DOM元素并初始化ECharts实例
      this.chartInstance = this.$echarts.init(this.$refs.chartContainer);

      // 初始设置空图表
      this.chartInstance.setOption(this.getChartOption());

      // 监听窗口大小变化，调整图表尺寸
      window.addEventListener("resize", this.resizeChart);
    },
    updateChart() {
      // 确保metrics存在且图表实例已创建
      if (this.metrics && this.chartInstance) {
        this.chartInstance.setOption(this.getChartOption(), true);
      }
    },
    getChartOption() {
      // 动态生成图表配置，确保metrics已加载
      const data = this.metrics?.metrics || {};
      let series = [];
      let title = '';
      let yAxisName = '';

      // 根据不同的chartType设置不同的series数据
      switch (this.chartType) {
        case "metrics":
          // Metrics表（最上面）
          title = "模型性能指标";
          yAxisName = "指标值";
          series = [
            {
              name: "precision(B)-边界框精确率",
              type: "line",
              data: data["metrics/precision(B)"] || [],
              symbol: 'circle',
              symbolSize: 6,
              showSymbol: false,
              itemStyle: {
                color: '#FF6B6B'
              }
            },
            {
              name: "recall(B)-边界框召回率",
              type: "line",
              data: data["metrics/recall(B)"] || [],
              symbol: 'rect',
              symbolSize: 6,
              showSymbol: false,
              itemStyle: {
                color: '#4ECDC4'
              }
            },
            {
              name: "mAP50(B)-边界框平均精确率50%",
              type: "line",
              data: data["metrics/mAP50(B)"] || [],
              symbol: 'triangle',
              symbolSize: 6,
              showSymbol: false,
              itemStyle: {
                color: '#FFD166'
              }
            },
            {
              name: "mAP50-95(B)-边界框平均精确率50%-95%",
              type: "line",
              data: data["metrics/mAP50-95(B)"] || [],
              symbol: 'diamond',
              symbolSize: 6,
              showSymbol: false,
              itemStyle: {
                color: '#1A535C'
              }
            }
          ];
          break;
        case "box_loss":
          // Box Loss 表（训练和验证）
          title = "Box Loss 边界框损失";
          yAxisName = "Loss";
          series = [
            {
              name: "训练",
              type: "line",
              data: data["train/box_loss"] || [],
              symbol: 'circle',
              symbolSize: 4,
              showSymbol: false,
              itemStyle: {
                color: '#3498DB'
              }
            },
            {
              name: "验证",
              type: "line",
              data: data["val/box_loss"] || [],
              symbol: 'circle',
              symbolSize: 4,
              showSymbol: false,
              itemStyle: {
                color: '#E74C3C'
              }
            }
          ];
          break;
        case "cls_loss":
          // Classification Loss 表（训练和验证）
          title = "Classification Loss 类别损失";
          yAxisName = "Loss";
          series = [
            {
              name: "训练",
              type: "line",
              data: data["train/cls_loss"] || [],
              symbol: 'circle',
              symbolSize: 4,
              showSymbol: false,
              itemStyle: {
                color: '#3498DB'
              }
            },
            {
              name: "验证",
              type: "line",
              data: data["val/cls_loss"] || [],
              symbol: 'circle',
              symbolSize: 4,
              showSymbol: false,
              itemStyle: {
                color: '#E74C3C'
              }
            }
          ];
          break;
        case "dfl_loss":
          // DFL Loss 表（训练和验证）
          title = "Distribution Focal Loss 分布焦点损失";
          yAxisName = "Loss";
          series = [
            {
              name: "训练",
              type: "line",
              data: data["train/dfl_loss"] || [],
              symbol: 'circle',
              symbolSize: 4,
              showSymbol: false,
              itemStyle: {
                color: '#3498DB'
              }
            },
            {
              name: "验证",
              type: "line",
              data: data["val/dfl_loss"] || [],
              symbol: 'circle',
              symbolSize: 4,
              showSymbol: false,
              itemStyle: {
                color: '#E74C3C'
              }
            }
          ];
          break;
        default:
          series = [];
      }

      return {
        title: {
          text: title,
          left: 'center',
          top: 5,
          padding: [0, 0, 10, 0],
          textStyle: {
            fontSize: this.chartType === 'metrics' ? 18 : 14
          }
        },
        legend: {
          data: series.map(item => item.name),
          top: this.chartType === 'metrics' ? 35 : 25,
          left: 'center',
          orient: 'horizontal',
          textStyle: {
            fontSize: this.chartType === 'metrics' ? 12 : 10
          },
          itemWidth: this.chartType === 'metrics' ? 25 : 15,
          itemHeight: this.chartType === 'metrics' ? 14 : 10,
          itemGap: this.chartType === 'metrics' ? 30 : 10
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '10%',
          top: this.chartType === 'metrics' ? '80px' : '25%',
          containLabel: true
        },
        tooltip: {
          trigger: 'axis',
          formatter: function (params) {
            let result = `<div style="font-weight:bold;margin-bottom:5px">Epoch-迭代次数 ${params[0]?.axisValue ?? '-'} </div>`;
            params.forEach(param => {
              const colorSpan = `<span style=\"display:inline-block;margin-right:5px;width:10px;height:10px;border-radius:50%;background-color:${param.color}\"></span>`;
              const v = (param && param.value != null && isFinite(param.value)) ? Number(param.value).toFixed(4) : '-';
              result += `${colorSpan}${param.seriesName}: <strong>${v}</strong><br/>`;
            });
            return result;
          },
          axisPointer: {
            type: 'cross',
            label: {
              backgroundColor: '#6a7985'
            }
          }
        },
        xAxis: {
          type: "category",
          // 使用稳定的上限：优先 totalEpoch，其次已有数据最大长度，最后默认 100
          data: Array.from({ length: (this.totalEpoch || this._inferMaxLen(data) || 100) }, (_, i) => i + 1),
          name: 'Epoch-迭代次数',
          nameLocation: 'middle',
          nameGap: 25,
          axisLabel: {
            interval: this.chartType === 'metrics' ? 'auto' : Math.max(Math.floor(((this.totalEpoch || this._inferMaxLen(data) || 100)) / 10) - 1, 0),
            fontSize: this.chartType === 'metrics' ? 12 : 10
          }
        },
        yAxis: {
          type: "value",
          name: yAxisName,
          nameLocation: 'middle',
          nameGap: 35,
          axisLabel: {
            fontSize: this.chartType === 'metrics' ? 12 : 10
          }
        },
        series: series,
        dataZoom: this.chartType === 'metrics' ? [
          {
            type: 'inside',
            xAxisIndex: 0,
            start: 0,
            end: 100
          }
        ] : [
          {
            type: 'inside',
            xAxisIndex: 0,
            start: 0,
            end: 100
          }
        ],
      };
    },
    resizeChart() {
      // 窗口大小变化时重新调整图表大小
      if (this.chartInstance) {
        this.chartInstance.resize();
      }
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
      } catch (_) { return 0; }
    },
  },
  beforeDestroy() {
    // 组件销毁前移除事件监听并释放ECharts实例
    window.removeEventListener("resize", this.resizeChart);
    if (this.chartInstance) {
      this.chartInstance.dispose();
      this.chartInstance = null;
    }
  },
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

/* 响应式设计 */
@media (max-width: 768px) {
  .echarts-container {
    margin: 10px 0;
  }
  
  .echarts-container.metrics {
    margin-bottom: 15px;
  }
}
</style>
