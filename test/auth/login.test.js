import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogin } from '../../js/auth/login.js';

function поддельноеХранилище() {
  const данные = {};
  return {
    getItem: (k) => (k in данные ? данные[k] : null),
    setItem: (k, v) => { данные[k] = String(v); },
    removeItem: (k) => { delete данные[k]; },
  };
}

/** Собирает вход с подставной базой. База описывается как обычный объект. */
function собрать({ classes = {}, students = {}, разрешитьПривязку = true, учительЗанят = false } = {}) {
  const записи = [];
  const api = {
    dbGet: async (path) => {
      if (path.endsWith('/classes')) return classes;
      if (path.endsWith('/students')) return students;
      if (path.includes('/teachers/')) {
        if (учительЗанят) throw new Error('Доступ запрещён.');
        return null;
      }
      return null;
    },
    dbPut: async (path, value, options) => {
      if (path.includes('/bindings/') && !разрешитьПривязку) throw new Error('Доступ запрещён.');
      if (path.includes('/teachers/') && учительЗанят) throw new Error('Доступ запрещён.');
      записи.push({ path, value, options });
      return value;
    },
    signInAnonymously: async () => ({
      idToken: 'ид', refreshToken: 'обн', uid: 'аноним-1', email: null, expiresInSec: 3600,
    }),
    signInWithPassword: async (email) => ({
      idToken: 'ид-у', refreshToken: 'обн-у', uid: 'учитель-1', email, expiresInSec: 3600,
    }),
  };
  const login = createLogin({
    api,
    // Подделка намеренно не содержит сам PIN: иначе проверка «PIN не уходит
    // на сервер» подтверждала бы свойство подделки, а не свойство кода.
    hash: async (pin, salt) => `доказательство-${salt}-${String(pin).length}`,
    storeOptions: { storage: поддельноеХранилище(), now: () => 0 },
  });
  return { login, записи };
}

test('классы приходят списком и по алфавиту', async () => {
  const { login } = собрать({ classes: { b: { title: '5Б', grade: 5 }, a: { title: '5А', grade: 5 } } });
  assert.deepEqual((await login.loadClasses()).map((c) => c.title), ['5А', '5Б']);
});

test('пустая база не роняет список классов', async () => {
  const api = { dbGet: async () => null };
  const login = createLogin({ api, storeOptions: { storage: поддельноеХранилище() } });
  assert.deepEqual(await login.loadClasses(), []);
});

test('ученики фильтруются по классу и сортируются по фамилии', async () => {
  const { login } = собрать({
    students: {
      s1: { name: 'Яковлев Пётр', classId: '5a', salt: 'c1' },
      s2: { name: 'Абрамов Иван', classId: '5a', salt: 'c2' },
      s3: { name: 'Белов Олег', classId: '5b', salt: 'c3' },
    },
  });
  const список = await login.loadStudents('5a');
  assert.deepEqual(список.map((s) => s.name), ['Абрамов Иван', 'Яковлев Пётр']);
});

test('верный PIN записывает привязку и сохраняет сессию', async () => {
  const { login, записи } = собрать();
  const сессия = await login.loginStudent(
    { studentId: 's1', name: 'Иванов Иван', classId: '5a', salt: 'соль' },
    '1234',
  );

  assert.equal(записи.length, 1);
  assert.match(записи[0].path, /bindings\/s1$/);
  assert.deepEqual(записи[0].value, { uid: 'аноним-1', proof: 'доказательство-соль-4' });
  assert.equal(сессия.kind, 'student');
  assert.equal(сессия.studentId, 's1');
  assert.equal(сессия.name, 'Иванов Иван');
});

// PIN не уходит на сервер ни в каком виде — только посчитанное из него доказательство.
test('сам PIN никуда не отправляется', async () => {
  const { login, записи } = собрать();
  await login.loginStudent({ studentId: 's1', name: 'И', classId: '5a', salt: 'соль' }, '1234');
  assert.equal(JSON.stringify(записи[0].value).includes('1234'), false);
});

test('отказ правил превращается в «неверный код», а не в техническую ошибку', async () => {
  const { login } = собрать({ разрешитьПривязку: false });
  await assert.rejects(
    () => login.loginStudent({ studentId: 's1', name: 'И', classId: '5a', salt: 'соль' }, '9999'),
    /Неверный код/,
  );
  assert.equal(login.current(), null, 'при неудаче сессия не должна сохраняться');
});

test('обрыв связи не выдаётся за неверный код', async () => {
  const { login } = собрать();
  const сломанный = createLogin({
    api: {
      signInAnonymously: async () => { throw new Error('Нет связи с сервером. Проверь интернет.'); },
    },
    hash: async () => 'х',
    storeOptions: { storage: поддельноеХранилище() },
  });
  await assert.rejects(
    () => сломанный.loginStudent({ studentId: 's1', name: 'И', classId: '5a', salt: 'с' }, '1234'),
    /Нет связи с сервером/,
  );
  assert.equal(login.current(), null);
});

test('учитель закрепляется при первом входе по паролю', async () => {
  const { login, записи } = собрать();
  const сессия = await login.loginTeacher('a@b.c', 'тайна');
  assert.match(записи[0].path, /teachers\/учитель-1$/);
  assert.equal(записи[0].value, true);
  assert.equal(сессия.kind, 'teacher');
  assert.equal(сессия.email, 'a@b.c');
});

test('если место учителя занято другим аккаунтом — понятный отказ', async () => {
  const { login } = собрать({ учительЗанят: true });
  await assert.rejects(() => login.loginTeacher('chuzhoy@b.c', 'тайна'), /уже назначен/);
  assert.equal(login.current(), null);
});

test('повторный вход учителя не пытается закрепиться снова', async () => {
  const записи = [];
  const login = createLogin({
    api: {
      signInWithPassword: async (email) => ({ idToken: 'т', refreshToken: 'о', uid: 'u1', email, expiresInSec: 3600 }),
      dbGet: async () => true,
      dbPut: async (path, value) => { записи.push(path); return value; },
    },
    storeOptions: { storage: поддельноеХранилище(), now: () => 0 },
  });
  await login.loginTeacher('a@b.c', 'тайна');
  assert.deepEqual(записи, [], 'запись уже есть, трогать её незачем');
});

test('выход стирает сессию', async () => {
  const { login } = собрать();
  await login.loginStudent({ studentId: 's1', name: 'И', classId: '5a', salt: 'с' }, '1234');
  assert.ok(login.current());
  login.logout();
  assert.equal(login.current(), null);
});
