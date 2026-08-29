import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/router.js';

test('пустой хеш ведёт на главную', () => {
  assert.deepEqual(parseRoute(''), { name: 'home', params: {} });
  assert.deepEqual(parseRoute('#'), { name: 'home', params: {} });
  assert.deepEqual(parseRoute('#/'), { name: 'home', params: {} });
});

test('страница класса', () => {
  assert.deepEqual(parseRoute('#/class/5'), { name: 'class', params: { grade: '5' } });
});

test('лишние слэши не мешают', () => {
  assert.deepEqual(parseRoute('#//class/5/'), { name: 'class', params: { grade: '5' } });
});

test('урок без указания вкладки открывает конспект', () => {
  assert.deepEqual(parseRoute('#/lesson/5-priznaki-zhivogo'), {
    name: 'lesson',
    params: { lessonId: '5-priznaki-zhivogo', tab: 'summary' },
  });
});

test('урок с указанием вкладки', () => {
  assert.deepEqual(parseRoute('#/lesson/5-priznaki-zhivogo/homework'), {
    name: 'lesson',
    params: { lessonId: '5-priznaki-zhivogo', tab: 'homework' },
  });
});

test('несуществующая вкладка откатывается на конспект', () => {
  assert.deepEqual(parseRoute('#/lesson/5-priznaki-zhivogo/выдумка'), {
    name: 'lesson',
    params: { lessonId: '5-priznaki-zhivogo', tab: 'summary' },
  });
});

test('страница источников', () => {
  assert.deepEqual(parseRoute('#/sources'), { name: 'sources', params: {} });
});

test('неизвестный адрес даёт notfound и сохраняет путь', () => {
  assert.deepEqual(parseRoute('#/чепуха/тут'), {
    name: 'notfound',
    params: { path: 'чепуха/тут' },
  });
});

test('класс без номера — не маршрут класса', () => {
  assert.equal(parseRoute('#/class').name, 'notfound');
});

test('урок без идентификатора — не маршрут урока', () => {
  assert.equal(parseRoute('#/lesson').name, 'notfound');
});

test('свой прогресс — отдельный маршрут', () => {
  assert.deepEqual(parseRoute('#/me'), { name: 'me', params: {} });
});

test('у панели учителя есть вид «прогресс»', () => {
  assert.deepEqual(parseRoute('#/teacher/progress'), { name: 'teacher', params: { view: 'progress' } });
});
