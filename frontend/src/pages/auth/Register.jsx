import { useState } from 'react';
import { useAuth } from '../../store/authStore';

export default function Register() {
  const { register } = useAuth();
  const [form,setForm] = useState({ name:'', email:'', phone:'', password:'' });
  const [error,setError] = useState('');

  function update(e){ setForm(f=>({...f,[e.target.name]: e.target.value })); }

  async function submit(e){
    e.preventDefault();
    try { await register(form); } catch (e) { setError(e.message); }
  }

  return <div className="p-6 max-w-md mx-auto">
    <h1 className="text-xl font-bold mb-4">Register</h1>
    {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
    <form onSubmit={submit} className="space-y-3">
      <input className="border p-2 w-full" name="name" placeholder="Name" value={form.name} onChange={update} />
      <input className="border p-2 w-full" name="email" placeholder="Email" value={form.email} onChange={update} />
      <input className="border p-2 w-full" name="phone" placeholder="Phone" value={form.phone} onChange={update} />
      <input className="border p-2 w-full" name="password" type="password" placeholder="Password" value={form.password} onChange={update} />
      <button className="bg-green-600 text-white px-4 py-2 rounded w-full">Create Account</button>
    </form>
  </div>;
}
