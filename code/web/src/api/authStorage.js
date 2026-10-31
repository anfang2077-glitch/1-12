// 令牌本地存储：统一读写，避免各处硬编码 localStorage key
const TOKEN_KEY = 'exam_system_token';

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function setToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    // 隐私模式下 localStorage 可能不可用，忽略即可
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // 忽略
  }
}
