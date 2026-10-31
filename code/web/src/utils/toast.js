// 轻量 Toast 事件总线：不依赖 React 上下文，供 axios 拦截器等非组件代码调用
let listeners = new Set();
let seed = 0;

function emit(type, message, duration) {
  if (!message) return;
  const item = { id: ++seed, type, message, duration };
  listeners.forEach((listener) => {
    try {
      listener(item);
    } catch (e) {
      // 单个订阅者异常不影响其他订阅者
    }
  });
}

export function subscribeToast(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const toast = {
  success(message, duration = 2600) {
    emit('success', message, duration);
  },
  error(message, duration = 4200) {
    emit('error', message, duration);
  },
  info(message, duration = 3200) {
    emit('info', message, duration);
  }
};
