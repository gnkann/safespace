import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/http';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося увійти');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto mt-8 max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Вхід</h1>
      <label className="block">Email
        <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="block">Пароль
        <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      <button className="btn-primary w-full" type="submit">Увійти</button>
    </form>
  );
}
