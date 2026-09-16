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
  a: { 'l1': { submittedAt: давно, percent: 95 } },
  b: { 'l1': { submittedAt: давно, percent: 50 } },
  d: { 'l1': { submittedAt: давно, percent: 50 } },
};
const leaderboard = {
  8: {
    a: { xp: 300, weekId: 'x' },
    b: { xp: 40, weekId: 'x', hwXp: 20, hwWeekXp: 0 },
  },
  5: { c: { xp: 10, weekId: 'x' } },
};

test('в плане только разошедшиеся строки, по алфавиту', () => {
  const { изменения } = планПересчёта({ students, submissions, leaderboard, сейчас: СЕЙЧАС });
  assert.deepEqual(изменения.map((и) => и.id), ['a', 'c']);
  assert.deepEqual(изменения[0].стало, { hwXp: 30, hwWeekXp: 0 });
  assert.deepEqual(изменения[0].было, { hwXp: null, hwWeekXp: null });
  assert.deepEqual(изменения[1].стало, { hwXp: 0, hwWeekXp: 0 });
});

test('ученик со сданной работой без строки в таблице назван, но не заведён', () => {
  const { изменения, безСтроки } = планПересчёта({ students, submissions, leaderboard, сейчас: СЕЙЧАС });
  assert.deepEqual(безСтроки, [{ id: 'd', имя: 'Громова Дина', hwXp: 20 }]);
  assert.ok(!изменения.some((и) => и.id === 'd'));
});

test('панель при открытии пишет только hwXp и hwWeekXp в строку ученика', async () => {
  const записи = [];
  const api = { dbPatch: async (path, value) => { записи.push({ path, value }); } };
  const data = createTeacherData({ api, getToken: async () => 't' });
  const загружено = structuredClone({ students, submissions, leaderboards: leaderboard });
  const итог = await data.свестиПочёт(загружено, { сейчас: СЕЙЧАС });

  assert.equal(итог.изменения.length, 2);
  assert.deepEqual(записи.map((з) => з.path), ['schools/apts/leaderboard/8/a', 'schools/apts/leaderboard/5/c']);
  for (const з of записи) assert.deepEqual(Object.keys(з.value).sort(), ['hwWeekXp', 'hwXp']);
  assert.equal(загружено.leaderboards[8].a.hwXp, 30, 'открытая вкладка видит записанное');
  assert.equal(загружено.leaderboards[8].a.xp, 300, 'общий счёт не тронут');

  записи.length = 0;
  await data.свестиПочёт(загружено, { сейчас: СЕЙЧАС });
  assert.equal(записи.length, 0, 'второй заход ничего не пишет');
});
