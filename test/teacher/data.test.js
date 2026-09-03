import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  статусКлетки,
  собратьЖурнал,
  очередьПроверки,
  createTeacherData,
  СТАТУСЫ,
} from '../../js/teacher/data.js';

// ── Статус клетки ────────────────────────────────────────────

test('неназначенный урок в журнале не считается несданным', () => {
  assert.equal(статусКлетки({ назначено: false, работа: null }), СТАТУСЫ.НЕ_ЗАДАНО);
});

test('назначено и не сдано', () => {
  assert.equal(статусКлетки({ назначено: true, работа: null }), СТАТУСЫ.НЕ_СДАНО);
});

test('работа без развёрнутого ответа сразу считается сданной', () => {
  assert.equal(статусКлетки({ назначено: true, работа: { percent: 80 } }), СТАТУСЫ.СДАНО);
});

test('работа с развёрнутым ответом ждёт проверки', () => {
  const работа = { percent: 80, open: { o1: 'текст' } };
  assert.equal(статусКлетки({ назначено: true, работа }), СТАТУСЫ.ЖДЁТ);
});

test('после выставления балла ожидание снимается', () => {
  const работа = { percent: 80, open: { o1: 'текст' }, manualScore: 2 };
  assert.equal(статусКлетки({ назначено: true, работа }), СТАТУСЫ.СДАНО);
});

// Учителю важнее знать, где от неё требуется действие.
test('ожидание проверки важнее пометки об опоздании', () => {
  const работа = { isLate: true, open: { o1: 'текст' } };
  assert.equal(статусКлетки({ назначено: true, работа }), СТАТУСЫ.ЖДЁТ);
});

test('опоздание показывается, когда проверять нечего', () => {
  assert.equal(статусКлетки({ назначено: true, работа: { isLate: true } }), СТАТУСЫ.С_ОПОЗДАНИЕМ);
});

test('пустой объект развёрнутых ответов не создаёт ожидания', () => {
  assert.equal(статусКлетки({ назначено: true, работа: { open: {} } }), СТАТУСЫ.СДАНО);
});

// Ноль баллов — это выставленная оценка, а не отсутствие проверки.
test('ноль баллов считается проверенной работой', () => {
  const работа = { open: { o1: 'мимо' }, manualScore: 0 };
  assert.equal(статусКлетки({ назначено: true, работа }), СТАТУСЫ.СДАНО);
});

// ── Журнал ───────────────────────────────────────────────────

const данные = {
  classId: '5a',
  students: {
    s2: { name: 'Яковлев Пётр', classId: '5a' },
    s1: { name: 'Абрамов Иван', classId: '5a' },
    s3: { name: 'Чужой Ученик', classId: '5b' },
  },
  assignments: {
    '5a': {
      'урок-2': { isOpen: true, assignedAt: 200 },
      'урок-1': { isOpen: true, assignedAt: 100 },
    },
  },
  submissions: {
    s1: { 'урок-1': { percent: 90, open: { o: 'ответ' } } },
    s2: { 'урок-1': { percent: 60, isLate: true } },
  },
};

test('уроки идут в порядке назначения, а не по алфавиту', () => {
  assert.deepEqual(собратьЖурнал(данные).уроки.map((у) => у.lessonId), ['урок-1', 'урок-2']);
});

test('ученики идут по алфавиту', () => {
  assert.deepEqual(собратьЖурнал(данные).строки.map((с) => с.name), ['Абрамов Иван', 'Яковлев Пётр']);
});

test('ученики чужого класса в журнал не попадают', () => {
  assert.equal(собратьЖурнал(данные).строки.some((с) => с.name === 'Чужой Ученик'), false);
});

test('статусы расставлены по каждой клетке', () => {
  const { строки } = собратьЖурнал(данные);
  const абрамов = строки[0];
  assert.equal(абрамов.клетки[0].статус, СТАТУСЫ.ЖДЁТ);
  assert.equal(абрамов.клетки[1].статус, СТАТУСЫ.НЕ_СДАНО);
  assert.equal(строки[1].клетки[0].статус, СТАТУСЫ.С_ОПОЗДАНИЕМ);
});

