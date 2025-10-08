import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ api.me().then(d=>setUser(d.user)).catch(()=>{}).finally(()=>setLoading(false)); },[]);

  const login = useCallback(async (email, password) => {
    const d = await api.login({ email, password });
    setUser(d.user);
    return d.user;
  },[]);

  const register = useCallback(async (payload) => {
    const d = await api.register(payload);
    setUser(d.user);
    return d.user;
  },[]);

  return { user, loading, login, register };
}
