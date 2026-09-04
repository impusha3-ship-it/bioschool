import { test } from 'node:test';
import assert from 'node:assert/strict';
import { разборУченика, названиеВида } from '../../js/pages/teacher-progress.js';

const КУРСЫ = {
  5: { grade: 5, sections: [{ id: 'r1', title: 'Раздел', lessons: [
    { id: '5-griby', title: 'Грибы' }, { id: '5-kletka', title: 'Клетка' }] }] },
  7: { grade: 7, sections: [{ id: 'r1', title: 'Раздел', lessons: [
    { id: '7-sistematika-rasteniy', title: 'Систематика растений' }] }] },
};

const СОСТОЯНИЕ = {
  lessons: {
    '7-sistematika-rasteniy': { game0: 15, vpr: 10, homework: 30, done: true },
    '5-griby': { game0: 10, vpr: 8 },
    '5-kletka': { key0: 15, lab: 20 },
  },
};

const разбор = (состояние = СОСТОЯНИЕ) => разборУченика({ состояние, курсы: КУРСЫ, grade: 7 });

test('баллы разложены по урокам и видам работы', () => {
  const урок = разбор().свои[0];
  assert.equal(урок.title, 'Систематика растений');
  assert.equal(урок.xp, 55);
  assert.deepEqual(урок.виды, [
    { имя: 'Игра', xp: 15 },
    { имя: 'Тренажёр ВПР', xp: 10 },
    { имя: 'Домашняя работа', xp: 30 },
  ]);
});

/*
  Уроки чужих классов вынесены отдельно ради одного вопроса, который и
  породил этот экран: откуда у ученика баллы, если по своему классу он
  прошёл всего два урока. Ответ виден, только когда чужое не смешано со своим.
*/
test('уроки чужих классов лежат отдельно и помечены классом', () => {
  const { свои, чужие } = разбор();
  assert.deepEqual(свои.map((у) => у.id), ['7-sistematika-rasteniy']);
  assert.deepEqual(чужие.map((у) => у.id).sort(), ['5-griby', '5-kletka']);
  assert.equal(чужие.every((у) => у.grade === '5'), true);
});

test('итог сходится с суммой по урокам', () => {
  const р = разбор();
  const сумма = [...р.свои, ...р.чужие].reduce((n, у) => n + у.xp, 0);
  assert.equal(р.всего, сумма);
  assert.equal(р.всего, 55 + 18 + 35);
});

test('в своём и чужом уроки идут от дорогих к дешёвым', () => {
  const { чужие } = разбор();
  assert.deepEqual(чужие.map((у) => у.xp), [35, 18]);
});

// Урок мог быть удалён или переименован: разбор всё равно должен показать
// баллы, иначе они просто исчезнут с экрана и сумма не сойдётся.
test('урок, которого нет в курсе, показывается по идентификатору', () => {
  const р = разборУченика({
    состояние: { lessons: { '5-nesushchestvuyushchiy': { game0: 10 } } },
    курсы: КУРСЫ,
    grade: 7,
  });
  assert.equal(р.чужие[0].title, '5-nesushchestvuyushchiy');
  assert.equal(р.всего, 10);
});

test('пустое состояние даёт пустой разбор', () => {
  const р = разборУченика({ состояние: {}, курсы: КУРСЫ, grade: 7 });
  assert.deepEqual([р.всего, р.свои, р.чужие], [0, [], []]);
});

test('признак пройденности за балл не считается', () => {
  const р = разборУченика({
    состояние: { lessons: { '7-sistematika-rasteniy': { done: true } } },
    курсы: КУРСЫ, grade: 7,
  });
  assert.equal(р.всего, 0);
  assert.deepEqual(р.свои[0].виды, []);
});

test('виды работы названы по-человечески', () => {
  assert.equal(названиеВида('game0'), 'Игра');
  assert.equal(названиеВида('game1'), 'Игра');
  assert.equal(названиеВида('key0'), 'Определитель');
  assert.equal(названиеВида('lab'), 'Лабораторная');
  assert.equal(названиеВида('vpr'), 'Тренажёр ВПР');
  assert.equal(названиеВида('homework'), 'Домашняя работа');
  assert.equal(названиеВида('что-то новое'), 'что-то новое');
});
