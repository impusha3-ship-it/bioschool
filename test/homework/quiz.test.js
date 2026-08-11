import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDocument } from '../helpers/fake-dom.js';
import { createQuiz } from '../../js/homework/quiz.js';

/*
  Тренажёр ВПР. Главное свойство — результат никуда не идёт: ошибиться здесь
  ничего не стоит, и именно поэтому сюда можно ставить задания посложнее, чем
  в домашку.
*/

/** Все узлы поддерева. Строки среди детей — это текст, а не элементы. */
function собрать(node, acc = []) {
  if (typeof node !== 'object' || node === null) return acc;
  acc.push(node);
  for (const c of node.children ?? []) собрать(c, acc);
  return acc;
}

const вопросы = [
  { id: 'a', exam: 'ВПР', type: 'choice', text: 'Раз', options: ['Да', 'Нет'], correct: 0 },
  { id: 'b', exam: 'ВПР', type: 'short', text: 'Два', answers: ['почва'] },
  { id: 'c', type: 'open', prompt: 'Три', maxScore: 2 },
];

function собранный() {
  return createQuiz(вопросы, { document: makeFakeDocument() });
}

test('развёрнутый ответ в тренажёр не попадает: проверить его тут нечем', () => {
  const quiz = собранный();
  assert.equal(quiz.size, 2);
});

test('до проверки результата нет', () => {
  assert.equal(собранный().getResult(), null);
});

test('проверка считает верные ответы и не трогает журнал', () => {
  const quiz = собранный();
  const узлы = собрать(quiz.element);
  const входы = узлы.filter((n) => n.className === 'q__input');
  const поле = узлы.find((n) => n.className === 'q__short');
  const кнопка = узлы.find((n) => n.children?.[0] === 'Проверить');

  входы[0].listeners.change[0]();          // верный вариант
  поле.value = 'Почва ';                   // верно с точностью до регистра и пробела
  поле.listeners.input[0]();

  кнопка.listeners.click[0]();
  assert.deepEqual(quiz.getResult(), { correct: 2, total: 2 });
});

test('неотвеченный вопрос считается неверным, но разбор всё равно показывается', () => {
  const quiz = собранный();
  const узлы = собрать(quiz.element);
  узлы.find((n) => n.children?.[0] === 'Проверить').listeners.click[0]();

  assert.deepEqual(quiz.getResult(), { correct: 0, total: 2 });
  const разборы = собрать(quiz.element).filter((n) => n.className.startsWith('q__verdict'));
  assert.ok(разборы.every((р) => р.children.length > 0));
});

test('«Ещё раз» возвращает задания в исходное состояние', () => {
  const quiz = собранный();
  собрать(quiz.element).find((n) => n.children?.[0] === 'Проверить').listeners.click[0]();
  assert.ok(quiz.getResult());

  quiz.reset();
  assert.equal(quiz.getResult(), null);
  const входы = собрать(quiz.element).filter((n) => n.className === 'q__input');
  assert.ok(входы.every((в) => !в.attributes.disabled), 'после сброса отвечать снова можно');
});

test('пустой набор вопросов не роняет тренажёр', () => {
  const quiz = createQuiz([], { document: makeFakeDocument() });
  assert.equal(quiz.size, 0);
  собрать(quiz.element).find((n) => n.children?.[0] === 'Проверить').listeners.click[0]();
  assert.deepEqual(quiz.getResult(), { correct: 0, total: 0 });
});
