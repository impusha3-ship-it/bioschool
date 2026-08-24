import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, слить } from '../../js/progress/store.js';

const ДАТА = new Date(2026, 7, 18);

function память(начальное = null) {
  const данные = new Map();
  if (начальное) данные.set('bioschool.progress', JSON.stringify(начальное));
  return {
    getItem: (k) => (данные.has(k) ? данные.get(k) : null),
    setItem: (k, v) => данные.set(k, v),
    removeItem: (k) => данные.delete(k),
  };
}

function собрать({ storage = память(), сессия = () => null, записи = [], данные = {} } = {}) {
  const api = {
    dbGet: async (path) => данные[Object.keys(данные).find((k) => path.endsWith(k)) ?? ''] ?? null,
    dbPut: async (path, value) => { записи.push({ path, value }); return value; },
  };
  const p = createProgress({ api, storage, сессия, токен: async () => 'т', now: () => ДАТА });
  return { p, записи, api };
}

test('гость копит баллы в браузере', async () => {
  const { p, записи } = собрать();
  const { добавлено } = await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.equal(добавлено, 15);
  assert.equal(p.read().lessons['у1'].game0, 15);
  assert.deepEqual(записи, []); // без входа в базу не пишем
});

test('состояние переживает пересоздание хранилища', async () => {
  const storage = память();
  const первый = собрать({ storage });
  await первый.p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  const второй = собрать({ storage });
  assert.equal(второй.p.read().lessons['у1'].game0, 15);
});

test('испорченная запись не роняет чтение', () => {
  const storage = память();
  storage.setItem('bioschool.progress', '{это не json');
  const { p } = собрать({ storage });
  assert.deepEqual(p.read().lessons, {});
});

test('record возвращает новые значки, а не все', async () => {
  const { p } = собрать();
  const первое = await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.deepEqual(первое.значки.map((з) => з.id).sort(), ['clean-game', 'first']);
  const второе = await p.record({ lessonId: 'у2', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.deepEqual(второе.значки, []);
});

test('слияние берёт лучшее по каждому виду и не складывает баллы', () => {
  const a = { v: 1, lessons: { у1: { game0: 15, vpr: 4 } }, weeks: { '2026-W33': 19 }, lastSeen: 5 };
  const b = { v: 1, lessons: { у1: { game0: 10, vpr: 10 }, у2: { lab: 20 } }, weeks: { '2026-W33': 20, '2026-W34': 3 }, lastSeen: 9 };
  assert.deepEqual(слить(a, b), {
    v: 1,
    lessons: { у1: { game0: 15, vpr: 10, done: false }, у2: { lab: 20, done: false } },
    weeks: { '2026-W33': 20, '2026-W34': 3 },
    lastSeen: 9,
  });
});

test('пройденность при слиянии не теряется', () => {
  const a = { v: 1, lessons: { у1: { game0: 10, done: true } }, weeks: {}, lastSeen: 0 };
  const b = { v: 1, lessons: { у1: { game0: 15, done: false } }, weeks: {}, lastSeen: 0 };
  assert.equal(слить(a, b).lessons['у1'].done, true);
});

test('слияние пустого с пустым даёт пустое', () => {
  assert.deepEqual(слить(undefined, undefined), { v: 1, lessons: {}, weeks: {}, lastSeen: 0 });
});

test('слияние сохраняет незнакомое поле и не занижает версию', () => {
  const a = { v: 2, lessons: {}, weeks: {}, lastSeen: 0, future: 'x' };
  const b = { v: 1, lessons: {}, weeks: {}, lastSeen: 0 };
  const результат = слить(a, b);
  assert.equal(результат.v, 2);
  assert.equal(результат.future, 'x');
});

test('испорченное числом значение при слиянии не даёт NaN', () => {
  const a = { v: 1, lessons: { у1: { game0: 'abc' } }, weeks: { '2026-W33': 'nope' }, lastSeen: 0 };
  const b = { v: 1, lessons: { у1: { game0: 10 } }, weeks: { '2026-W33': 5 }, lastSeen: 0 };
  const результат = слить(a, b);
  assert.equal(результат.lessons['у1'].game0, 10);
  assert.equal(результат.weeks['2026-W33'], 5);
});

test('отказ базы не мешает начислению', async () => {
  const storage = память();
  const api = {
    dbGet: async () => null,
    dbPut: async () => { throw new Error('Нет связи с сервером. Проверь интернет.'); },
  };
  const p = createProgress({
    api, storage, сессия: () => ({ studentId: 's1', classId: '5a' }),
    токен: async () => 'т', now: () => ДАТА,
  });

  const { добавлено } = await p.record({ lessonId: 'у1', kind: 'lab', correct: 6, total: 6, состав: ['lab'] });
  assert.equal(добавлено, 20);
  assert.equal(JSON.parse(storage.getItem('bioschool.progress')).lessons['у1'].lab, 20);
  await p.дождатьсяОтправки(); // отказ уже проглочен внутри, тут просто ждём, чтобы не утекало в следующий тест
});

test('отказ хранилища при записи не мешает начислению', async () => {
  const storage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
  const { p } = собрать({ storage });

  const { добавлено } = await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.equal(добавлено, 15);
});

test('негодное событие не роняет запись и не портит накопленное', async () => {
  const { p } = собрать();
  await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });

  const результат = await p.record({ lessonId: 'у1', kind: 'дз' });
  assert.equal(результат.добавлено, 0);
  assert.deepEqual(результат.значки, []);
  assert.equal(p.read().lessons['у1'].game0, 15);
});
