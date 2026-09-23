import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  запомнитьВозврат, взятьВозврат, сохранитьЧерновик, прочитатьЧерновик, стеретьЧерновик,
  стеретьЧерновики,
} from '../../js/auth/vozvrat.js';

function память() {
  const м = new Map();
  return {
    get length() { return м.size; },
    key: (i) => [...м.keys()][i] ?? null,
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

/*
  Черновик пишется на каждый ответ, поэтому на общем компьютере он живёт
  дольше одной попытки. Выход из своего имени обязан унести его с собой:
  иначе следующий вошедший увидит в бланке чужие галочки — и, что хуже,
  сможет сдать их как свои.
*/
test('выход стирает черновики всех уроков, но не трогает остальное', () => {
  const storage = память();
  сохранитьЧерновик('6-vidy-korney', { q1: 0 }, { storage });
  сохранитьЧерновик('9-spinnoy-mozg', { q2: [1, 3] }, { storage });
  запомнитьВозврат('#/lesson/9-spinnoy-mozg/homework', { storage });
  storage.setItem('bio-progress', 'чужие баллы');

  стеретьЧерновики({ storage });

  assert.equal(прочитатьЧерновик('6-vidy-korney', { storage }), null);
  assert.equal(прочитатьЧерновик('9-spinnoy-mozg', { storage }), null);
  assert.equal(storage.getItem('bio-progress'), 'чужие баллы', 'стёрто лишнее');
  assert.equal(взятьВозврат({ storage }), '#/lesson/9-spinnoy-mozg/homework', 'возврат не черновик');
});

test('стирание черновиков не падает на сломанном хранилище', () => {
  const storage = {
    get length() { throw new Error('нет'); },
    key() { throw new Error('нет'); },
    getItem() { throw new Error('нет'); },
    setItem() { throw new Error('нет'); },
    removeItem() { throw new Error('нет'); },
  };
  assert.doesNotThrow(() => стеретьЧерновики({ storage }));
});
