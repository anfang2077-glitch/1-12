import { formatScore } from '../utils/format';

// 纯 CSS 柱状条：用于分数段分布、正确率等图表
export default function ScoreBar({ label, value = 0, max = 100, text, tone, showValue = true }) {
  const numericValue = Number(value) || 0;
  const numericMax = Number(max) > 0 ? Number(max) : 1;
  const percent = Math.max(0, Math.min(100, (numericValue / numericMax) * 100));

  return (
    <div className="score-bar">
      {(label || showValue) && (
        <div className="score-bar-head">
          {label && <span className="score-bar-label">{label}</span>}
          {showValue && <span className="score-bar-text">{text ?? formatScore(numericValue)}</span>}
        </div>
      )}
      <div className="score-bar-track">
        <div className={`score-bar-fill ${tone ? `is-${tone}` : ''}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
