import Vue from 'vue'
import App from './App.vue'
import appConfig from '../app.config.js'

import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
// 使用命名导入方式
import * as echarts from 'echarts'

import router from '@/router'

import "@/styles/reset.css";
import "@/styles/global.css";
import "@/styles/element-overrides.css";

// 解决 ResizeObserver loop limit exceeded 报错 (ElTable 常规报错)
const debounce = (fn, delay) => {
  let timer = null;
  return function () {
    let context = this;
    let args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, delay);
  };
};

const _ResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends _ResizeObserver {
  constructor(callback) {
    callback = debounce(callback, 16);
    super(callback);
  }
};

// 创建全局 EventBus
Vue.prototype.EventBus = new Vue()

// 将ECharts挂载到Vue原型上，方便全局使用
Vue.prototype.$echarts = echarts

Vue.config.productionTip = false

Vue.use(ElementUI);

// 设置浏览器标题
document.title = appConfig.appTitle;

new Vue({
  render: h => h(App),
  router,
  echarts
}).$mount('#app')
