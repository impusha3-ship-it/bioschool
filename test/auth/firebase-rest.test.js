import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signInAnonymously,
  signInWithPassword,
  refreshSession,
  dbGet,
  dbPut,
} from '../../js/api/firebase-rest.js';

const config = {
  apiKey: 'КЛЮЧ',
  databaseURL: 'https://пример.firebasedatabase.app',
};

function поддельныйFetch(ответ, { ok = true, status = 200 } = {}) {
  const вызовы = [];
  const fn = async (url, init) => {
    вызовы.push({ url, init });
    return { ok, status, json: async () => ответ };
  };
  fn.вызовы = вызовы;
  return fn;
}

test('анонимный вход возвращает токены и uid', async () => {
  const fetchFn = поддельныйFetch({
    idToken: 'ид', refreshToken: 'обновление', localId: 'uid1', expiresIn: '3600',
  });
  const s = await signInAnonymously({ fetchFn, config });
  assert.deepEqual(s, {
    idToken: 'ид', refreshToken: 'обновление', uid: 'uid1', email: null, expiresInSec: 3600,
  });
  assert.ok(fetchFn.вызовы[0].url.includes('accounts:signUp?key=КЛЮЧ'));
});

test('вход по паролю отправляет почту и пароль', async () => {
  const fetchFn = поддельныйFetch({
    idToken: 'ид', refreshToken: 'обн', localId: 'uid2', email: 'a@b.c', expiresIn: '3600',
  });
  const s = await signInWithPassword('a@b.c', 'тайна', { fetchFn, config });
  assert.equal(s.email, 'a@b.c');
  assert.deepEqual(JSON.parse(fetchFn.вызовы[0].init.body), {
    email: 'a@b.c', password: 'тайна', returnSecureToken: true,
  });
});

test('неверный пароль переводится на человеческий язык', async () => {
  const fetchFn = поддельныйFetch({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, { ok: false, status: 400 });
  await assert.rejects(
    () => signInWithPassword('a@b.c', 'мимо', { fetchFn, config }),
    /Неверная почта или пароль/,
  );
});

test('незнакомый код ошибки всё равно показывается понятно', async () => {
  const fetchFn = поддельныйFetch({ error: { message: 'НЕВЕДОМАЯ_БЕДА' } }, { ok: false, status: 400 });
  await assert.rejects(() => signInAnonymously({ fetchFn, config }), /Ошибка входа: НЕВЕДОМАЯ_БЕДА/);
});

test('обрыв связи не показывает техническую ошибку', async () => {
  const fetchFn = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => signInAnonymously({ fetchFn, config }), /Нет связи с сервером/);
});

test('обновление сессии переводит поля из snake_case', async () => {
  const fetchFn = поддельныйFetch({
    id_token: 'новый', refresh_token: 'новое-обновление', user_id: 'uid3', expires_in: '3600',
  });
  const s = await refreshSession('старое', { fetchFn, config });
  assert.deepEqual(s, {
    idToken: 'новый', refreshToken: 'новое-обновление', uid: 'uid3', expiresInSec: 3600,
  });
});

test('чтение базы собирает адрес с токеном', async () => {
  const fetchFn = поддельныйFetch({ имя: 'Иванов' });
  const данные = await dbGet('schools/apts/students/x', { token: 'ТОКЕН', fetchFn, config });
  assert.deepEqual(данные, { имя: 'Иванов' });
  assert.equal(
    fetchFn.вызовы[0].url,
    'https://пример.firebasedatabase.app/schools/apts/students/x.json?auth=%D0%A2%D0%9E%D0%9A%D0%95%D0%9D',
  );
});

test('чтение без токена не добавляет параметр auth', async () => {
  const fetchFn = поддельныйFetch(null);
  await dbGet('schools/apts/classes', { fetchFn, config });
  assert.ok(fetchFn.вызовы[0].url.endsWith('/schools/apts/classes.json'));
});

test('запись отправляет значение методом PUT', async () => {
  const fetchFn = поддельныйFetch({ ok: true });
  await dbPut('schools/apts/bindings/x', { uid: 'u', proof: 'p' }, { token: 'т', fetchFn, config });
  assert.equal(fetchFn.вызовы[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(fetchFn.вызовы[0].init.body), { uid: 'u', proof: 'p' });
});

test('отказ правил базы превращается в понятное сообщение', async () => {
  const fetchFn = поддельныйFetch({ error: 'Permission denied' }, { ok: false, status: 401 });
  await assert.rejects(
    () => dbPut('schools/apts/secrets/x', { pinHash: 'x' }, { token: 'т', fetchFn, config }),
    /Доступ запрещён/,
  );
});

// Путь собирается из наших данных, но проверяется всё равно: файл урока
// правит учитель через панель, и оттуда может прийти что угодно.
test('опасный путь отвергается до обращения к сети', async () => {
  const fetchFn = поддельныйFetch(null);
  for (const плохой of ['../secrets', 'a/b?auth=x', 'a b', 'путь/скириллицей']) {
    await assert.rejects(
      () => dbGet(плохой, { fetchFn, config }),
      /Недопустимый путь в базе/,
      `должен быть отвергнут: ${плохой}`,
    );
  }
  assert.equal(fetchFn.вызовы.length, 0);
});
