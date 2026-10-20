import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const cabinetPath = { CLIENT: '/cabinet', PSYCHOLOGIST: '/psychologist', ADMIN: '/admin' } as const;

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-2 py-4">
        <Link to="/" className="text-xl font-bold text-brand-700">SafeSpace</Link>
        <nav aria-label="Основна навігація" className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" to="/catalog">Психологи</Link>
          {user ? (
            <>
              <Link className="btn-secondary" to={cabinetPath[user.role]}>Кабінет</Link>
              <button className="btn-secondary" onClick={logout}>Вийти</button>
            </>
          ) : (
            <>
              <Link className="btn-secondary" to="/login">Увійти</Link>
              <Link className="btn-primary" to="/register">Реєстрація</Link>
            </>
          )}
        </nav>
      </header>
      <main className="flex-1 pb-8"><Outlet /></main>
      <footer className="border-t py-4 text-sm text-slate-700">
        SafeSpace — анонімна та доступна психологічна підтримка. У разі кризи звертайтесь до служб екстреної допомоги.
      </footer>
    </div>
  );
}
