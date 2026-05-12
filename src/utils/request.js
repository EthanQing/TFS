import axios from 'axios';

// Backend base URL (shared by HTTP/WebSocket). Default to current host + :18001.
const _defaultScheme = window.location.protocol === 'https:' ? 'https' : 'http';
const _defaultHost = window.location.hostname || '192.168.2.112';
const _defaultApiBase = `${_defaultScheme}://192.168.2.112:8000`;
export const API_BASE = window.__API_BASE__ || _defaultApiBase;
const __IS_HTTPS__ = API_BASE.startsWith('https://');
export const WS_BASE = window.__WS_BASE__ || (
  __IS_HTTPS__ ? API_BASE.replace('https://', 'wss://') : API_BASE.replace('http://', 'ws://')
);

// Create axios instance.
const service = axios.create({
  baseURL: API_BASE,
  timeout: 10000 // Request timeout (ms)
});

// Request interceptor.
service.interceptors.request.use(
  config => {
    // Attach auth token here if needed.
    return config;
  },
  error => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor.
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