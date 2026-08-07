import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOverrides } from '../js/content.js';

test('без правок возвращается исходный объект', () => {
  const base = { title: 'Урок', body: 'Текст' };
  assert.deepEqual(applyOverrides(base, null), base);
  assert.deepEqual(applyOverrides(base, undefined), base);
  assert.deepEqual(applyOverrides(base, {}), base);
});

test('правка одного поля не затирает соседние', () => {
  const base = { title: 'Старое', body: 'Текст', tags: ['клетка'] };
  const result = applyOverrides(base, { title: 'Новое' });
  assert.deepEqual(result, { title: 'Новое', body: 'Текст', tags: ['клетка'] });
});

test('правка вложенного поля не затирает соседние внутри него', () => {
  const base = { game: { type: 'sort', title: 'Сортировка', items: [1, 2] } };
  const result = applyOverrides(base, { game: { title: 'Новое название' } });
  assert.deepEqual(result, {
    game: { type: 'sort', title: 'Новое название', items: [1, 2] },
  });
});

test('массив заменяется целиком, а не сливается поэлементно', () => {
  const base = { options: ['а', 'б', 'в'] };
  const result = applyOverrides(base, { options: ['я'] });
  assert.deepEqual(result, { options: ['я'] });
});

test('null удаляет поле', () => {
  const base = { title: 'Урок', draft: true };
  assert.deepEqual(applyOverrides(base, { draft: null }), { title: 'Урок' });
});

test('исходный объект не изменяется', () => {
  const base = { game: { title: 'Старое' } };
  applyOverrides(base, { game: { title: 'Новое' } });
  assert.equal(base.game.title, 'Старое');
});

test('новое поле добавляется', () => {
  assert.deepEqual(applyOverrides({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
});
