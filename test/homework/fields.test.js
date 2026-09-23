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

/*
  Разбор сданной работы. Ученику показывают не пустой бланк с вердиктом, а его
  собственный ответ: «неверно» без того, что ты сам написал, ничего не говорит
  и ничему не учит, а переписать работу уже нельзя — разбор и есть вся её польза.
*/
test('в разборе стоит тот вариант, который ученик выбрал', () => {
  const { element } = questionField(выбор, { q1: 2 }, { document: document(), disabled: true });
  const входы = собрать(element).filter((n) => n.className === 'q__input');

  assert.deepEqual(входы.map((в) => Boolean(в.checked)), [false, false, true]);
});

test('в разборе множественного выбора отмечено всё, что отметил ученик', () => {
  const q = { id: 'q6', type: 'multi', text: 'Отметь верное', options: ['А', 'Б', 'В'], correct: [0, 1] };
  const { element } = questionField(q, { q6: [0, 2] }, { document: document(), disabled: true });
  const входы = собрать(element).filter((n) => n.className === 'q__input');

  assert.deepEqual(входы.map((в) => Boolean(в.checked)), [true, false, true]);
});

test('в разборе короткого ответа стоит написанное слово', () => {
  const q = { id: 'q7', type: 'short', text: 'Что это?', answers: ['клетка'] };
  const { element } = questionField(q, { q7: 'клетка ' }, { document: document(), disabled: true });
  const поле = собрать(element).find((n) => n.className === 'q__short');

  assert.equal(поле.value, 'клетка ');
});

test('развёрнутый ответ в разборе виден целиком', () => {
  const q = { id: 'q8', type: 'open', prompt: 'Опиши опыт', maxScore: 3 };
  const { element } = questionField(q, { q8: 'Хлеб заплесневел' }, { document: document(), disabled: true });
  const поле = собрать(element).find((n) => n.className === 'q__open');

  assert.equal(поле.value, 'Хлеб заплесневел');
});

// Пустой свод ответов — обычный бланк: подстановка не должна ничего выдумывать.
test('без сохранённого ответа поля остаются пустыми', () => {
  const { element } = questionField(выбор, {}, { document: document() });
  const входы = собрать(element).filter((n) => n.className === 'q__input');

  assert.equal(входы.some((в) => в.checked), false);
});

/*
  Развёрнутому ответу вердикт не ставится и ключ ему в разборе не показывают:
  его судит человек, и до учителя никакого «верно» тут нет. На месте вердикта —
  судьба проверки.
*/
test('на месте вердикта развёрнутого ответа стоит заметка', () => {
  const q = { id: 'q9', type: 'open', prompt: 'Опиши опыт', maxScore: 3, answerKey: 'Плесень выросла' };
  const { element, showNote } = questionField(q, {}, { document: document(), disabled: true });
  const разбор = собрать(element).find((n) => n.className.startsWith('q__verdict'));

  showNote(null, { className: 'q__verdict-line', children: ['Ждёт проверки учителя'] });

  assert.equal(разбор.className, 'q__verdict q__verdict--note');
  assert.equal(разбор.children.length, 1, 'пустые узлы в разбор не идут');
  const текст = собрать(разбор).map((n) => n.children?.[0]).filter((c) => typeof c === 'string');
  assert.ok(текст.includes('Ждёт проверки учителя'));
  assert.equal(текст.includes('Плесень выросла'), false, 'ключ до проверки учителя не показывается');
});

