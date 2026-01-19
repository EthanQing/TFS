import axios from 'axios';

// 统一后端基础地址，便于 WebSocket/HTTP 共用
export const API_BASE = window.__API_BASE__ || 'http://localhost:18001';
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


export default service;
