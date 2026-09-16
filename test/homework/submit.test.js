import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHomework, ВХОД_УСТАРЕЛ } from '../../js/homework/submit.js';

function собрать({ отказПриСдаче = false, данные = {} } = {}) {
  const записи = [];
  const api = {
    dbGet: async (path) => {
      const ключ = Object.keys(данные).find((k) => path.endsWith(k));
      if (ключ === undefined) return null;
      if (данные[ключ] === 'отказ') throw new Error('Доступ запрещён.');
      return данные[ключ];
    },
    dbPut: async (path, value, options) => {
      if (path.includes('/submissions/') && отказПриСдаче) throw new Error('Доступ запрещён.');
      записи.push({ path, value, options });
      return value;
    },
  };
  return { hw: createHomework({ api, now: () => 1000 }), записи };
}

test('назначения читаются по классу', async () => {
  const { hw } = собрать({ данные: { 'assignments/5a': { 'урок-1': { isOpen: true } } } });
  assert.deepEqual(await hw.loadAssignments('5a'), { 'урок-1': { isOpen: true } });
});

test('без класса назначений нет и запроса тоже', async () => {
  const { hw } = собрать();
  assert.deepEqual(await hw.loadAssignments(null), {});
});

/*
  Правила пускают ученика к своим работам, только пока привязка входа —
  его. Вошёл под тем же именем на другом устройстве — привязка переехала,
  и здесь чтение получает отказ. Молча считать это «ничего не сдано»
  нельзя: 16 сентября так ученик 8 класса не мог сдать работу, а сайт
  отвечал, что она уже сдана.
*/
test('отказ при чтении своих работ означает устаревший вход', async () => {
  const { hw } = собрать({ данные: { 'submissions/s1': 'отказ' } });
  await assert.rejects(() => hw.loadSubmissions('s1', 'токен'), (e) => e.code === ВХОД_УСТАРЕЛ);
});

test('пустые работы читаются как пустые', async () => {
  const { hw } = собрать();
  assert.deepEqual(await hw.loadSubmissions('s1', 'токен'), {});
});

test('работа собирается с итогом по игре и вопросам', () => {
  const { hw } = собрать();
  const w = hw.buildSubmission({
    gameResult: { correct: 7, total: 8 },
    questionResult: { correct: 4, total: 6 },
    answers: { q1: 1 },
    open: { o1: 'мой ответ' },
  });
  assert.equal(w.attempt, 1);
  assert.equal(w.correct, 11);
  assert.equal(w.total, 14);
  assert.equal(w.percent, 79);
  assert.deepEqual(w.open, { o1: 'мой ответ' });
});

test('сдача до срока не помечается опозданием', () => {
  const { hw } = собрать();
  assert.equal(hw.buildSubmission({ dueAt: 5000 }).isLate, false);
});

test('сдача после срока помечается опозданием, но принимается', () => {
  const { hw } = собрать();
  const w = hw.buildSubmission({ dueAt: 500 });
  assert.equal(w.isLate, true);
  assert.equal(w.attempt, 1, 'опоздание не отменяет саму сдачу');
});

test('работа без срока опозданием не считается', () => {
  const { hw } = собрать();
  assert.equal(hw.buildSubmission({}).isLate, false);
});

// Балл за развёрнутый ответ ставит учитель, и правила базы запрещают
// присылать это поле. Сдача не должна его создавать даже случайно.
test('в сданной работе нет поля для учительского балла', () => {
  const { hw } = собрать();
  assert.equal('manualScore' in hw.buildSubmission({}), false);
});

test('сдача пишет работу по нужному пути', async () => {
  const { hw, записи } = собрать();
  await hw.submit({
    studentId: 's1', lessonId: 'урок-1', token: 'т',
    gameResult: { correct: 8, total: 8 }, questionResult: { correct: 6, total: 6 },
  });
  assert.match(записи[0].path, /submissions\/s1\/урок-1$/);
  assert.equal(записи[0].value.percent, 100);
});

// Первая попытка идёт в журнал, и это держат правила базы, а не интерфейс.
// Но отказ базы бывает по трём причинам, и ученику надо назвать настоящую.
const СДАЧА = { studentId: 's1', classId: '8', lessonId: 'урок-1', token: 'т' };

test('повторная сдача даёт понятный отказ, а не техническую ошибку', async () => {
  const { hw } = собрать({
    отказПриСдаче: true,
    данные: { 'submissions/s1/урок-1': { submittedAt: 1 }, 'assignments/8/урок-1': { isOpen: true } },
  });
  await assert.rejects(() => hw.submit(СДАЧА), /уже сдана/);
});

test('отказ при устаревшем входе не выдаётся за сданную работу', async () => {
  const { hw } = собрать({
    отказПриСдаче: true,
    данные: { 'submissions/s1/урок-1': 'отказ', 'assignments/8/урок-1': { isOpen: true } },
  });
  await assert.rejects(() => hw.submit(СДАЧА), (e) => {
    assert.equal(e.code, ВХОД_УСТАРЕЛ);
    assert.doesNotMatch(e.message, /уже сдана/);
    assert.match(e.message, /другом устройстве/);
    return true;
  });
});

test('закрытое учителем задание называется закрытым', async () => {
  const { hw } = собрать({
    отказПриСдаче: true,
    данные: { 'assignments/8/урок-1': { isOpen: false } },
  });
  await assert.rejects(() => hw.submit(СДАЧА), /закрыл/);
});

test('непонятный отказ не выдаётся за сданную работу', async () => {
  const { hw } = собрать({
    отказПриСдаче: true,
    данные: { 'assignments/8/урок-1': { isOpen: true } },
  });
  await assert.rejects(() => hw.submit(СДАЧА), (e) => !/уже сдана/.test(e.message));
});

test('тренировка пишется в прогресс, а не в работу', async () => {
  const { hw, записи } = собрать();
  await hw.recordPractice({ studentId: 's1', lessonId: 'урок-1', token: 'т', correct: 5, total: 8 });
  assert.match(записи[0].path, /progress\/s1\/practice\/урок-1$/);
  assert.deepEqual(записи[0].value, { at: 1000, correct: 5, total: 8 });
});

test('неудачная запись тренировки проходит молча', async () => {
  const api = { dbPut: async () => { throw new Error('Доступ запрещён.'); } };
  const hw = createHomework({ api });
  assert.equal(await hw.recordPractice({ studentId: 's1', lessonId: 'у', token: 'т', correct: 1, total: 2 }), null);
});

test('без входа тренировка никуда не пишется', async () => {
  const { hw, записи } = собрать();
  assert.equal(await hw.recordPractice({ studentId: null, lessonId: 'у', token: null }), null);
  assert.equal(записи.length, 0);
});
