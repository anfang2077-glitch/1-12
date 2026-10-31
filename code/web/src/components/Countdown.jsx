import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../utils/format';

// 倒计时：以服务端下发的剩余秒数换算出的时间戳为准，最后 5 分钟变红并提示
export default function Countdown({ deadline, onExpire, warnSeconds = 300, label = '剩余时间' }) {
  const calcRemaining = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(calcRemaining);
  const expiredRef = useRef(false);
  const callbackRef = useRef(onExpire);

  useEffect(() => {
    callbackRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiredRef.current = false;
    const tick = () => {
      const value = calcRemaining();
      setRemaining(value);
      if (value <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        callbackRef.current?.();
      }
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  const warning = remaining > 0 && remaining <= warnSeconds;

  return (
    <div className={`countdown ${warning ? 'countdown-warn' : ''} ${remaining <= 0 ? 'countdown-over' : ''}`}>
      <span className="countdown-label">{label}</span>
      <span className="countdown-value">{formatClock(remaining)}</span>
    </div>
  );
}
