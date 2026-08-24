import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ПУСТО, начислить, ценность, всегоXp, ступень, серия, СТУПЕНИ } from '../../js/progress/core.js';
import { предыдущая } from '../../js/progress/weeks.js';

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

test('пустой результат не считается безошибочным', () => {
  assert.equal(ценность({ kind: 'game0', correct: 0, total: 0 }), 10);
});

test('неизвестный вид работы даёт понятную ошибку', () => {
  assert.throws(
    () => ценность({ kind: 'дз', correct: 1, total: 1 }),
    /Неизвестный вид работы: дз/,
  );
  assert.throws(
    () => ценность({ kind: 'vpr ', correct: 1, total: 1 }),
    /Неизвестный вид работы/,
  );
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

test('начисление без урока даёт понятную ошибку', () => {
  assert.throws(
    () => начислить(начать(), { kind: 'game0', correct: 1, total: 1, состав: ['game0'] }, ДАТА),
    /Начисление без урока/,
  );
});

test('отрицательный результат не уводит баллы в минус', () => {
  const { состояние, добавлено } = начислить(начать(), {
    lessonId: 'у1', kind: 'vpr', correct: -3, total: 5, состав: ['vpr'],
  }, ДАТА);
  assert.equal(добавлено, 0);
  assert.equal(состояние.lessons['у1'].vpr, 0);
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

test('ступеней шесть и первая начинается с нуля', () => {
  assert.equal(СТУПЕНИ.length, 6);
  assert.equal(СТУПЕНИ[0].порог, 0);
});

test('ступень по баллам', () => {
  assert.equal(ступень(0).имя, 'Наблюдатель');
  assert.equal(ступень(99).имя, 'Наблюдатель');
  assert.equal(ступень(100).имя, 'Собиратель');
  assert.equal(ступень(1500).имя, 'Биолог');
  assert.equal(ступень(99999).имя, 'Биолог');
});

test('до следующей ступени считается от порога', () => {
  assert.equal(ступень(80).доСледующей, 20);
  assert.equal(ступень(80).следующая, 'Собиратель');
});

test('на последней ступени следующей нет', () => {
  assert.equal(ступень(1500).следующая, null);
  assert.equal(ступень(1500).доСледующей, 0);
});

test('серия считает недели подряд', () => {
  const weeks = { '2026-W32': 10, '2026-W33': 5, '2026-W34': 15 };
  assert.equal(серия(weeks, ДАТА), 3);
});

test('пропущенная неделя обрывает серию', () => {
  const weeks = { '2026-W30': 10, '2026-W32': 5, '2026-W33': 15, '2026-W34': 1 };
  assert.equal(серия(weeks, ДАТА), 3);
});

test('пустая текущая неделя серию ещё не рвёт', () => {
  const weeks = { '2026-W32': 10, '2026-W33': 5 };
  assert.equal(серия(weeks, ДАТА), 2);
});

test('без единой недели серии нет', () => {
  assert.equal(серия({}, ДАТА), 0);
});

test('посторонний ключ в weeks не роняет серию', () => {
  // ключ, который не пройдёт валидацию в предыдущая(), не должен туда попасть:
  // серия обходит только идентификаторы недель, которые сама и вычисляет.
  assert.equal(серия({ 'мусор': 5, '2026-W34': 10 }, ДАТА), 1);
});

test('серия считает пятьдесят недель подряд через границу года', () => {
  const weeks = {};
  let id = '2026-W34';
  for (let i = 0; i < 50; i += 1) {
    weeks[id] = 1;
    id = предыдущая(id);
  }
  assert.equal(серия(weeks, ДАТА), 50);
});
