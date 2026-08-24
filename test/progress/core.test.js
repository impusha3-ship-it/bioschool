import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ПУСТО, начислить, ценность, всегоXp } from '../../js/progress/core.js';

const ДАТА = new Date(2026, 7, 18); // вторник 34-й недели

function начать() {
  return структурированный(ПУСТО);
}
function структурированный(o) {
  return JSON.parse(JSON.stringify(o));
}

test('игра с ошибками стоит десять баллов', () => {
  assert.equal(ценность({ kind: 'game0', correct: 6, total: 8 }), 10);
});

test('игра без ошибок стоит пятнадцать', () => {
  assert.equal(ценность({ kind: 'game0', correct: 8, total: 8 }), 15);
});

test('определитель стоит столько же, сколько игра', () => {
  assert.equal(ценность({ kind: 'key0', correct: 4, total: 4 }), 15);
});

test('лабораторная без промахов стоит двадцать', () => {
  assert.equal(ценность({ kind: 'lab', correct: 6, total: 6 }), 20);
});

test('за задания ВПР дают по два балла', () => {
  assert.equal(ценность({ kind: 'vpr', correct: 3, total: 5 }), 6);
});

test('баллы за ВПР упираются в потолок', () => {
  assert.equal(ценность({ kind: 'vpr', correct: 9, total: 9 }), 10);
});

test('домашка на девяносто процентов даёт добавку', () => {
  assert.equal(ценность({ kind: 'homework', percent: 90 }), 30);
  assert.equal(ценность({ kind: 'homework', percent: 89 }), 20);
});

test('первое прохождение начисляет всё', () => {
  const { состояние, добавлено } = начислить(начать(), {
    lessonId: 'у1', kind: 'game0', correct: 6, total: 8, состав: ['game0'],
  }, ДАТА);
  assert.equal(добавлено, 10);
  assert.equal(состояние.lessons['у1'].game0, 10);
  assert.equal(состояние.weeks['2026-W34'], 10);
});

test('повтор с тем же результатом не начисляет ничего', () => {
  const первое = начислить(начать(), {
    lessonId: 'у1', kind: 'game0', correct: 6, total: 8, состав: ['game0'],
  }, ДАТА);
  const второе = начислить(первое.состояние, {
    lessonId: 'у1', kind: 'game0', correct: 6, total: 8, состав: ['game0'],
  }, ДАТА);
  assert.equal(второе.добавлено, 0);
  assert.equal(второе.состояние.lessons['у1'].game0, 10);
  assert.equal(второе.состояние.weeks['2026-W34'], 10);
});

test('добавка за безошибочность догоняет при повторе', () => {
  const первое = начислить(начать(), {
    lessonId: 'у1', kind: 'game0', correct: 6, total: 8, состав: ['game0'],
  }, ДАТА);
  const второе = начислить(первое.состояние, {
    lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'],
  }, ДАТА);
  assert.equal(второе.добавлено, 5);
  assert.equal(второе.состояние.lessons['у1'].game0, 15);
});

test('худший повтор не отнимает выданное', () => {
  const первое = начислить(начать(), {
    lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'],
  }, ДАТА);
  const второе = начислить(первое.состояние, {
    lessonId: 'у1', kind: 'game0', correct: 1, total: 8, состав: ['game0'],
  }, ДАТА);
  assert.equal(второе.добавлено, 0);
  assert.equal(второе.состояние.lessons['у1'].game0, 15);
});

test('ключ пишется даже при нуле баллов', () => {
  const { состояние } = начислить(начать(), {
    lessonId: 'у1', kind: 'vpr', correct: 0, total: 5, состав: ['vpr'],
  }, ДАТА);
  assert.equal(состояние.lessons['у1'].vpr, 0);
});

test('урок пройден, когда закрыт весь состав', () => {
  const состав = ['game0', 'vpr'];
  const первое = начислить(начать(), { lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав }, ДАТА);
  assert.equal(первое.состояние.lessons['у1'].done, false);
  const второе = начислить(первое.состояние, { lessonId: 'у1', kind: 'vpr', correct: 0, total: 5, состав }, ДАТА);
  assert.equal(второе.состояние.lessons['у1'].done, true);
});

test('домашка в состав не входит и одна урока не закрывает', () => {
  const { состояние } = начислить(начать(), {
    lessonId: 'у1', kind: 'homework', percent: 100, состав: ['game0', 'vpr'],
  }, ДАТА);
  assert.equal(состояние.lessons['у1'].done, false);
  assert.equal(состояние.lessons['у1'].homework, 30);
});

test('исходное состояние не меняется', () => {
  const было = начать();
  начислить(было, { lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] }, ДАТА);
  assert.deepEqual(было.lessons, {});
});

test('всего баллов — сумма выданного по всем урокам', () => {
  let s = начать();
  s = начислить(s, { lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] }, ДАТА).состояние;
  s = начислить(s, { lessonId: 'у2', kind: 'vpr', correct: 5, total: 5, состав: ['vpr'] }, ДАТА).состояние;
  assert.equal(всегоXp(s), 25);
});
