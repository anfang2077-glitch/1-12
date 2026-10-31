import client from './client';

// B11 题库分页列表
export function listQuestions(params) {
  return client.get('/questions', { params });
}

// B12 新建题目
export function createQuestion(payload) {
  return client.post('/questions', payload);
}

// B13 修改题目
export function updateQuestion(id, payload) {
  return client.put(`/questions/${id}`, payload);
}

// B14 删除题目
export function deleteQuestion(id) {
  return client.delete(`/questions/${id}`);
}

// B15 JSON 批量导入（部分成功）
export function importQuestions(payload) {
  return client.post('/questions/import', payload);
}
