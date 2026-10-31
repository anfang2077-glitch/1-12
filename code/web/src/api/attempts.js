import client from './client';

// B26 答卷详情（断线恢复，含已保存答案与剩余秒数）
export function getAttempt(id) {
  return client.get(`/attempts/${id}`);
}

// B27 单题自动保存
export function saveAnswer(attemptId, payload) {
  return client.put(`/attempts/${attemptId}/answers`, payload);
}

// B28 交卷（幂等）
export function submitAttempt(id) {
  return client.post(`/attempts/${id}/submit`);
}

// B29 成绩与解析
export function getResult(id) {
  return client.get(`/attempts/${id}/result`);
}
