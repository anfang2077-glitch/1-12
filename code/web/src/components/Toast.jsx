import { useEffect, useState } from 'react';
import { subscribeToast } from '../utils/toast';

const ICONS = { success: '✓', error: '!', info: 'i' };

// 轻量 Toast 容器：订阅 utils/toast 事件总线，自动消失
export default function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToast((item) => {
      setItems((prev) => [...prev.slice(-4), item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }, item.duration || 3000);
    });
    return unsubscribe;
  }, []);

  return (
    <>
      {children}
      <div className="toast-container" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.type}`} role="status">
            <span className="toast-icon">{ICONS[item.type] || 'i'}</span>
            <span className="toast-message">{item.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
