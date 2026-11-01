import { loadConfig } from '../src/config/env';
import { Container, createContainer } from '../src/container';
import { Role } from '../src/shared/domain/enums';
import { FakeClock } from '../src/shared/time/Clock';
import { RecordingEmailSender } from '../src/modules/notification/infrastructure/ConsoleEmailSender';
import { PsychologistProfile } from '../src/modules/auth/domain/Psychologist';

export interface TestEnv {
  c: Container;
  clock: FakeClock;
  email: RecordingEmailSender;
}

export function createTestEnv(): TestEnv {
  const clock = new FakeClock(new Date('2026-03-01T10:00:00Z'));
  const email = new RecordingEmailSender();
  const config = loadConfig({ NODE_ENV: 'test', BCRYPT_ROUNDS: '4', ADMIN_EMAIL: 'admin@test.local', ADMIN_PASSWORD: 'Admin12345' });
  const c = createContainer(config, { clock, emailSender: email });
  return { c, clock, email };
}

export const profile = (over: Partial<PsychologistProfile> = {}): PsychologistProfile => ({
  fullName: 'Іваненко Марія Петрівна',
  phone: '+380501112233',
  education: [{ institution: 'КНУ імені Тараса Шевченка', specialty: 'Психологія', graduationYear: 2015 }],
  diplomaFileKeys: ['diplomas/1.pdf'],
  certificateFileKeys: [],
  experienceYears: 8,
  specializations: ['тривога', 'стрес'],
  methods: ['КПТ'],
  languages: ['uk'],
  pricePerSession: 800,
  sessionDurationMin: 50,
  ...over,
});

export const clientDto = (over: Record<string, unknown> = {}) => ({
  pseudonym: 'Сова',
  email: 'owl@example.com',
  password: 'Passw0rdX',
  passwordConfirm: 'Passw0rdX',
  isAdultConfirmed: true,
  consentAccepted: true,
  ...over,
});

/** Реєструє й активує клієнта через публічний API сервісів. */
export async function activeClient(env: TestEnv, over: Record<string, unknown> = {}) {
  const client = await env.c.auth.registerClient(clientDto(over) as never);
  await env.c.auth.confirmEmail(env.c.tokens.signEmailConfirmationToken(client.id));
  return client;
}

/** Реєструє психолога, активує email і (за потреби) верифікує його адміном. */
export async function psychologist(env: TestEnv, opts: { email?: string; verified?: boolean; profile?: Partial<PsychologistProfile> } = {}) {
  const p = await env.c.auth.registerPsychologist({
    email: opts.email ?? 'psy@example.com',
    password: 'Passw0rdX',
    passwordConfirm: 'Passw0rdX',
    consentAccepted: true,
    profile: profile(opts.profile),
  });
  await env.c.auth.confirmEmail(env.c.tokens.signEmailConfirmationToken(p.id));
  if (opts.verified !== false) await env.c.admin.verifyPsychologist('admin-id', p.id);
  return p;
}

export const actor = (userId: string, role: Role) => ({ userId, role });

/** Слот через `hours` годин від поточного моменту тестового годинника. */
export async function openSlot(env: TestEnv, psychologistId: string, hours = 48) {
  const start = new Date(env.clock.now().getTime() + hours * 3_600_000);
  return env.c.schedule.createSlot(psychologistId, start, new Date(start.getTime() + 50 * 60_000));
}
