import axios from 'axios';
import { getToken, clearToken } from './authStorage';
import { toast } from '../utils/toast';

// 统一业务异常：携带后端业务码、HTTP 状态与中文提示
export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || '请求失败');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const client = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json; charset=utf-8' }
});

// 请求拦截：自动注入 Bearer token
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function redirectToLogin() {
  if (window.location.pathname === '/login') return;
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?redirect=${redirect}`);
}

function handleAuthFailure(config) {
  clearToken();
  // 登录页自身或主动跳过时不强制跳转，避免刷新循环
  if (config && config.skipAuthRedirect) return;
  redirectToLogin();
}

function handleError(error, config) {
  const skipToast = Boolean(config && config.skipErrorToast);
  const isAuthError = error.code === 40101 || error.status === 401;
  if (isAuthError) handleAuthFailure(config);
  if (!skipToast) toast.error(error.message || '请求失败');
}

// 响应拦截：解包 {code,message,data}，code !== 0 统一抛错
client.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (!body || typeof body.code === 'undefined') return body;
    if (body.code !== 0) {
      const error = new ApiError(body.code, body.message, response.status);
      handleError(error, response.config);
      throw error;
    }
    return body.data;
  },
  (error) => {
    if (error instanceof ApiError) throw error;
    const response = error.response;
    let apiError;
    if (response && response.data && typeof response.data.code !== 'undefined') {
      apiError = new ApiError(response.data.code, response.data.message, response.status);
    } else if (response) {
      apiError = new ApiError(-1, `请求失败（HTTP ${response.status}）`, response.status);
    } else if (error.code === 'ECONNABORTED') {
      apiError = new ApiError(-1, '请求超时，请稍后重试', 0);
    } else {
      apiError = new ApiError(-1, '网络异常，请检查网络连接后重试', 0);
    }
    handleError(apiError, error.config || {});
    throw apiError;
  }
);

export default client;
