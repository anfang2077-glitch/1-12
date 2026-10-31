import { formatAnswer } from '../utils/format';

// 答题结果/阅卷中的选项展示：标出正确答案与学生作答
export default function AnswerOptions({ type, options, correctAnswer, studentAnswer }) {
  if (type === 'judge') {
    const correct = correctAnswer === 'T' || correctAnswer === true ? 'T' : 'F';
    const mine = studentAnswer === 'T' || studentAnswer === true ? 'T' : studentAnswer === 'F' || studentAnswer === false ? 'F' : null;
    return (
      <div className="answer-options answer-options-judge">
        {['T', 'F'].map((key) => {
          const label = key === 'T' ? '正确' : '错误';
          const isCorrect = correct === key;
          const isMine = mine === key;
          return (
            <div key={key} className={`answer-option ${isCorrect ? 'is-correct' : ''} ${isMine ? 'is-mine' : ''}`}>
              <span className="answer-option-key">{key}</span>
              <span className="answer-option-text">{label}</span>
              <span className="answer-option-marks">
                {isMine && <span className="mark mark-mine">我的作答</span>}
                {isCorrect && <span className="mark mark-correct">正确答案</span>}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (!Array.isArray(options) || options.length === 0) {
    return (
      <div className="answer-plain">
        <span className="muted">我的作答：</span>
        <span>{formatAnswer(studentAnswer, type)}</span>
      </div>
    );
  }

  const correctSet = new Set(Array.isArray(correctAnswer) ? correctAnswer : correctAnswer ? [correctAnswer] : []);
  const mineSet = new Set(Array.isArray(studentAnswer) ? studentAnswer : studentAnswer ? [studentAnswer] : []);

  return (
    <ul className="answer-options">
      {options.map((option) => {
        const isCorrect = correctSet.has(option.key);
        const isMine = mineSet.has(option.key);
        return (
          <li
            key={option.key}
            className={`answer-option ${isCorrect ? 'is-correct' : ''} ${isMine ? 'is-mine' : ''}`.trim()}
          >
            <span className="answer-option-key">{option.key}</span>
            <span className="answer-option-text">{option.text}</span>
            <span className="answer-option-marks">
              {isMine && <span className="mark mark-mine">我的作答</span>}
              {isCorrect && <span className="mark mark-correct">正确答案</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
