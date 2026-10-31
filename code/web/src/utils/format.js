export const ROLE_LABELS = { admin: '管理员', teacher: '教师', student: '学生' };

export const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  short: '简答题'
};

export const TYPE_TONES = {
  single: 'blue',
  multiple: 'purple',
  judge: 'teal',
  short: 'orange'
};

export const EXAM_STATUS_LABELS = { draft: '草稿', published: '已发布', closed: '已关闭' };

export const EXAM_STATUS_TONES = { draft: 'gray', published: 'green', closed: 'gray' };

export const ATTEMPT_STATUS_LABELS = {
  none: '未开始',
  in_progress: '进行中',
  submitted: '待阅卷',
  graded: '已评分'
};

export const ATTEMPT_STATUS_TONES = {
  none: 'gray',
  in_progress: 'blue',
  submitted: 'orange',
  graded: 'green'
};

export const DIFFICULTY_LABELS = {
  1: '很简单',
  2: '简单',
  3: '中等',
  4: '较难',
  5: '困难'
};

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function homePath(role) {
  if (role === 'admin') return '/admin/overview';
  if (role === 'teacher') return '/teacher/exams';
  if (role === 'student') return '/student/exams';
  return '/login';
}

// 解析后端 "YYYY-MM-DD HH:mm:ss"（按浏览器本地时区解释）
export function parseServerTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatScore(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
}

export function formatAnswer(answer, type) {
  if (answer === null || answer === undefined || answer === '') return '未作答';
  if (type === 'multiple') {
    const list = Array.isArray(answer) ? answer : [];
    return list.length ? [...list].sort().join('、') : '未作答';
  }
  if (type === 'judge') {
    if (answer === 'T' || answer === true) return '正确';
    if (answer === 'F' || answer === false) return '错误';
    return String(answer);
  }
  return String(answer);
}

// 剩余秒数格式化为 mm:ss 或 h:mm:ss
export function formatRemaining(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

// 取时间字符串中的 HH:mm:ss，用于「已保存 12:03:45」提示
export function timePart(value) {
  const date = parseServerTime(value);
  if (!date) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// "YYYY-MM-DD HH:mm:ss" -> datetime-local 输入框的 "YYYY-MM-DDTHH:mm"
export function toDatetimeLocal(value) {
  const date = parseServerTime(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:${mm}`;
}

// datetime-local -> 后端契约要求的 "YYYY-MM-DD HH:mm:ss"
export function fromDatetimeLocal(value) {
  if (!value) return '';
  const text = String(value).replace('T', ' ');
  return text.length === 16 ? `${text}:00` : text;
}

export function truncate(text, max = 60) {
  if (!text) return '';
  const str = String(text);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}
