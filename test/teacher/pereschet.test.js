import { test } from 'node:test';
import assert from 'node:assert/strict';
import { планПересчёта } from '../../js/teacher/pereschet.js';
import { createTeacherData } from '../../js/teacher/data.js';

/*
  Панель при открытии пишет в живую таблицу почёта. Проверяется, что она
  трогает только разошедшиеся строки, не заводит новых и пишет два числа.
*/

const СЕЙЧАС = new Date(2026, 8, 16);
const давно = new Date(2026, 8, 1).getTime();

const students = {
  a: { name: 'Белова Анна', classId: '8' },
  b: { name: 'Акимов Борис', classId: '8' },
  c: { name: 'Волков Сергей', classId: '5' },
  d: { name: 'Громова Дина', classId: '5' },
};
const submissions = {
  a: { 'l1': { submittedAt: давно, correct: 10, total: 10 } },
  b: { 'l1': { submittedAt: давно, correct: 5, total: 10 } },
  d: { 'l1': { submittedAt: давно, correct: 5, total: 10 } },
};
const leaderboard = {
  8: {
    a: { xp: 300, weekId: 'x' },
    b: { xp: 40, weekId: 'x', hwXp: 15, hwWeekXp: 0, hwDone: 1, hwWeekDone: 0 },
  },
  5: { c: { xp: 10, weekId: 'x' } },
};

test('в плане только разошедшиеся строки, по алфавиту', () => {
  const { изменения } = планПересчёта({ students, submissions, leaderboard, сейчас: СЕЙЧАС });
  assert.deepEqual(изменения.map((и) => и.id), ['a', 'c']);
  assert.deepEqual(изменения[0].стало, { hwXp: 40, hwWeekXp: 0, hwDone: 1, hwWeekDone: 0 }, 'всё верно — тридцать и бонус');
  assert.deepEqual(изменения[0].было, { hwXp: null, hwWeekXp: null, hwDone: null, hwWeekDone: null });
  assert.deepEqual(изменения[1].стало, { hwXp: 0, hwWeekXp: 0, hwDone: 0, hwWeekDone: 0 });
});

// Строки, записанные до 17 сентября, числа сданных работ не несут. Без него
// шкала класса показала бы ноль, хотя баллы в строке сходятся.
test('строка без числа сданных работ дописывается, даже если баллы сошлись', () => {
  const старая = { ...leaderboard, 8: { ...leaderboard[8], b: { xp: 40, weekId: 'x', hwXp: 15, hwWeekXp: 0 } } };
  const { изменения } = планПересчёта({ students, submissions, leaderboard: старая, сейчас: СЕЙЧАС });
  const b = изменения.find((и) => и.id === 'b');
  assert.ok(b, 'строка b должна попасть в план');
  assert.equal(b.стало.hwDone, 1);
});

test('ученик со сданной работой без строки в таблице назван, но не заведён', () => {
  const { изменения, безСтроки } = планПересчёта({ students, submissions, leaderboard, сейчас: СЕЙЧАС });
  assert.deepEqual(безСтроки, [{ id: 'd', имя: 'Громова Дина', hwXp: 15 }]);
  assert.ok(!изменения.some((и) => и.id === 'd'));
});

test('панель при открытии пишет в строку ученика только домашние числа', async () => {
  const записи = [];
  const api = { dbPatch: async (path, value) => { записи.push({ path, value }); } };
  const data = createTeacherData({ api, getToken: async () => 't' });
  const загружено = structuredClone({ students, submissions, leaderboards: leaderboard });
  const итог = await data.свестиПочёт(загружено, { сейчас: СЕЙЧАС });

  assert.equal(итог.изменения.length, 2);
  assert.deepEqual(записи.map((з) => з.path), ['schools/apts/leaderboard/8/a', 'schools/apts/leaderboard/5/c']);
  for (const з of записи) assert.deepEqual(Object.keys(з.value).sort(), ['hwDone', 'hwWeekDone', 'hwWeekXp', 'hwXp']);
  assert.equal(загружено.leaderboards[8].a.hwXp, 40, 'открытая вкладка видит записанное');
  assert.equal(загружено.leaderboards[8].a.xp, 300, 'общий счёт не тронут');

  записи.length = 0;
  await data.свестиПочёт(загружено, { сейчас: СЕЙЧАС });
  assert.equal(записи.length, 0, 'второй заход ничего не пишет');
});

/*
  Работам, проверенным до записи максимума, панель дописывает его из файла
  урока: без него балл «2» не перевести в долю. Урок читается один раз на
  все работы.
*/
test('панель дописывает максимум старым проверенным работам', async () => {
  const записи = [];
  let чтений = 0;
  const api = { dbPatch: async (path, value) => { записи.push({ path, value }); } };
  const data = createTeacherData({
    api,
    getToken: async () => 't',
    загрузитьУрок: async () => { чтений += 1; return { homework: { open: [{ id: 'o', maxScore: 2 }] } }; },
  });
  const загружено = {
    students: { a: { name: 'А', classId: '8' }, b: { name: 'Б', classId: '8' } },
    submissions: {
      a: { l1: { submittedAt: давно, correct: 10, total: 10, open: { o: 'x' }, manualScore: 1 } },
      b: { l1: { submittedAt: давно, correct: 10, total: 10, open: { o: 'x' }, manualScore: 2, manualMax: 2 } },
    },
    leaderboards: { 8: { a: { xp: 1, weekId: 'x' }, b: { xp: 1, weekId: 'x' } } },
  };
  await data.свестиПочёт(загружено, { сейчас: СЕЙЧАС });

  assert.equal(чтений, 1);
  assert.deepEqual(записи[0], { path: 'schools/apts/submissions/a/l1', value: { manualMax: 2 } });
  assert.equal(записи.filter((з) => з.path.includes('/submissions/')).length, 1, 'у второй максимум уже был');
  assert.equal(загружено.leaderboards[8].a.hwXp, 28, 'одиннадцать из двенадцати');
  assert.equal(загружено.leaderboards[8].b.hwXp, 40, 'всё набрано — с бонусом');
});
