import client from './client';

// B01 登录
export function login(payload, config) {
  return client.post('/auth/login', payload, config);
}

// B02 获取当前登录用户
export function getMe(config) {
  return client.get('/auth/me', config);
}
