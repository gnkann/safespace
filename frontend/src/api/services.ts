import { api } from './http';
import type { Note, PsychologistCard, Role, Session, Slot } from './types';

/** Клієнтські обгортки над REST API. Окремий шар від компонентів → компоненти не знають URL (SRP). */
export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: { id: string; role: Role } }>('/auth/login', { method: 'POST', json: { email, password } }),
  registerClient: (dto: Record<string, unknown>) => api<{ id: string }>('/auth/register/client', { method: 'POST', json: dto }),
  confirmEmail: (token: string) => api<void>('/auth/confirm-email', { method: 'POST', json: { token } }),
};

export const catalogApi = {
  search: (params: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return api<PsychologistCard[]>(`/psychologists${qs ? `?${qs}` : ''}`);
  },
  slots: (psychologistId: string) => api<Slot[]>(`/psychologists/${psychologistId}/slots`),
};

export const sessionApi = {
  mine: () => api<Session[]>('/sessions/my'),
  book: (slotId: string) => api<{ session: Session; payment: { clientSecret: string } }>('/sessions', { method: 'POST', json: { slotId } }),
  cancel: (id: string, reason: string) => api<Session>(`/sessions/${id}/cancel`, { method: 'POST', json: { reason } }),
};

export const notesApi = {
  list: () => api<Note[]>('/notes'),
  add: (content: string) => api<Note>('/notes', { method: 'POST', json: { content } }),
  remove: (id: string) => api<void>(`/notes/${id}`, { method: 'DELETE' }),
};
