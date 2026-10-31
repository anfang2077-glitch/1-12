import client from './client';

// B30 待阅列表
export function listPending(params) {
  return client.get('/grading/pending', { params });
}

// B31 阅卷详情
export function getGradingDetail(attemptId) {
  return client.get(`/grading/${attemptId}`);
}

// B32 提交评分并重算总分
export function submitGrading(attemptId, items) {
  return client.post(`/grading/${attemptId}`, { items });
}
