import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, isValidPin, makeSalt, PIN_LENGTH } from '../../js/auth/pin.js';
import { createSessionStore } from '../../js/auth/session.js';

// В тестах итераций мало: проверяется правильность, а не стойкость.
// Настоящее значение (200 000) стоит секунды и сделало бы тесты медленными.
const БЫСТРО = { iterations: 1000 };

test('PIN — ровно четыре цифры', () => {
  assert.equal(PIN_LENGTH, 4);
  for (const годный of ['0000', '1234', '9999']) assert.ok(isValidPin(годный), годный);
  for (const негодный of ['123', '12345', 'abcd', '12 4', '', null, undefined, '12٣4']) {
    assert.equal(isValidPin(негодный), false, String(негодный));
  }
});

test('одинаковый PIN и соль дают одинаковый хеш', async () => {
  const a = await hashPin('1234', 'соль', БЫСТРО);
  const b = await hashPin('1234', 'соль', БЫСТРО);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('разные PIN дают разные хеши', async () => {
  const a = await hashPin('1234', 'соль', БЫСТРО);
  const b = await hashPin('1235', 'соль', БЫСТРО);
  assert.notEqual(a, b);
});

// Ради этого соль и нужна: подобранный PIN одного ученика не должен
// открывать всех остальных с таким же PIN.
test('одинаковый PIN с разной солью даёт разные хеши', async () => {
  const a = await hashPin('1234', 'соль-иванова', БЫСТРО);
  const b = await hashPin('1234', 'соль-петрова', БЫСТРО);
  assert.notEqual(a, b);
});

test('негодный PIN до подсчёта не доходит', async () => {
  await assert.rejects(() => hashPin('12', 'соль', БЫСТРО), /PIN должен состоять из 4 цифр/);
  await assert.rejects(() => hashPin('abcd', 'соль', БЫСТРО), /PIN должен состоять из 4 цифр/);
});

test('пустая соль отвергается', async () => {
  await assert.rejects(() => hashPin('1234', '', БЫСТРО), /Не задана соль/);
});

test('соль случайная и нужной длины', () => {
  const a = makeSalt();
  const b = makeSalt();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

// ── Сессия ───────────────────────────────────────────────────

function поддельноеХранилище(начальное = {}) {
  const данные = { ...начальное };
  return {
    getItem: (k) => (k in данные ? данные[k] : null),
    setItem: (k, v) => { данные[k] = String(v); },
    removeItem: (k) => { delete данные[k]; },
    данные,
  };
}

test('сессия сохраняется и читается', () => {
  const storage = поддельноеХранилище();
  const store = createSessionStore({ storage, now: () => 1000 });
  store.save({ idToken: 'т', refreshToken: 'о', uid: 'u', expiresAt: 5000 });
  assert.deepEqual(store.load(), { idToken: 'т', refreshToken: 'о', uid: 'u', expiresAt: 5000 });
});

test('пустое хранилище даёт null, а не падение', () => {
  const store = createSessionStore({ storage: поддельноеХранилище() });
  assert.equal(store.load(), null);
});

test('испорченная запись не роняет вход', () => {
  const storage = поддельноеХранилище({ 'bioschool.session': '{это не json' });
  assert.equal(createSessionStore({ storage }).load(), null);
});

test('fromAuth переводит срок жизни в момент истечения', () => {
  const store = createSessionStore({ storage: поддельноеХранилище(), now: () => 10_000 });
  const s = store.fromAuth({ idToken: 'т', refreshToken: 'о', uid: 'u', expiresInSec: 3600 }, { studentId: 'ivanov' });
  assert.equal(s.expiresAt, 10_000 + 3_600_000);
  assert.equal(s.studentId, 'ivanov');
});

test('живая сессия не считается истёкшей', () => {
  const store = createSessionStore({ storage: поддельноеХранилище(), now: () => 0 });
  assert.equal(store.isExpired({ expiresAt: 3_600_000 }), false);
});

// Токен обновляется заранее: иначе он успеет протухнуть, пока запрос летит.
test('сессия считается истёкшей за минуту до конца', () => {
  const store = createSessionStore({ storage: поддельноеХранилище(), now: () => 0 });
  assert.equal(store.isExpired({ expiresAt: 59_000 }), true);
  assert.equal(store.isExpired({ expiresAt: 61_000 }), false);
});

test('сессия без срока считается истёкшей', () => {
  const store = createSessionStore({ storage: поддельноеХранилище() });
  assert.equal(store.isExpired(null), true);
  assert.equal(store.isExpired({}), true);
});

test('живой токен отдаётся без обращения к сети', async () => {
  let обращений = 0;
  const storage = поддельноеХранилище();
  const store = createSessionStore({
    storage,
    now: () => 0,
    refresh: async () => { обращений += 1; return {}; },
  });
  store.save({ idToken: 'живой', refreshToken: 'о', uid: 'u', expiresAt: 3_600_000 });
  assert.equal(await store.getValidToken(), 'живой');
  assert.equal(обращений, 0);
});

test('протухший токен продлевается и сохраняется', async () => {
  const storage = поддельноеХранилище();
  const store = createSessionStore({
    storage,
    now: () => 0,
    refresh: async () => ({ idToken: 'новый', refreshToken: 'новое', uid: 'u', expiresInSec: 3600 }),
  });
  store.save({ idToken: 'старый', refreshToken: 'о', uid: 'u', expiresAt: 1, studentId: 'ivanov' });

  assert.equal(await store.getValidToken(), 'новый');
  const сохранено = store.load();
  assert.equal(сохранено.idToken, 'новый');
  assert.equal(сохранено.expiresAt, 3_600_000);
  assert.equal(сохранено.studentId, 'ivanov', 'кто вошёл — не должно теряться при продлении');
});

test('неудачное продление стирает сессию', async () => {
  const storage = поддельноеХранилище();
  const store = createSessionStore({
    storage,
    now: () => 0,
    refresh: async () => { throw new Error('Сессия больше не действует'); },
  });
  store.save({ idToken: 'старый', refreshToken: 'о', uid: 'u', expiresAt: 1 });

  assert.equal(await store.getValidToken(), null);
  assert.equal(store.load(), null, 'мёртвая сессия не должна оставаться в браузере');
});

test('без сессии токена нет', async () => {
  const store = createSessionStore({ storage: поддельноеХранилище() });
  assert.equal(await store.getValidToken(), null);
});
