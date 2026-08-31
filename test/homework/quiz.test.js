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
  {
    id: 'c',
    exam: 'ВПР',
    source: 'ВПР 2026, вариант 4',
    vprType: '19',
    type: 'open',
    text: 'Три',
    maxScore: 2,
    answerKey: 'В ответе должны быть названы два растения и польза каждого.',
    explanation: 'Годится любое растение своего края.',
  },
];

function собранный() {
  return createQuiz(вопросы, { document: makeFakeDocument() });
}

/*
  Развёрнутый ответ в тренажёре есть, но в счёт не идёт.

  Семь типов заданий настоящей работы отвечаются словами, и выбором из списка
  их не подменить: тип задания, впервые увиденный на самой работе, стоит
  ученику баллов. Значит, показать их надо — а вот судить машине нечем, и
  притворяться, что она умеет, нельзя. Поэтому такое задание показывается,
  ученик пишет ответ, а по проверке видит ключ и сверяет сам.
*/
test('развёрнутый ответ показывается, но в счёт не идёт', () => {
  const quiz = собранный();
  assert.equal(quiz.size, 2, 'считаются только задания с автопроверкой');

  const поля = собрать(quiz.element).filter((n) => n.className === 'q__open');
  assert.equal(поля.length, 1, 'поле для развёрнутого ответа не показано');
});

test('по проверке у развёрнутого ответа показан ключ, а не вердикт', () => {
  const quiz = собранный();
  const узлы = собрать(quiz.element);
  узлы.find((n) => n.children?.[0] === 'Проверить').listeners.click[0]();

  const разборы = собрать(quiz.element).filter((n) => String(n.className).startsWith('q__verdict '));
  const ключ = разборы.find((n) => n.className.includes('q__verdict--key'));

  assert.ok(ключ, 'ключа к развёрнутому ответу нет');
  const текст = собрать(ключ).flatMap((n) => n.children ?? []).filter((c) => typeof c === 'string');
  assert.ok(текст.some((t) => t.includes('Сверь')), 'не сказано, что ответ сверяют сами');
  assert.ok(
    текст.some((t) => t.includes('два растения')),
    'ключ настоящей работы не показан',
  );
  assert.equal(
    текст.some((t) => t === 'Верно' || t === 'Неверно'),
    false,
    'машина не вправе судить развёрнутый ответ',
  );
});

test('ключ к развёрнутому ответу до проверки не виден', () => {
  const quiz = собранный();
  const разборы = собрать(quiz.element).filter((n) => String(n.className).includes('q__verdict'));
  const текст = разборы.flatMap((n) => собрать(n)).flatMap((n) => n.children ?? []);
  assert.equal(текст.some((c) => typeof c === 'string' && c.includes('два растения')), false);
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

test('после проверки зовётся onChecked с результатом', () => {
  const doc = makeFakeDocument();
  const исходы = [];
  const quiz = createQuiz(вопросы, { document: doc, onChecked: (р) => исходы.push(р) });
  собрать(quiz.element).find((n) => n.children?.[0] === 'Проверить').listeners.click[0]();
  assert.deepEqual(исходы, [{ correct: 0, total: 2 }]);
});

test('после «Ещё раз» повторная проверка снова зовёт onChecked', () => {
  const doc = makeFakeDocument();
  const исходы = [];
  const quiz = createQuiz(вопросы, { document: doc, onChecked: (р) => исходы.push(р) });
  const узлы = собрать(quiz.element);

  узлы.find((n) => n.children?.[0] === 'Проверить').listeners.click[0]();
  quiz.reset();
  собрать(quiz.element).find((n) => n.children?.[0] === 'Проверить').listeners.click[0]();

  assert.equal(исходы.length, 2, 'после сброса тренажёр обязан снова сообщить о проверке');
});

/*
  Счёт считает только то, что машина проверила. Когда в наборе есть
  развёрнутые ответы, «Верно 2 из 5» при восьми заданиях на экране читается
  как потеря трёх — поэтому набор сразу говорит, что с ними будет.
*/
test('про развёрнутые ответы сказано заранее', () => {
  const узлы = собрать(собранный().element);
  const примечание = узлы.find((n) => n.className === 'quiz__note');
  assert.ok(примечание, 'нет примечания о развёрнутых ответах');
  assert.match(String(примечание.children[0]), /ключ/i);
});

test('без развёрнутых ответов примечания нет', () => {
  const quiz = createQuiz(вопросы.filter((q) => q.type !== 'open'), { document: makeFakeDocument() });
  assert.equal(собрать(quiz.element).some((n) => n.className === 'quiz__note'), false);
});
