import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <section className="py-10">
      <h1 className="text-3xl font-bold">Психологічна підтримка — анонімно, зручно, доступно</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-800">
        Знайдіть перевіреного спеціаліста, оберіть зручний час і запишіться на консультацію без дзвінків.
        Ви можете користуватись платформою під псевдонімом.
      </p>
      <Link to="/catalog" className="btn-primary mt-6">Знайти психолога</Link>
    </section>
  );
}
