'use strict';

const { ApiError } = require('./response');
const {
  requireString,
  requireInt,
  requireNumber,
  requireEnum,
  optionalString
} = require('./validate');

/** 题型枚举 */
const QUESTION_TYPES = ['single', 'multiple', 'judge', 'short'];
/** 选择题选项 key 范围 */
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
/** 客观题（可自动判分） */
const OBJECTIVE_TYPES = ['single', 'multiple', 'judge'];

function badRequest(message) {
  return ApiError.badRequest(message);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isObjective(type) {
  return OBJECTIVE_TYPES.includes(type);
}

function isMultipleAnswer(value) {
  return Array.isArray(value);
}

/**
 * 校验选择题选项：≥2 项、key 唯一且为 A~F、text 非空。
 * @returns {Array<{key: string, text: string}>}
 */
function validateOptions(raw) {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw badRequest('参数错误：选择题选项至少 2 项');
  }
  if (raw.length > OPTION_KEYS.length) {
    throw badRequest('参数错误：选择题选项最多 6 项');
  }
  const keys = new Set();
  return raw.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw badRequest('参数错误：选项格式必须为 {key,text}');
    }
    if (typeof item.key !== 'string' || !OPTION_KEYS.includes(item.key)) {
      throw badRequest('参数错误：选项 key 必须为 A~F 的单个字母');
    }
    if (keys.has(item.key)) {
      throw badRequest('参数错误：选项 key 不能重复');
    }
    keys.add(item.key);
    if (typeof item.text !== 'string' || item.text.trim() === '') {
      throw badRequest('参数错误：选项内容不能为空');
    }
    if (item.text.trim().length > 200) {
      throw badRequest('参数错误：选项内容长度不能超过 200');
    }
    return { key: item.key, text: item.text.trim() };
  });
}

/**
 * 校验标准答案形状并返回归一化结果。
 * single→"A"；multiple→["A","C"]；judge→"T"/"F"；short→参考答案文本。
 */
function validateCorrectAnswer(type, answer, options) {
  if (type === 'single') {
    if (typeof answer !== 'string' || !/^[A-F]$/.test(answer.trim())) {
      throw badRequest('参数错误：单选题答案必须为 A~F 的单个字母');
    }
    const value = answer.trim();
    if (options && !options.some((item) => item.key === value)) {
      throw badRequest('参数错误：答案必须存在于选项中');
    }
    return value;
  }
  if (type === 'multiple') {
    if (!Array.isArray(answer)) {
      throw badRequest('参数错误：多选题答案必须为 A~F 的字母数组');
    }
    if (answer.length < 2) {
      throw badRequest('参数错误：多选题答案至少包含 2 个选项');
    }
    const seen = new Set();
    const values = answer.map((item) => {
      if (typeof item !== 'string' || !/^[A-F]$/.test(item)) {
        throw badRequest('参数错误：多选题答案必须为 A~F 的字母数组');
      }
      if (seen.has(item)) throw badRequest('参数错误：多选题答案不能重复');
      seen.add(item);
      if (options && !options.some((option) => option.key === item)) {
        throw badRequest('参数错误：答案必须存在于选项中');
      }
      return item;
    });
    return values;
  }
  if (type === 'judge') {
    if (answer !== 'T' && answer !== 'F') {
      throw badRequest('参数错误：判断题答案必须为 T 或 F');
    }
    return answer;
  }
  if (type === 'short') {
    if (typeof answer !== 'string' || answer.trim() === '' || answer.trim().length > 500) {
      throw badRequest('参数错误：简答题参考答案不能为空且不超过 500 字');
    }
    return answer.trim();
  }
  throw badRequest('参数错误：题型取值必须为 single/multiple/judge/short');
}

/**
 * 校验学生作答形状（自动保存）。null 表示清空作答。
 * @returns {string|string[]|null}
 */