test('журнал пустого класса не падает', () => {
  const пусто = собратьЖурнал({ classId: 'нет-такого' });
  assert.deepEqual(пусто, { уроки: [], строки: [] });
});

// ── Очередь проверки ─────────────────────────────────────────

test('в очередь попадают только непроверенные развёрнутые ответы', () => {
  const очередь = очередьПроверки({
    students: { s1: { name: 'Абрамов' }, s2: { name: 'Яковлев' } },
    submissions: {
      s1: { u1: { open: { o: 'ждёт' }, submittedAt: 200 } },
      s2: {
        u1: { open: { o: 'уже проверено' }, manualScore: 2, submittedAt: 100 },
        u2: { percent: 100, submittedAt: 300 },
      },
    },
  });
  assert.equal(очередь.length, 1);
  assert.equal(очередь[0].имя, 'Абрамов');
});

test('кто сдал раньше — тот в очереди выше', () => {
  const очередь = очередьПроверки({
    students: { s1: { name: 'Поздний' }, s2: { name: 'Ранний' } },
    submissions: {
      s1: { u1: { open: { o: 'а' }, submittedAt: 500 } },
      s2: { u1: { open: { o: 'б' }, submittedAt: 100 } },
    },
  });
  assert.deepEqual(очередь.map((з) => з.имя), ['Ранний', 'Поздний']);
});

test('пустой развёрнутый ответ учителя не беспокоит', () => {
  const очередь = очередьПроверки({
    students: { s1: { name: 'А' } },
    submissions: { s1: { u1: { open: { o: '   ' }, submittedAt: 1 } } },
  });
  assert.deepEqual(очередь, []);
});

test('пустая база даёт пустую очередь', () => {
  assert.deepEqual(очередьПроверки({}), []);
});

// ── Выставление балла ────────────────────────────────────────

test('балл дописывается точечно, а не переписывает работу', async () => {
  const записи = [];
  const data = createTeacherData({
    api: { dbPatch: async (path, value, o) => { записи.push({ path, value, o }); } },
    getToken: async () => 'т',
  });
  await data.поставитьБалл({ studentId: 's1', lessonId: 'u1', score: 2, comment: 'Молодец' });

  assert.match(записи[0].path, /submissions\/s1\/u1$/);
  assert.equal(записи[0].value.manualScore, 2);
  assert.equal(записи[0].value.comment, 'Молодец');
  assert.ok(записи[0].value.checkedAt, 'должно быть видно, когда проверено');
});

test('пустой комментарий не записывается', async () => {
  let значение = null;
  const data = createTeacherData({
    api: { dbPatch: async (p, v) => { значение = v; } },
    getToken: async () => 'т',
  });
  await data.поставитьБалл({ studentId: 's1', lessonId: 'u1', score: 0, comment: '' });
  assert.equal('comment' in значение, false);
  assert.equal(значение.manualScore, 0, 'ноль баллов должен сохраняться');
});

/*
  «Дать переписать» — это стирание сданной работы, и по-другому оно не
  делается: правила пускают ученика писать только туда, где пусто. Значит,
  проверять надо ровно одно — что стирается именно та клетка и целиком.
*/
test('разрешение переписать стирает сданную работу', async () => {
  const записи = [];
  const data = createTeacherData({
    api: { dbPut: async (path, value) => { записи.push({ path, value }); } },
    getToken: async () => 'т',
  });
  await data.разрешитьПереписать({ studentId: 's1', lessonId: 'u1' });

  assert.equal(записи.length, 1);
  assert.match(записи[0].path, /submissions\/s1\/u1$/);
  assert.equal(записи[0].value, null, 'ученик сможет сдать заново только если там пусто');
});

test('переписать без сессии не разрешить', async () => {
  const data = createTeacherData({ api: {}, getToken: async () => null });
  await assert.rejects(() => data.разрешитьПереписать({ studentId: 's1', lessonId: 'u1' }), /войти заново/);
});

test('без действующей сессии загрузка говорит понятное', async () => {
  const data = createTeacherData({ api: {}, getToken: async () => null });
  await assert.rejects(() => data.загрузитьВсё(), /войти заново/);
});
