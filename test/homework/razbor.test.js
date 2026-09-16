import { test } from 'node:test';
import assert from 'node:assert/strict';
import { собратьРазбор } from '../../js/pages/homework.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

/*
  Разбор сданной домашней работы. Цена ошибки здесь высокая и молчаливая:
  неверный вердикт ребёнок не с чем сверить — переписать работу нельзя, ключа
  у него нет, и он поверит тому, что показано. Поэтому проверяется не «блок
  собрался», а что именно сказано про каждый вопрос.
*/

const document = () => makeFakeDocument();

/** Все узлы поддерева. Строки среди детей — это текст, а не элементы. */
function собрать(node, acc = []) {
  if (typeof node !== 'object' || node === null) return acc;
  acc.push(node);
  for (const c of node.children ?? []) собрать(c, acc);
  return acc;
}

const тексты = (узел) =>
  собрать(узел).flatMap((n) => (n.children ?? []).filter((c) => typeof c === 'string'));

const урок = {
  id: '5-griby',
  homework: {
    questions: [
      { id: 'q1', type: 'choice', text: 'Почему грибы — отдельное царство?', options: ['А', 'Б'], correct: 1 },
      { id: 'q2', type: 'short', text: 'Чем питается плесень?', answers: ['органикой'] },
    ],
    open: [{ id: 'opyt', prompt: 'Поставь опыт с плесенью', maxScore: 3 }],
  },
};

const работа = {
  submittedAt: 1,
  correct: 1,
  total: 2,
  percent: 50,
  answers: { q1: 0, q2: 'органикой' },
  open: { opyt: 'Хлеб во влажном пакете заплесневел' },
};

test('в разборе каждый вопрос получает свой вердикт', () => {
  const узел = собратьРазбор(работа, урок, { document: document() });
  const вердикты = собрать(узел).filter((n) => n.className?.startsWith('q__verdict '));

  assert.deepEqual(вердикты.map((в) => в.className), [
    'q__verdict q__verdict--wrong',
    'q__verdict q__verdict--right',
    'q__verdict q__verdict--note',
  ]);
});

test('верный ответ не объявляется неверным из-за пробела или регистра', () => {
  const узел = собратьРазбор(
    { ...работа, answers: { q1: 1, q2: ' Органикой ' } },
    урок,
    { document: document() },
  );
  const вердикты = собрать(узел).filter((n) => n.className?.startsWith('q__verdict '));

  assert.deepEqual(вердикты.slice(0, 2).map((в) => в.className), [
    'q__verdict q__verdict--right',
    'q__verdict q__verdict--right',
  ]);
});

test('неотвеченный вопрос считается ошибкой, а не пропускается', () => {
  const узел = собратьРазбор({ ...работа, answers: { q1: null, q2: null } }, урок, { document: document() });
  const вердикты = собрать(узел).filter((n) => n.className?.startsWith('q__verdict '));

  assert.equal(вердикты[0].className, 'q__verdict q__verdict--wrong');
  assert.ok(тексты(узел).includes('Верный ответ: органикой'));
});

// Пока учитель не прочитал, никакого «верно» у развёрнутого ответа нет.
test('развёрнутый ответ ждёт учителя, а не вердикта машины', () => {
  const слова = тексты(собратьРазбор(работа, урок, { document: document() }));

  assert.ok(слова.includes('Ждёт проверки учителя'));
  assert.equal(слова.some((т) => т.startsWith('Учитель поставил')), false);
});

test('проверенный развёрнутый ответ показывает балл и слово учителя', () => {
  const узел = собратьРазбор(
    { ...работа, manualScore: 2, comment: 'Опыт поставлен верно, вывода не хватило' },
    урок,
    { document: document() },
  );
  const слова = тексты(узел);

  assert.ok(слова.includes('Учитель поставил: 2 из 3'));
  assert.ok(слова.includes('Опыт поставлен верно, вывода не хватило'));
});

test('в разборе виден ответ, который ученик написал', () => {
  const узел = собратьРазбор(работа, урок, { document: document() });
  const открытое = собрать(узел).find((n) => n.className === 'q__open');

  assert.equal(открытое.value, 'Хлеб во влажном пакете заплесневел');
});

/*
  В работу от игры уходит только счёт, а ходы не сохраняются. Без оговорки
  «7 из 10» над шестью разобранными вопросами читается как пропажа четырёх.
*/
test('про игру сказано, что её разбора нет', () => {
  const сИгрой = { ...урок, game: { type: 'sort', pairs: [] } };
  const слова = тексты(собратьРазбор(работа, сИгрой, { document: document() }));

  assert.ok(слова.some((т) => т.includes('игра')));
});

test('без игры лишней оговорки не появляется', () => {
  const слова = тексты(собратьРазбор(работа, урок, { document: document() }));
  assert.equal(слова.some((т) => т.includes('Тренажёр')), false);
});

// Работы, сданные до появления разбора, ответов по вопросам не хранят.
// Показывать по ним пустой бланк с вердиктами нельзя — это враньё.
test('у старой работы без сохранённых ответов разбора нет', () => {
  assert.equal(собратьРазбор({ submittedAt: 1, percent: 50 }, урок, { document: document() }), null);
});

test('без урока разбор не собирается', () => {
  assert.equal(собратьРазбор(работа, null, { document: document() }), null);
});
