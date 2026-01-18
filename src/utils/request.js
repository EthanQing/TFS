import axios from 'axios';

// 统一后端基础地址，便于 WebSocket/HTTP 共用
export const API_BASE = window.__API_BASE__ || 'http://192.168.2.112:18001';
const __IS_HTTPS__ = API_BASE.startsWith('https://');
export const WS_BASE = window.__WS_BASE__ || (
  __IS_HTTPS__ ? API_BASE.replace('https://', 'wss://') : API_BASE.replace('http://', 'ws://')
);

// 创建 axios 实例
const service = axios.create({
  baseURL: API_BASE,
  timeout: 10000 // 请求超时时间
});

// request 拦截器
service.interceptors.request.use(
  config => {
    // 在这里可以添加 token 等
    return config;
  },
  error => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// response 拦截器
service.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    console.error('Response Error:', error);
    return Promise.reject(error);
  }
);

// 为了兼容原有的 fetch 写法，这里暂时保留或者提供一个新的 request 方法
// 原项目使用的是 fetch，重构建议使用 axios 但为了最小化改动，
// 我们可以保留 API_BASE 导出，或者将 fetch 封装在这里。
// 鉴于 proposal 提到了 axios 封装，我将提供 axios 实例，但在 api 文件中暂时适配原有逻辑或直接重写为 axios。
// 既然要重构，最好一步到位用 axios。

export default service;
