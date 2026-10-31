'use strict';

const { ApiError } = require('./response');
const { parseDateTime } = require('./time');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message) {
  return ApiError.badRequest(message);
}

function assert(condition, message) {
  if (!condition) throw badRequest(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** 要求请求体为 JSON 对象 */
function requireBody(body) {
  if (!isPlainObject(body)) throw badRequest('参数错误：请求体必须为 JSON 对象');
  return body;
}

/** 必填字符串 */
function requireString(value, label, options = {}) {
  const { min = 1, max = Infinity, trim = true, pattern = null, patternMessage = null } = options;
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    throw badRequest(`参数错误：${label}不能为空`);
  }
  if (typeof value !== 'string') throw badRequest(`参数错误：${label}必须为字符串`);
  const text = trim ? value.trim() : value;
  if (text.length < min) throw badRequest(`参数错误：${label}长度不能少于 ${min} 个字符`);
  if (text.length > max) throw badRequest(`参数错误：${label}长度不能超过 ${max}`);
  if (pattern && !pattern.test(text)) throw badRequest(patternMessage || `参数错误：${label}格式不正确`);
  return text;
}

/** 可选字符串：undefined / 空串视为未提供，null 表示显式清空 */
function optionalString(value, label, options = {}) {
  const { max = Infinity, trim = true, allowNull = true } = options;
  if (value === undefined) return undefined;
  if (value === null) return allowNull ? null : undefined;
  if (typeof value !== 'string') throw badRequest(`参数错误：${label}必须为字符串`);
  const text = trim ? value.trim() : value;
  if (text === '') return allowNull ? null : undefined;
  if (text.length > max) throw badRequest(`参数错误：${label}长度不能超过 ${max}`);
  return text;
}

/** 必填整数（允许数字字符串，来自路径参数） */
function requireInt(value, label, options = {}) {
  const { min = -Infinity, max = Infinity } = options;
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isInteger(num)) {
    throw badRequest(`参数错误：${label}必须为整数`);
  }
  if (num < min || num > max) {
    throw badRequest(`参数错误：${label}取值范围为 ${min}~${max}`);
  }
  return num;
}

/** 可选整数 */
function optionalInt(value, label, options = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireInt(value, label, options);
}

/** 必填数字（支持小数） */
function requireNumber(value, label, options = {}) {
  const { min = -Infinity, max = Infinity, decimals = null, message = null } = options;
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw badRequest(message || `参数错误：${label}必须为数字`);
  }
  if (decimals !== null) {
    const scaled = num * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) > 1e-9) {
      throw badRequest(message || `参数错误：${label}最多保留 ${decimals} 位小数`);
    }
  }
  if (num < min || num > max) {
    throw badRequest(message || `参数错误：${label}取值范围为 ${min}~${max}`);
  }
  return num;
}

/** 可选数字 */
function optionalNumber(value, label, options = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireNumber(value, label, options);
}

/** 必填枚举 */
function requireEnum(value, allowed, label, message) {
  if (value === undefined || value === null || value === '') {
    throw badRequest(`参数错误：${label}不能为空`);
  }
  if (!allowed.includes(value)) {
    throw badRequest(message || `参数错误：${label}取值必须为 ${allowed.join('/')}`);
  }
  return value;
}

/** 可选枚举 */
function optionalEnum(value, allowed, label, message) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireEnum(value, allowed, label, message);
}

/** 可选布尔值 */
function optionalBoolean(value, label) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw badRequest(`参数错误：${label}必须为布尔值`);
  return value;
}

/** 必填时间（YYYY-MM-DD HH:mm:ss，兼容 ISO 8601） */
function requireDateTime(value, label) {
  if (value === undefined || value === null || value === '') {
    throw badRequest(`参数错误：${label}不能为空`);
  }
  const date = parseDateTime(value);
  if (!date) throw badRequest(`参数错误：${label}格式不正确，应为 YYYY-MM-DD HH:mm:ss`);
  return date;
}

/** 可选时间 */
function optionalDateTime(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireDateTime(value, label);
}

/** 分页参数：默认 page=1、pageSize=10，越界报 40001（契约 C-1） */
function parsePagination(query = {}) {
  const page = query.page === undefined || query.page === '' ? 1 : requireInt(query.page, 'page', { min: 1 });
  const pageSize =
    query.pageSize === undefined || query.pageSize === ''
      ? 10
      : requireInt(query.pageSize, 'pageSize', { min: 1, max: 100 });
  return { page, pageSize };
}

/** 可选邮箱 */
function optionalEmail(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw badRequest('参数错误：邮箱格式不正确');
  const text = value.trim();
  if (text === '') return undefined;
  if (text.length > 100 || !EMAIL_PATTERN.test(text)) throw badRequest('参数错误：邮箱格式不正确');
  return text;
}

/** 路径 ID */
function parseId(value, label) {
  return requireInt(value, label, { min: 1 });
}

module.exports = {
  EMAIL_PATTERN,
  badRequest,
  assert,
  isPlainObject,
  requireBody,
  requireString,
  optionalString,
  requireInt,
  optionalInt,
  requireNumber,
  optionalNumber,
  requireEnum,
  optionalEnum,
  optionalBoolean,
  requireDateTime,
  optionalDateTime,
  parsePagination,
  optionalEmail,
  parseId
};
