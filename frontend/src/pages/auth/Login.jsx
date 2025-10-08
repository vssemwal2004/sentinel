import { useState, useEffect } from 'react';
import { useAuth } from '../../store/authStore';
import { useNavigate, Link, useLocation } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialMode = params.get('mode') === 'conductor' ? 'conductor' : 'user';
  const [mode,setMode] = useState(initialMode);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');

  async function submit(e){
    e.preventDefault();
    try { 
      const u = await login(email,password);
      if(u.role === 'admin') return navigate('/admin');
      if(u.role === 'conductor') return navigate('/conductor');
      // user role
      if(mode === 'conductor') {
        // If a user mistakenly logs in on conductor tab, still send to user dashboard
        return navigate('/user');
      }
      navigate('/user');
    } catch (e) { setError(e.message); }
  }

  useEffect(()=>{
    // Sync mode from URL if changed externally
    const m = new URLSearchParams(window.location.search).get('mode');
    if(m && (m === 'user' || m === 'conductor') && m !== mode) setMode(m);
  },[location.search]);

  return <div className="p-6 max-w-md mx-auto space-y-4">
    <div className="flex gap-2 mb-2">
      <button onClick={()=>{ setMode('user'); navigate('/login?mode=user'); }} className={`flex-1 border px-3 py-2 rounded ${mode==='user'?'bg-blue-600 text-white':'bg-white'}`}>User Login</button>
      <button onClick={()=>{ setMode('conductor'); navigate('/login?mode=conductor'); }} className={`flex-1 border px-3 py-2 rounded ${mode==='conductor'?'bg-blue-600 text-white':'bg-white'}`}>Conductor / Admin</button>
    </div>
    <h1 className="text-xl font-bold">{mode==='user' ? 'User Login' : 'Conductor / Admin Login'}</h1>
    {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
    <form onSubmit={submit} className="space-y-3">
      <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="border p-2 w-full" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Login</button>
    </form>
    {mode==='user' && <p className="text-sm text-center">No account? <Link to="/register" className="text-blue-600 underline">Register</Link></p>}
    {mode==='conductor' && <p className="text-xs text-gray-600">Admin also logs in here and will be redirected automatically.</p>}
  </div>;
}
