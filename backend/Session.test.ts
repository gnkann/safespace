import { Role, SessionStatus } from '../src/shared/domain/enums';
import { InvalidStateTransitionError, ValidationError } from '../src/shared/errors';
import { Session } from '../src/modules/booking/domain/Session';

const T0 = new Date('2026-03-01T10:00:00Z');
const make = () =>
  new Session({
    id: 's1', clientId: 'c1', psychologistId: 'p1', slotId: 'sl1',
    startsAt: new Date('2026-03-03T10:00:00Z'), createdAt: T0, paymentDeadline: new Date(T0.getTime() + 15 * 60_000),
  });

describe('Session — діаграма станів (лаб. 2, рис. 4)', () => {
  it('створюється у стані PENDING', () => {
    expect(make().status).toBe(SessionStatus.PENDING);
  });

  it('PENDING → CONFIRMED після оплати', () => {
    const s = make();
    s.confirm();
    expect(s.status).toBe(SessionStatus.CONFIRMED);
  });

  it('CONFIRMED → COMPLETED лише після початку сесії', () => {
    const s = make();
    s.confirm();
    expect(() => s.complete(new Date('2026-03-02T00:00:00Z'))).toThrow(ValidationError);
    s.complete(new Date('2026-03-03T11:00:00Z'));
    expect(s.status).toBe(SessionStatus.COMPLETED);
  });

  it('PENDING → EXPIRED лише після дедлайну оплати', () => {
    const s = make();
    expect(() => s.expire(new Date(T0.getTime() + 5 * 60_000))).toThrow(ValidationError);
    s.expire(new Date(T0.getTime() + 15 * 60_000));
    expect(s.status).toBe(SessionStatus.EXPIRED);
  });

  it('скасування потребує причини (FR-08) і запам\'ятовує ініціатора', () => {
    const s = make();
    expect(() => s.cancel(Role.CLIENT, '   ')).toThrow(ValidationError);
    s.cancel(Role.CLIENT, 'Захворів');
    expect(s.status).toBe(SessionStatus.CANCELLED);
    expect(s.cancelledBy).toBe(Role.CLIENT);
    expect(s.cancelReason).toBe('Захворів');
  });

  it('адміністратор не може скасувати сесію', () => {
    expect(() => make().cancel(Role.ADMIN, 'x')).toThrow(ValidationError);
  });

  it('CONFIRMED → CANCELLED дозволено', () => {
    const s = make();
    s.confirm();
    s.cancel(Role.PSYCHOLOGIST, 'Форс-мажор');
    expect(s.status).toBe(SessionStatus.CANCELLED);
  });

  it.each([
    ['оплата скасованої сесії', (s: Session) => { s.cancel(Role.CLIENT, 'x'); s.confirm(); }],
    ['оплата простроченої сесії', (s: Session) => { s.expire(new Date(T0.getTime() + 20 * 60_000)); s.confirm(); }],
    ['завершення неоплаченої сесії', (s: Session) => s.complete(new Date('2026-03-04T00:00:00Z'))],
    ['повторне підтвердження', (s: Session) => { s.confirm(); s.confirm(); }],
  ])('недопустимий перехід: %s', (_name, act) => {
    expect(() => act(make())).toThrow(InvalidStateTransitionError);
  });

  it('кінцеві стани не мають вихідних переходів', () => {
    const s = make();
    s.cancel(Role.CLIENT, 'x');
    for (const next of Object.values(SessionStatus)) expect(s.canTransitionTo(next)).toBe(false);
  });
});
