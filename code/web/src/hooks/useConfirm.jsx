import { useCallback, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

// 二次确认对话框状态管理：ask({ title, message, danger, onConfirm })
export default function useConfirm() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = useCallback((options) => {
    setState(options);
  }, []);

  const close = useCallback(() => {
    if (!loading) setState(null);
  }, [loading]);

  const run = useCallback(async () => {
    if (!state || loading) return;
    setLoading(true);
    try {
      await state.onConfirm?.();
      setState(null);
    } catch (error) {
      // 统一错误提示由 axios 拦截器负责，保留对话框便于重试
    } finally {
      setLoading(false);
    }
  }, [state, loading]);

  const confirmNode = (
    <ConfirmDialog
      open={Boolean(state)}
      title={state?.title || '确认操作'}
      message={state?.message}
      confirmText={state?.confirmText || '确认'}
      cancelText={state?.cancelText || '取消'}
      danger={Boolean(state?.danger)}
      loading={loading}
      onConfirm={run}
      onCancel={close}
    />
  );

  return { ask, close, confirmNode, loading };
}
