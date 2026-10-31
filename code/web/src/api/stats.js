import client from './client';

// B33 全局概览（admin）
export function getOverview() {
  return client.get('/stats/overview');
}

// B34 场次统计摘要列表（teacher/admin）
export function listExamStats() {
  return client.get('/stats/exams');
}

// B35 单场详细统计
export function getExamStats(id) {
  return client.get(`/stats/exams/${id}`);
}

// B36 学生历次成绩
export function getStudentStats(id) {
  return client.get(`/stats/students/${id}`);
}