function validateStudentAnswer(type, answer, options) {
  if (answer === null || answer === undefined) return null;
  if (type === 'single') {
    if (typeof answer !== 'string' || !/^[A-F]$/.test(answer.trim())) {
      throw badRequest('参数错误：单选题答案必须为选项字母');
    }
    const value = answer.trim();
    if (options && !options.some((item) => item.key === value)) {
      throw badRequest('参数错误：答案必须存在于选项中');
    }
    return value;
  }
  if (type === 'multiple') {
    if (!Array.isArray(answer)) {
      throw badRequest('参数错误：多选题答案必须为选项字母数组');
    }
    const seen = new Set();
    const values = answer.map((item) => {
      if (typeof item !== 'string' || !/^[A-F]$/.test(item)) {
        throw badRequest('参数错误：多选题答案必须为选项字母数组');
      }
      if (seen.has(item)) throw badRequest('参数错误：多选题答案不能重复');
      seen.add(item);
      if (options && !options.some((option) => option.key === item)) {
        throw badRequest('参数错误：答案必须存在于选项中');
      }
      return item;
    });
    return values.length === 0 ? null : values;
  }
  if (type === 'judge') {
    if (answer !== 'T' && answer !== 'F') {
      throw badRequest('参数错误：判断题答案必须为 T 或 F');
    }
    return answer;
  }
  if (type === 'short') {
    if (typeof answer !== 'string') {
      throw badRequest('参数错误：简答题答案必须为文本');
    }
    if (answer.length > 500) {
      throw badRequest('参数错误：简答题答案不能超过 500 字');
    }
    return answer === '' ? null : answer;
  }
  throw badRequest('参数错误：题型取值必须为 single/multiple/judge/short');
}

/**
 * 判断客观题作答是否正确：
 * 单选/判断精确匹配；多选必须与标准答案集合完全一致（少选、多选、错选均 0 分）。
 */
function isAnswerCorrect(type, correctAnswer, studentAnswer) {
  if (studentAnswer === null || studentAnswer === undefined) return false;
  if (type === 'multiple') {
    if (!Array.isArray(correctAnswer) || !Array.isArray(studentAnswer)) return false;
    const correctSet = new Set(correctAnswer);
    const studentSet = new Set(studentAnswer);
    if (correctSet.size !== studentSet.size) return false;
    for (const item of correctSet) {
      if (!studentSet.has(item)) return false;
    }
    return true;
  }
  if (type === 'single' || type === 'judge') {
    return typeof studentAnswer === 'string' && studentAnswer === correctAnswer;
  }
  return false;
}

/** 客观题得分：对得满分，错得 0 分 */
function scoreObjective(type, correctAnswer, studentAnswer, fullScore) {
  return isAnswerCorrect(type, correctAnswer, studentAnswer) ? round2(fullScore) : 0;
}

/**
 * 校验并归一化题目入参（新建/修改通用）。
 * @returns {{type:string, stem:string, options:Array|null, answer:string|string[],
 *   score:number, difficulty:number, knowledgePoint:string|null, analysis:string|null}}
 */
function normalizeQuestionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('参数错误：题目格式不正确');
  }
  const type = requireEnum(
    input.type,
    QUESTION_TYPES,
    '题型',
    '参数错误：题型取值必须为 single/multiple/judge/short'
  );
  const stem = requireString(input.stem, '题干', { max: 1000 });
  const options = type === 'single' || type === 'multiple' ? validateOptions(input.options) : null;
  const answer = validateCorrectAnswer(type, input.answer, options);
  const score = requireNumber(input.score, '分值', {
    min: 0.01,
    max: 9999.99,
    decimals: 2,
    message: '参数错误：分值必须大于 0 且最多两位小数'
  });
  const difficulty = requireInt(input.difficulty, '难度', { min: 1, max: 5 });
  const knowledgePoint = optionalString(input.knowledgePoint, '知识点', { max: 100 }) ?? null;
  const analysis = optionalString(input.analysis, '解析', { max: 1000 }) ?? null;
  return { type, stem, options, answer, score, difficulty, knowledgePoint, analysis };
}

module.exports = {
  QUESTION_TYPES,
  OPTION_KEYS,
  OBJECTIVE_TYPES,
  round2,
  isObjective,
  isMultipleAnswer,
  validateOptions,
  validateCorrectAnswer,
  validateStudentAnswer,
  isAnswerCorrect,
  scoreObjective,
  normalizeQuestionInput
};
