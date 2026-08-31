import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDocument } from '../helpers/fake-dom.js';
import { questionField, correctIndexes } from '../../js/homework/fields.js';

/*
  Поле вопроса живёт в трёх режимах, и цена ошибки у них разная. Самая дорогая —
  показать ключ тому, кто должен отвечать: тогда домашка перестаёт что-либо
  значить. Поэтому режимы проверяются отдельно и явно.
*/

const document = () => makeFakeDocument();

/** Все узлы поддерева. Строки среди детей — это текст, а не элементы. */
function собрать(node, acc = []) {
  if (typeof node !== 'object' || node === null) return acc;
  acc.push(node);
  for (const c of node.children ?? []) собрать(c, acc);
  return acc;
}

const выбор = {
  id: 'q1',
  type: 'choice',
  text: 'Сколько сред обитания?',
  options: ['Две', 'Четыре', 'Шесть'],
  correct: 1,
  explanation: 'Вода, суша с воздухом, почва и другой организм.',
};

test('в обычном режиме поля не отключены и ключа не видно', () => {
  const { element } = questionField(выбор, {}, { document: document() });
  const узлы = собрать(element);

  assert.equal(узлы.filter((n) => n.attributes.disabled).length, 0);
  assert.equal(узлы.filter((n) => n.className.includes('q__option--key')).length, 0);
});

test('в просмотре поля отключены, но ключ по-прежнему скрыт', () => {
  const { element } = questionField(выбор, {}, { document: document(), disabled: true });
  const узлы = собрать(element);

  assert.equal(узлы.filter((n) => n.attributes.disabled).length, 3);
  assert.equal(узлы.filter((n) => n.className.includes('q__option--key')).length, 0);
});

test('в просмотре с ключом помечен ровно верный вариант', () => {
  const { element } = questionField(выбор, {}, { document: document(), disabled: true, key: true });
  const ключи = собрать(element).filter((n) => n.className.includes('q__option--key'));

  assert.equal(ключи.length, 1);
  assert.equal(ключи[0].getAttribute('for'), 'q1-1');
});

test('у короткого вопроса ключ показывает годный ответ', () => {
  const q = { id: 'q2', type: 'short', text: 'Во сколько раз?', answers: ['200', 'в 200 раз'] };
  const { element } = questionField(q, {}, { document: document(), disabled: true, key: true });
  const ключ = собрать(element).find((n) => n.className === 'q__key');

  assert.equal(ключ.children[0], 'Верный ответ: 200');
});

test('развёрнутый вопрос без ключа не показывает цену в баллах', () => {
  const q = { id: 'q3', type: 'open', prompt: 'Опиши растение.', maxScore: 3 };
  const { element } = questionField(q, {}, { document: document(), disabled: true });

  assert.equal(собрать(element).some((n) => n.className === 'q__key'), false);
});

test('ответ на выбор попадает в общий свод ответов', () => {
  const ответы = {};
  const { element } = questionField(выбор, ответы, { document: document() });
  const входы = собрать(element).filter((n) => n.className === 'q__input');

  входы[2].listeners.change[0]();
  assert.equal(ответы.q1, 2);
});

test('в множественном выборе снятая галка убирает номер', () => {
  const q = { id: 'q4', type: 'multi', text: 'Отметь верное', options: ['А', 'Б', 'В'], correct: [0, 2] };
  const ответы = {};
  const { element } = questionField(q, ответы, { document: document() });
  const входы = собрать(element).filter((n) => n.className === 'q__input');

  входы[0].checked = true;
  входы[0].listeners.change[0]();
  входы[2].checked = true;
  входы[2].listeners.change[0]();
  assert.deepEqual(ответы.q4, [0, 2]);

  входы[0].checked = false;
  входы[0].listeners.change[0]();
  assert.deepEqual(ответы.q4, [2]);
});

test('разбор появляется только после проверки и объясняет, а не только судит', () => {
  const { element, showResult } = questionField(выбор, {}, { document: document() });
  const разбор = собрать(element).find((n) => n.className.startsWith('q__verdict'));

  assert.equal(разбор.children.length, 0, 'до проверки разбора быть не должно');

  showResult(false);
  const текст = собрать(разбор).map((n) => n.children?.[0]).filter((c) => typeof c === 'string');
  assert.ok(текст.includes('Неверно'));
  assert.ok(текст.includes(выбор.explanation));
});

