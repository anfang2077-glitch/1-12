import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMe, login as loginApi } from '../api/auth';
import { clearToken, getToken, setToken } from '../api/authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // booting：应用启动时校验本地令牌、恢复会话的加载态
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let alive = true;
    const token = getToken();
    if (!token) {
      setBooting(false);
      return () => {
        alive = false;
      };
    }
    getMe({ skipErrorToast: true, skipAuthRedirect: true })
      .then((profile) => {
        if (alive) setUser(profile);
      })
      .catch(() => {
        clearToken();
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setBooting(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    // 登录失败由登录页内联展示，跳过全局 toast 与 401 跳转
    const data = await loginApi(
      { username, password },
      { skipErrorToast: true, skipAuthRedirect: true }
    );
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (roles) => {
      if (!user) return false;
      const list = Array.isArray(roles) ? roles : [roles];
      return list.includes(user.role);
    },
    [user]
  );

  const value = { user, booting, login, logout, hasRole };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
