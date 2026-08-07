import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOverrides, loadLesson, loadCourse, clearContentCache } from '../js/content.js';

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

function fakeFetch(files) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (!(url in files)) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => files[url] };
  };
  fn.calls = calls;
  return fn;
}

test('loadLesson читает файл урока по идентификатору', async () => {
  clearContentCache();
  const fetchFn = fakeFetch({
    './content/lessons/5-priznaki-zhivogo.json': { id: '5-priznaki-zhivogo', title: 'Признаки живого' },
  });
  const lesson = await loadLesson('5-priznaki-zhivogo', { fetchFn });
  assert.equal(lesson.title, 'Признаки живого');
});

test('loadLesson кеширует результат и не ходит в сеть дважды', async () => {
  clearContentCache();
  const fetchFn = fakeFetch({
    './content/lessons/5-priznaki-zhivogo.json': { id: '5-priznaki-zhivogo', title: 'Признаки живого' },
  });
  await loadLesson('5-priznaki-zhivogo', { fetchFn });
  await loadLesson('5-priznaki-zhivogo', { fetchFn });
  assert.equal(fetchFn.calls.length, 1);
});

test('loadLesson накладывает правки', async () => {
  clearContentCache();
  const fetchFn = fakeFetch({
    './content/lessons/5-priznaki-zhivogo.json': { id: '5-priznaki-zhivogo', title: 'Старое', body: 'Текст' },
  });
  const lesson = await loadLesson('5-priznaki-zhivogo', {
    fetchFn,
    overrides: { title: 'Новое' },
  });
  assert.equal(lesson.title, 'Новое');
  assert.equal(lesson.body, 'Текст');
});

test('loadLesson на несуществующем уроке бросает понятную ошибку', async () => {
  clearContentCache();
  const fetchFn = fakeFetch({});
  await assert.rejects(
    () => loadLesson('нет-такого', { fetchFn }),
    /Урок не найден: нет-такого/,
  );
});

test('loadLesson отвергает идентификатор с посторонними символами', async () => {
  clearContentCache();
  const fetchFn = fakeFetch({});
  await assert.rejects(
    () => loadLesson('../../secret', { fetchFn }),
    /Недопустимый идентификатор урока/,
  );
  assert.equal(fetchFn.calls.length, 0);
});

test('loadCourse читает файл курса класса', async () => {
  clearContentCache();
  const fetchFn = fakeFetch({
    './content/courses/5.json': { grade: 5, sections: [] },
  });
  const course = await loadCourse('5', { fetchFn });
  assert.equal(course.grade, 5);
});

test('loadCourse отвергает несуществующий класс', async () => {
  clearContentCache();
  const fetchFn = fakeFetch({});
  await assert.rejects(() => loadCourse('99', { fetchFn }), /Недопустимый класс/);
  assert.equal(fetchFn.calls.length, 0);
});
