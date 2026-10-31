'use strict';

function clone(value) {
  return value ? { ...value } : null;
}

/** 内存答题明细仓储 */
function createAnswersRepository(store) {
  const rows = store.tables.answers;

  return {
    async findByAttemptAndQuestion(attemptId, questionId) {
      return clone(
        rows.find((item) => item.attemptId === attemptId && item.questionId === questionId)
      );
    },

    async listByAttempt(attemptId) {
      return rows
        .filter((item) => item.attemptId === attemptId)
        .sort((a, b) => a.id - b.id)
        .map(clone);
    },

    async upsert(data) {
      let answer = rows.find(
        (item) => item.attemptId === data.attemptId && item.questionId === data.questionId
      );
      if (!answer) {
        answer = {
          id: store.nextId('answers'),
          attemptId: data.attemptId,
          questionId: data.questionId,
          answer: null,
          score: 0,
          comment: null,
          gradedBy: null,
          gradedAt: null
        };
        rows.push(answer);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'answer')) answer.answer = data.answer;
      if (Object.prototype.hasOwnProperty.call(data, 'score')) answer.score = data.score;
      if (Object.prototype.hasOwnProperty.call(data, 'comment')) answer.comment = data.comment;
      if (Object.prototype.hasOwnProperty.call(data, 'gradedBy')) answer.gradedBy = data.gradedBy;
      if (Object.prototype.hasOwnProperty.call(data, 'gradedAt')) answer.gradedAt = data.gradedAt;
      return clone(answer);
    },

    async ensureRows(attemptId, questionIds) {
      questionIds.forEach((questionId) => {
        const exists = rows.some(
          (item) => item.attemptId === attemptId && item.questionId === questionId
        );
        if (!exists) {
          rows.push({
            id: store.nextId('answers'),
            attemptId,
            questionId,
            answer: null,
            score: 0,
            comment: null,
            gradedBy: null,
            gradedAt: null
          });
        }
      });
    },

    async updateScore(attemptId, questionId, score) {
      const answer = rows.find(
        (item) => item.attemptId === attemptId && item.questionId === questionId
      );
      if (!answer) return null;
      answer.score = score;
      return clone(answer);
    },

    async updateGrading(attemptId, questionId, patch) {
      const answer = rows.find(
        (item) => item.attemptId === attemptId && item.questionId === questionId
      );
      if (!answer) return null;
      if (Object.prototype.hasOwnProperty.call(patch, 'score')) answer.score = patch.score;
      if (Object.prototype.hasOwnProperty.call(patch, 'comment')) answer.comment = patch.comment;
      if (Object.prototype.hasOwnProperty.call(patch, 'gradedBy')) answer.gradedBy = patch.gradedBy;
      if (Object.prototype.hasOwnProperty.call(patch, 'gradedAt')) answer.gradedAt = patch.gradedAt;
      return clone(answer);
    }
  };
}

module.exports = { createAnswersRepository };
