import { test } from 'node:test';
import assert from 'node:assert/strict';
import { собратьПрогресс, ДАВНО_НЕ_БЫЛ_МС } from '../../js/pages/teacher-progress.js';

const СЕЙЧАС = new Date(2026, 7, 18).getTime();
const ДЕНЬ = 86400000;

test('строки сортируются по фамилии, а не по баллам', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'Яковлев Пётр', classId: '5a' }, s2: { name: 'Абрамова Ася', classId: '5a' } },
    leaderboard: { s1: { xp: 100 }, s2: { xp: 10 } },
    сейчас: СЕЙЧАС,
  });
  assert.deepEqual(строки.map((с) => с.имя), ['Абрамова Ася', 'Яковлев Пётр']);
});

test('ученик без единого балла попадает в список нулём', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'Петров Иван', classId: '5a' } },
    leaderboard: {},
    сейчас: СЕЙЧАС,
  });
  assert.equal(строки[0].xp, 0);
  assert.equal(строки[0].ступень, 'Наблюдатель');
  assert.equal(строки[0].последний, null);
});

test('две недели без захода помечаются', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'А', classId: '5a' }, s2: { name: 'Б', classId: '5a' } },
    leaderboard: { s1: { xp: 10, lastSeen: СЕЙЧАС - ДЕНЬ }, s2: { xp: 10, lastSeen: СЕЙЧАС - 15 * ДЕНЬ } },
    сейчас: СЕЙЧАС,
  });
  assert.equal(строки[0].давноНеБыл, false);
  assert.equal(строки[1].давноНеБыл, true);
});

test('не заходивший ни разу помечен тоже', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'А', classId: '5a' } },
    leaderboard: {},
    сейчас: СЕЙЧАС,
  });
  assert.equal(строки[0].давноНеБыл, true);
});

test('ученики чужих классов не попадают', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'А', classId: '5a' }, s2: { name: 'Б', classId: '6б' } },
    leaderboard: {},
    сейчас: СЕЙЧАС,
  });
  assert.equal(строки.length, 1);
});

test('ступень считается по баллам, а не берётся из таблицы', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'А', classId: '5a' } },
    leaderboard: { s1: { xp: 700, ступень: 'Биолог' } },
    сейчас: СЕЙЧАС,
  });
  assert.equal(строки[0].ступень, 'Исследователь');
});

test('порог «давно не был» — две недели', () => {
  assert.equal(ДАВНО_НЕ_БЫЛ_МС, 14 * ДЕНЬ);
});
