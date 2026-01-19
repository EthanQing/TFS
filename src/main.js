import Vue from 'vue'
import App from './App.vue'

import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
// 使用命名导入方式
import * as echarts from 'echarts'

import router from '@/router'

import "@/styles/reset.css";
import "@/styles/global.css";
import "@/styles/element-overrides.css";

import { preloadReferenceData } from "@/store/referenceStore";

// 创建全局 EventBus
Vue.prototype.EventBus = new Vue()

// 将ECharts挂载到Vue原型上，方便全局使用
Vue.prototype.$echarts = echarts

Vue.config.productionTip = false

Vue.use(ElementUI);

// Preload small reference lists so pages/components don't depend on visit order.
preloadReferenceData();

new Vue({
  render: h => h(App),
  router,
  echarts
}).$mount('#app')
