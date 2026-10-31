'use strict';

const TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');

/**
 * 格式化为契约统一的时间格式 YYYY-MM-DD HH:mm:ss（本地时间）。
 * @param {Date|string|number} value
 * @returns {string}
 */
function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('无效的时间值');
  }
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * 解析时间：兼容 YYYY-MM-DD HH:mm:ss 与 ISO 8601。
 * 解析失败返回 null，由调用方给出中文参数错误。
 * @param {string|Date} value
 * @returns {Date|null}
 */
function parseDateTime(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  const matched = TIME_PATTERN.exec(text);
  if (matched) {
    const [, y, mo, d, h, mi, s] = matched.map(Number);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
    const date = new Date(y, mo - 1, d, h, mi, s, 0);
    if (
      date.getFullYear() !== y ||
      date.getMonth() !== mo - 1 ||
      date.getDate() !== d ||
      date.getHours() !== h ||
      date.getMinutes() !== mi ||
      date.getSeconds() !== s
    ) {
      return null;
    }
    return date;
  }
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/** 当前时间字符串（clock 可注入，便于测试超时） */
function nowString(clock = () => new Date()) {
  return formatDateTime(clock());
}

/** 在给定时间上加分钟，返回格式化字符串 */
function addMinutes(value, minutes) {
  const base = value instanceof Date ? value : parseDateTime(value);
  if (!base) return null;
  return formatDateTime(new Date(base.getTime() + Number(minutes) * 60 * 1000));
}

/** 返回两个时间中较早者（格式化字符串） */
function minDateTime(a, b) {
  const da = a instanceof Date ? a : parseDateTime(a);
  const db = b instanceof Date ? b : parseDateTime(b);
  if (!da) return db ? formatDateTime(db) : null;
  if (!db) return formatDateTime(da);
  return formatDateTime(da.getTime() <= db.getTime() ? da : db);
}

/** a 是否严格晚于 b */
function isAfter(a, b) {
  const da = a instanceof Date ? a : parseDateTime(a);
  const db = b instanceof Date ? b : parseDateTime(b);
  if (!da || !db) return false;
  return da.getTime() > db.getTime();
}

/** 剩余秒数（向上取整，最小 0） */
function remainingSeconds(deadline, now = new Date()) {
  const d = deadline instanceof Date ? deadline : parseDateTime(deadline);
  const n = now instanceof Date ? now : parseDateTime(now);
  if (!d || !n) return 0;
  return Math.max(0, Math.ceil((d.getTime() - n.getTime()) / 1000));
}

module.exports = {
  formatDateTime,
  parseDateTime,
  nowString,
  addMinutes,
  minDateTime,
  isAfter,
  remainingSeconds
};
