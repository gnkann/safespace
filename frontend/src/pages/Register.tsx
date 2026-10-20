import { FormEvent, useState } from 'react';
import { ApiError } from '../api/http';
import { authApi } from '../api/services';

/** FR-01.1: реєстрація клієнта (псевдонім, email, пароль, 18+, згода). */
export default function Register() {
  const [form, setForm] = useState({ pseudonym: '', email: '', password: '', passwordConfirm: '', isAdultConfirmed: false, consentAccepted: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    try {
      await authApi.registerClient(form);
      setDone(true);
    } catch (err) {
      setErrors(err instanceof ApiError ? err.details ?? { form: err.message } : { form: 'Помилка' });
    }
  }

  if (done) return <p className="card mt-8" role="status">Перевірте пошту та підтвердіть email, щоб активувати обліковий запис.</p>;

  const field = (name: 'pseudonym' | 'email' | 'password' | 'passwordConfirm', label: string, type = 'text') => (
    <label className="block">{label}
      <input className="input mt-1" type={type} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      {errors[name] && <span role="alert" className="text-red-800">{errors[name]}</span>}
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="card mx-auto mt-8 max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Реєстрація клієнта</h1>
      {field('pseudonym', 'Псевдонім (відображається замість імені)')}
      {field('email', 'Email', 'email')}
      {field('password', 'Пароль', 'password')}
      {field('passwordConfirm', 'Повторіть пароль', 'password')}
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={form.isAdultConfirmed} onChange={(e) => setForm({ ...form, isAdultConfirmed: e.target.checked })} />Мені 18 років або більше</label>
      {errors.isAdultConfirmed && <span role="alert" className="text-red-800">{errors.isAdultConfirmed}</span>}
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={form.consentAccepted} onChange={(e) => setForm({ ...form, consentAccepted: e.target.checked })} />Погоджуюсь з умовами використання та політикою конфіденційності</label>
      {errors.consentAccepted && <span role="alert" className="text-red-800">{errors.consentAccepted}</span>}
      {errors.form && <p role="alert" className="text-red-800">{errors.form}</p>}
      <button className="btn-primary w-full" type="submit">Зареєструватись</button>
    </form>
  );
}
