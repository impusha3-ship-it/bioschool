import { test } from 'node:test';
import assert from 'node:assert/strict';
import { плашка } from '../../js/ui/toast.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

const doc = () => makeFakeDocument();

test('без баллов и значков плашки нет', () => {
  assert.equal(плашка({ добавлено: 0, значки: [] }, { document: doc() }), null);
});

test('плашка показывает начисленное', () => {
  const узел = плашка({ добавлено: 15, значки: [] }, { document: doc() });
  assert.equal(узел.children[0].textContent, '+15');
});

test('значок называется в плашке', () => {
  const узел = плашка({ добавлено: 20, значки: [{ id: 'clean-lab', имя: 'Чистая работа' }] }, { document: doc() });
  const тексты = узел.children.map((c) => c.textContent);
  assert.equal(тексты.includes('Чистая работа'), true);
});

test('значок без баллов тоже показывается', () => {
  const узел = плашка({ добавлено: 0, значки: [{ id: 'month', имя: 'Месяц подряд' }] }, { document: doc() });
  assert.notEqual(узел, null);
});