/*
  Ключ развёрнутого задания домашки виден только учителю. Раньше он стоял в
  подсказке, и ученик читал ответ прямо под вопросом.
*/
test('ученик ключа к развёрнутому заданию не видит, учитель видит', () => {
  const q = { id: 'q10', type: 'open', prompt: 'Опиши опыт', hint: 'Подумай о влаге', answerKey: 'Плесень любит сырость', maxScore: 3 };
  const тексты = (узел) => собрать(узел).flatMap((n) => (n.children ?? []).filter((c) => typeof c === 'string'));

  const ученику = тексты(questionField(q, {}, { document: document() }).element);
  const учителю = тексты(questionField(q, {}, { document: document(), disabled: true, key: true }).element);

  assert.equal(ученику.some((т) => т.includes('Плесень любит сырость')), false);
  assert.ok(ученику.includes('Подумай о влаге'), 'подсказка ученику остаётся');
  assert.ok(учителю.includes('Ключ: Плесень любит сырость'));
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

/*
  Развёрнутое задание из настоящей работы. В домашке такой ответ смотрит
  учитель, и пометка так и говорит. В тренажёре учителя нет, зато есть ключ
  работы — и пометка должна называть источник, как у любого другого задания
  оттуда же.
*/
const развёрнутое = {
  id: 'q-open-vpr',
  exam: 'ВПР',
  source: 'ВПР 2026, вариант 4',
  vprType: '19',
  type: 'open',
  text: 'Приведи примеры двух растений своего края.',
  maxScore: 2,
  answerKey: 'В ответе названы два растения и польза каждого для человека и для сообщества.',
};

test('у развёрнутого задания из работы в пометке стоит источник', () => {
  assert.equal(пометкаУ(развёрнутое), 'ВПР 2026, вариант 4 · задание 19');
});

test('свой открытый вопрос домашки помечен «Проверяет учитель»', () => {
  assert.equal(
    пометкаУ({ id: 'q-open', type: 'open', prompt: 'Поставь опыт', maxScore: 3 }),
    'Проверяет учитель',
  );
});

test('по проверке развёрнутого задания показывается ключ, а не «Верно»', () => {
  const { element, showResult } = questionField(развёрнутое, {}, { document: document() });
  showResult(null);
  const узлы = собрать(element);

  const разбор = узлы.find((n) => String(n.className).includes('q__verdict--key'));
  assert.ok(разбор, 'ключ не показан');

  const строки = собрать(разбор).flatMap((n) => n.children ?? []).filter((c) => typeof c === 'string');
  assert.ok(строки.some((s) => s.includes('Сверь')));
  assert.ok(строки.some((s) => s.includes('два растения')));
  assert.equal(строки.includes('Верно'), false);
  assert.equal(строки.includes('Неверно'), false);
});

test('поле развёрнутого ответа после проверки закрыто от правки', () => {
  const { element, showResult } = questionField(развёрнутое, {}, { document: document() });
  showResult(null);
  const поле = собрать(element).find((n) => n.className === 'q__open');
  assert.equal(поле.attributes.disabled, 'true');
});

/*
  Вкладки урока — это адреса, и переход на «Конспект» и обратно собирает
  домашку заново. До 23 сентября 2026 ответы жили только в памяти страницы, и
  ученик, сходивший свериться с конспектом, возвращался к пустому бланку.

  Чинится это снаружи — черновиком в sessionStorage, — но поле обязано о
  каждой правке сообщать, иначе сохранять будет нечего. Проверяется поэтому
  не сохранение, а сам сигнал: он идёт из всех четырёх видов полей.
*/
test('поле сообщает о каждой правке ответа', () => {
  const позвали = [];
  const наИзменение = (ответы, id) => позвали.push([id, JSON.parse(JSON.stringify(ответы[id]))]);

  const ответы = {};
  const выборПоле = questionField(выбор, ответы, { document: document(), наИзменение });
  const входы = собрать(выборПоле.element).filter((n) => n.className === 'q__input');
  входы[2].checked = true;
  входы[2].listeners.change[0]();

  const множ = { id: 'q7', type: 'multi', text: 'Отметь верное', options: ['А', 'Б', 'В'], correct: [0, 2] };
  const множПоле = questionField(множ, ответы, { document: document(), наИзменение });
  const галки = собрать(множПоле.element).filter((n) => n.className === 'q__input');
  галки[0].checked = true;
  галки[0].listeners.change[0]();

  const короткий = { id: 'q8', type: 'short', text: 'Одним словом', answers: ['корень'] };
  const короткоеПоле = questionField(короткий, ответы, { document: document(), наИзменение });
  const строка = собрать(короткоеПоле.element).find((n) => n.className === 'q__short');
  строка.value = 'корень';
  строка.listeners.input[0]();

  const развёрнутый = { id: 'q9', type: 'open', prompt: 'Объясни', maxScore: 3 };
  const развёрнутоеПоле = questionField(развёрнутый, ответы, { document: document(), наИзменение });
  const область = собрать(развёрнутоеПоле.element).find((n) => n.className === 'q__open');
  область.value = 'мой ответ';
  область.listeners.input[0]();

  assert.deepEqual(позвали, [
    ['q1', 2],
    ['q7', [0]],
    ['q8', 'корень'],
    ['q9', 'мой ответ'],
  ]);
});

test('без слушателя поле работает как прежде, а его поломка не ломает ввод', () => {
  const ответы = {};
  const безСлушателя = questionField(выбор, ответы, { document: document() });
  const входы = собрать(безСлушателя.element).filter((n) => n.className === 'q__input');
  входы[1].checked = true;
  входы[1].listeners.change[0]();
  assert.equal(ответы.q1, 1);

  const сПоломкой = questionField(
    { ...выбор, id: 'q1b' },
    ответы,
    { document: document(), наИзменение: () => { throw new Error('хранилище недоступно'); } },
  );
  const другие = собрать(сПоломкой.element).filter((n) => n.className === 'q__input');
  другие[0].checked = true;
  assert.doesNotThrow(() => другие[0].listeners.change[0]());
  assert.equal(ответы.q1b, 0, 'ответ всё равно записан');
});
