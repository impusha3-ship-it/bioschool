import { test } from 'node:test';
import assert from 'node:assert/strict';
import { el, clear } from '../js/ui/dom.js';

// Минимальная подделка document — jsdom не нужен, проверяем только логику сборки.
function makeFakeDocument() {
  const make = (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    children: [],
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...nodes) { this.children.push(...nodes); },
  });
  return { createElement: make };
}

test('создаёт элемент с классом и текстом', () => {
  const doc = makeFakeDocument();
  const node = el('h1', { class: 'title' }, 'Признаки живого', { document: doc });
  assert.equal(node.tagName, 'H1');
  assert.equal(node.className, 'title');
  assert.equal(node.children[0], 'Признаки живого');
});

test('вкладывает дочерние элементы', () => {
  const doc = makeFakeDocument();
  const child = el('span', {}, 'внутри', { document: doc });
  const node = el('div', {}, [child], { document: doc });
  assert.equal(node.children[0], child);
});

test('пропускает null и false среди детей', () => {
  const doc = makeFakeDocument();
  const node = el('div', {}, ['раз', null, false, undefined, 'два'], { document: doc });
  assert.deepEqual(node.children, ['раз', 'два']);
});

test('произвольные атрибуты попадают в setAttribute', () => {
  const doc = makeFakeDocument();
  const node = el('a', { href: '#/class/5', 'aria-label': 'Пятый класс' }, '5', { document: doc });
  assert.equal(node.attributes.href, '#/class/5');
  assert.equal(node.attributes['aria-label'], 'Пятый класс');
});

test('clear убирает всех детей', () => {
  const node = { textContent: 'что-то', replaceChildren(...n) { this.kids = n; } };
  clear(node);
  assert.deepEqual(node.kids, []);
});
