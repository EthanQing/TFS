import axios from 'axios';

// Backend base URL (shared by HTTP/WebSocket).
// By default, use the same origin as the frontend and let nginx proxy /api/*
// to the backend container. Deployments can still override these at runtime by
// setting window.__API_BASE__ / window.__WS_BASE__ before this bundle loads.
export const API_BASE = window.__API_BASE__ || '';
export const WS_BASE = window.__WS_BASE__ || (() => {
  if (API_BASE) {
    return API_BASE.startsWith('https://')
      ? API_BASE.replace('https://', 'wss://')
      : API_BASE.replace('http://', 'ws://');
  }
  const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${wsScheme}://${window.location.host}`;
})();

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
