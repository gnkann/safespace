/** Типи відповідей API. Мають збігатися з DTO бекенду (backend/src/modules/*). */
export type Role = 'CLIENT' | 'PSYCHOLOGIST' | 'ADMIN';
export type SessionStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface PsychologistCard {
  id: string;
  fullName: string;
  specializations: string[];
  methods: string[];
  languages: string[];
  experienceYears: number;
  pricePerSession: number;
  sessionDurationMin: number;
}

export interface Slot { id: string; startsAt: string; endsAt: string; status: 'OPEN' | 'BOOKED' | 'CLOSED' }

export interface Session {
  id: string;
  psychologistId: string;
  clientId: string;
  startsAt: string;
  status: SessionStatus;
  paymentDeadline: string;
  cancelReason?: string;
}

export interface Note { id: string; content: string; createdAt: string }
