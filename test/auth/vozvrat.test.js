import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  запомнитьВозврат, взятьВозврат, сохранитьЧерновик, прочитатьЧерновик, стеретьЧерновик,
} from '../../js/auth/vozvrat.js';

function память() {
  const м = new Map();
  return {
    getItem: (k) => (м.has(k) ? м.get(k) : null),
    setItem: (k, v) => м.set(k, String(v)),
    removeItem: (k) => м.delete(k),
  };
}

test('возврат отдаётся один раз', () => {
  const storage = память();
  запомнитьВозврат('#/lesson/8-gubki/homework', { storage });
  assert.equal(взятьВозврат({ storage }), '#/lesson/8-gubki/homework');
  assert.equal(взятьВозврат({ storage }), null);
});

test('в возврат не берётся чужой адрес', () => {
  const storage = память();
  запомнитьВозврат('https://example.com', { storage });
  assert.equal(взятьВозврат({ storage }), null);
});

test('черновик переживает повторный вход и стирается после сдачи', () => {
  const storage = память();
  сохранитьЧерновик('8-gubki', { q1: 2, o1: 'мой ответ', q2: [0, 1] }, { storage });
  assert.deepEqual(прочитатьЧерновик('8-gubki', { storage }), { q1: 2, o1: 'мой ответ', q2: [0, 1] });
  стеретьЧерновик('8-gubki', { storage });
  assert.equal(прочитатьЧерновик('8-gubki', { storage }), null);
});

test('сломанное хранилище не роняет вход', () => {
  const storage = { getItem() { throw new Error('нет'); }, setItem() { throw new Error('нет'); }, removeItem() { throw new Error('нет'); } };
  запомнитьВозврат('#/x', { storage });
  assert.equal(взятьВозврат({ storage }), null);
  сохранитьЧерновик('у', { a: 1 }, { storage });
  assert.equal(прочитатьЧерновик('у', { storage }), null);
});