test('после проверки верный вариант помечен, а выбранный мимо — отдельно', () => {
  const { element, showResult } = questionField(выбор, {}, { document: document() });
  const метки = собрать(element).filter((n) => n.className.startsWith('q__option'));
  const входы = собрать(element).filter((n) => n.className === 'q__input');

  входы[0].checked = true;
  showResult(false);

  assert.equal(метки[0].className, 'q__option q__option--wrong');
  assert.equal(метки[1].className, 'q__option q__option--right');
  assert.equal(метки[2].className, 'q__option');
  assert.ok(входы.every((в) => в.attributes.disabled), 'после проверки отвечать заново нельзя');
});

test('короткий ответ после ошибки показывает, каким он должен был быть', () => {
  const q = { id: 'q5', type: 'short', text: 'Сколько?', answers: ['200'] };
  const { element, showResult } = questionField(q, {}, { document: document() });
  showResult(false);

  const разбор = собрать(element).find((n) => n.className.startsWith('q__verdict'));
  const текст = собрать(разбор).map((n) => n.children?.[0]).filter((c) => typeof c === 'string');
  assert.ok(текст.includes('Верный ответ: 200'));
});

test('номера верных вариантов приводятся к одному виду', () => {
  assert.deepEqual(correctIndexes(выбор), [1]);
  assert.deepEqual(correctIndexes({ type: 'multi', correct: [2, 0, 2] }), [2, 0]);
  assert.deepEqual(correctIndexes({ type: 'short', answers: ['да'] }), []);
  assert.deepEqual(correctIndexes(undefined), []);
});

/*
  Задания ВПР бывают с рисунком: подписать, что изображено, или ответить по
  схеме. Рисунок — часть условия, поэтому его отсутствие означает не «некрасиво»,
  а «задание не решается».
*/
test('рисунок задания появляется рамкой с подписью', () => {
  const q = {
    id: 'q-fig',
    type: 'short',
    text: 'Что изображено?',
    figures: [
      { src: 'grib-celikom.svg', label: 'А' },
      { src: 'chetyre-carstva.svg', label: 'Б' },
    ],
  };
  const { element } = questionField(q, {}, { document: document() });
  const узлы = собрать(element);
  const рамки = узлы.filter((n) => n.className === 'q__figure');
  assert.equal(рамки.length, 2);
  const подписи = узлы.filter((n) => n.className === 'q__figure-label').map((n) => n.children[0]);
  assert.deepEqual(подписи, ['А', 'Б']);
});

test('без рисунков разметка не меняется', () => {
  const { element } = questionField(выбор, {}, { document: document() });
  assert.equal(собрать(element).some((n) => n.className === 'q__figures'), false);
});

test('фотография вставляется картинкой, а не разбирается как схема', () => {
  const q = {
    id: 'q-photo',
    type: 'short',
    text: 'Что изображено?',
    figures: [{ src: 'obraz-grib.jpg', label: 'А', alt: 'Белый гриб' }],
  };
  const { element } = questionField(q, {}, { document: document() });
  const img = собрать(element).find((n) => n.tagName === 'IMG');
  assert.ok(img, 'картинки нет');
  assert.equal(img.getAttribute('src'), './img/bio/obraz-grib.jpg');
  assert.equal(img.getAttribute('alt'), 'Белый гриб');
});

/*
  Номер задания в пометке. Ученик, увидевший «задание 3» рядом с годом и
  вариантом, привыкает к тому, каким номером что стоит в работе, — а это
  половина дела на самой работе. Каталожные номера старых типов сюда не идут:
  в работе ученик их не встретит.
*/
const пометкаУ = (q) => {
  const узлы = собрать(questionField(q, {}, { document: document() }).element);
  return узлы.find((n) => n.className === 'q__exam')?.children[0];
};

test('в пометке рядом с источником стоит номер задания в работе', () => {
  assert.equal(
    пометкаУ({ ...выбор, exam: 'ВПР', source: 'ВПР 2020, вариант 6', vprType: '3' }),
    'ВПР 2020, вариант 6 · задание 3',
  );
});

test('каталожный номер старого типа ученику не показывается', () => {
  assert.equal(
    пометкаУ({ ...выбор, exam: 'ВПР', source: 'ВПР 2019, вариант 8', vprType: 'Д5.1' }),
    'ВПР 2019, вариант 8',
  );
});

test('без источника номер задания не показывается', () => {
  assert.equal(пометкаУ({ ...выбор, exam: 'ВПР', vprType: '3' }), 'ВПР');
});
