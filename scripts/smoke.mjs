// Інтеграційна перевірка запущеної системи (Node.js ≥ 20, без залежностей).
// Використання: node scripts/smoke.mjs [BASE_URL]   (за замовчуванням http://localhost:4000)
// Через frontend-проксі: node scripts/smoke.mjs http://localhost:8080
const base = (process.argv[2] ?? 'http://localhost:4000').replace(/\/$/, '');
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@safespace.local';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMe123';
let failed = 0;

async function check(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m ?? ''} очікувалось ${b}, отримано ${a}`); };
const api = (path, init = {}) => fetch(`${base}/api${path}`, {
  ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
});

console.log(`SafeSpace smoke-тест → ${base}`);
let adminToken;

await check('GET /health → 200 {status:ok}', async () => {
  const r = await api('/health'); eq(r.status, 200); eq((await r.json()).status, 'ok');
});
await check('NFR-03: захищений маршрут без токена → 401', async () => {
  const r = await api('/sessions/my'); eq(r.status, 401); eq((await r.json()).error.code, 'UNAUTHORIZED');
});
await check('FR-01: вхід адміністратора → JWT', async () => {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
  eq(r.status, 200); adminToken = (await r.json()).token; if (!adminToken) throw new Error('немає token');
});
await check('NFR-08: адмін бачить журнал аудиту', async () => {
  const r = await api('/admin/audit', { headers: { Authorization: `Bearer ${adminToken}` } }); eq(r.status, 200);
});
await check('FR-01.1: реєстрація клієнта → 201', async () => {
  const email = `smoke-${Date.now()}@example.com`;
  const r = await api('/auth/register/client', { method: 'POST', body: JSON.stringify({
    pseudonym: 'Smoke', email, password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', isAdultConfirmed: true, consentAccepted: true }) });
  eq(r.status, 201);
});
await check('FR-02: каталог психологів → масив', async () => {
  const r = await api('/psychologists'); eq(r.status, 200); if (!Array.isArray(await r.json())) throw new Error('не масив');
});
await check('RBAC: клієнтський маршрут для адміна → 403', async () => {
  const r = await api('/sessions', { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ slotId: 'x' }) });
  eq(r.status, 403);
});

console.log(failed ? `\nПровалено перевірок: ${failed}` : '\nУсі перевірки пройдено');
process.exit(failed ? 1 : 0);
