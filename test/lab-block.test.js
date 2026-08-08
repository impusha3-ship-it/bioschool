import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDocument } from './helpers/fake-dom.js';
import { renderBlock } from '../js/pages/lesson.js';

/** Собирает все узлы дерева с указанным тегом. */
function allByTag(node, tag) {
  const found = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.tagName === tag.toUpperCase()) found.push(n);
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);
  return found;
}

/** Весь текст дерева одной строкой — для проверок «упоминается ли». */
function textOf(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children ?? []).map(textOf).join(' ');
}

const полный = {
  type: 'lab',
  kind: 'Лабораторная работа',
  title: 'Изучение лабораторного оборудования',
  goal: 'Узнать приборы кабинета и понять, что каждым из них измеряют.',
  equipment: ['Термометр', 'Весы', 'Мензурка'],
  steps: ['Рассмотри приборы, не беря их в руки.', 'Найди у каждого шкалу.'],
  conclusion: 'Запиши, какой прибор что измеряет.',
};

test('лабораторная работа: на месте вид, заголовок, цель и вывод', () => {
  const doc = makeFakeDocument();
  const node = renderBlock(полный, { document: doc });

  assert.equal(node.className, 'lab');
  const текст = textOf(node);
  assert.ok(текст.includes('Лабораторная работа'), 'не показан вид работы');
  assert.ok(текст.includes('Изучение лабораторного оборудования'), 'не показан заголовок');
  assert.ok(текст.includes('Узнать приборы кабинета'), 'не показана цель');
  assert.ok(текст.includes('Запиши, какой прибор'), 'не показан вывод');
});

test('оборудование идёт списком, шаги — нумерованным', () => {
  const doc = makeFakeDocument();
  const node = renderBlock(полный, { document: doc });

  const списки = allByTag(node, 'ul');
  assert.equal(списки.length, 1, 'оборудование должно быть одним маркированным списком');
  assert.equal(allByTag(списки[0], 'li').length, 3);

  const нумерованные = allByTag(node, 'ol');
  assert.equal(нумерованные.length, 1, 'шаги должны быть нумерованным списком: порядок в работе важен');
  assert.equal(allByTag(нумерованные[0], 'li').length, 2);
});

test('метка про будущий интерактив приходит из кода, а не из данных', () => {
  const doc = makeFakeDocument();
  const node = renderBlock(полный, { document: doc });

  assert.ok(textOf(node).includes('позже'), 'нет метки о том, что интерактив появится позже');
  assert.ok(
    !JSON.stringify(полный).includes('позже'),
    'метка просочилась в данные урока — её место в коде, иначе придётся вычищать из каждого файла',
  );
});

test('блок без необязательных полей отрисовывается и не выдумывает пустых узлов', () => {
  const doc = makeFakeDocument();
  const node = renderBlock(
    { type: 'lab', title: 'Наблюдение за прорастанием', steps: ['Замочи семена.'] },
    { document: doc },
  );

  assert.equal(node.className, 'lab');
  assert.ok(textOf(node).includes('Наблюдение за прорастанием'));
  assert.equal(allByTag(node, 'ul').length, 0, 'оборудования не было — списка быть не должно');
  assert.equal(allByTag(node, 'ol').length, 1);
});

test('обычные блоки конспекта отрисовываются по-прежнему', () => {
  const doc = makeFakeDocument();

  const текстовый = renderBlock({ type: 'text', heading: 'Что такое природа', body: 'Всё вокруг.' }, { document: doc });
  assert.equal(текстовый.className, 'block');
  assert.ok(textOf(текстовый).includes('Всё вокруг.'));

  const списочный = renderBlock({ type: 'list', heading: 'Методы', items: ['Наблюдение', 'Опыт'] }, { document: doc });
  assert.equal(allByTag(списочный, 'li').length, 2);
});
