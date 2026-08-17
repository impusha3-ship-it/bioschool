import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDocument } from '../helpers/fake-dom.js';
import { createKeyGame } from '../../js/games/key.js';

/*
  Определитель. Его смысл в том, что угадывать нечего: если честно отвечать про
  признаки образца, название получается само. Отсюда и требования к данным —
  тупик или круг в определителе ученик прочитает как «я не понял тему», а не
  как поломку, и потому такой определитель не должен даже собираться.
*/

const конфиг = {
  prompt: 'Определи растение.',
  start: '1',
  couplets: {
    1: {
      question: 'Жилкование листа',
      options: [
        { text: 'Жилки идут параллельно', go: '2' },
        { text: 'Жилки ветвятся сеткой', name: 'Берёза' },
      ],
    },
    2: {
      question: 'Стебель',
      options: [
        { text: 'Стебель полый внутри', name: 'Пшеница' },
        { text: 'Стебель плотный', name: 'Ландыш' },
      ],
    },
  },
  specimens: [
    { id: 'psh', title: 'Образец с поля', description: 'Лист узкий, жилки параллельные, стебель полый.', answer: 'Пшеница' },
    { id: 'ber', title: 'Образец из леса', description: 'Лист округлый, жилки ветвятся сеткой.', answer: 'Берёза' },
  ],
};

const собранный = (over = {}) => createKeyGame({ ...конфиг, ...over }, { document: makeFakeDocument() });

/** Все узлы поддерева. Строки среди детей — это текст, а не элементы. */
function узлы(node, acc = []) {
  if (typeof node !== 'object' || node === null) return acc;
  acc.push(node);
  for (const c of node.children ?? []) узлы(c, acc);
  return acc;
}

function текст(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return [node.textContent ?? '', ...(node.children ?? []).map(текст)].join(' ');
}

/* ── Что не должно собираться ─────────────────────────────── */

test('определитель без пар не собирается', () => {
  assert.throws(() => собранный({ couplets: {} }), /хотя бы одна пара/);
});

test('пара не из двух утверждений не собирается: определитель на то и парный', () => {
  assert.throws(
    () => собранный({
      couplets: { 1: { options: [{ text: 'одно', name: 'Берёза' }] } },
      specimens: [{ id: 'a', title: 'т', description: 'о', answer: 'Берёза' }],
    }),
    /ровно два/,
  );
});

test('утверждение в несуществующую пару не собирается', () => {
  assert.throws(
    () => собранный({
      couplets: { 1: { options: [{ text: 'раз', go: '9' }, { text: 'два', name: 'Берёза' }] } },
    }),
    /несуществующую пару «9»/,
  );
});

test('зациклённый определитель не собирается: из круга ученик не выйдет', () => {
  assert.throws(
    () => собранный({
      couplets: {
        1: { options: [{ text: 'раз', go: '2' }, { text: 'два', name: 'Берёза' }] },
        2: { options: [{ text: 'три', go: '1' }, { text: 'четыре', name: 'Ландыш' }] },
      },
      specimens: [{ id: 'a', title: 'т', description: 'о', answer: 'Берёза' }],
    }),
    /зациклен/,
  );
});

test('недостижимая пара не собирается: до неё не доводит ни один путь', () => {
  assert.throws(
    () => собранный({
      couplets: {
        ...конфиг.couplets,
        3: { options: [{ text: 'пять', name: 'Ель' }, { text: 'шесть', name: 'Сосна' }] },
      },
    }),
    /недостижима/,
  );
});

test('образец с недостижимым ответом не собирается', () => {
  assert.throws(
    () => собранный({
      specimens: [{ id: 'a', title: 'т', description: 'о', answer: 'Секвойя' }],
    }),
    /никогда не приводит к ответу «Секвойя»/,
  );
});

test('повторяющиеся утверждения в паре не собираются', () => {
  assert.throws(
    () => собранный({
      couplets: { 1: { options: [{ text: 'Одно и то же', name: 'Берёза' }, { text: 'одно и то же', name: 'Ландыш' }] } },
      specimens: [{ id: 'a', title: 'т', description: 'о', answer: 'Берёза' }],
    }),
    /повторяются/,
  );
});

/* ── Как он работает ──────────────────────────────────────── */

test('выбор ведёт к следующей паре, а путь остаётся на виду', () => {
  const игра = собранный();
  assert.equal(игра.getNode(), '1');

  игра.pick(0);
  assert.equal(игра.getNode(), '2');
  assert.equal(игра.getVerdict(), null);
  assert.ok(текст(игра.element).includes('Жилки идут параллельно'), 'пройденный шаг должен быть виден');
});

test('верный путь приводит к названию образца', () => {
  const игра = собранный();
  игра.pick(0);
  игра.pick(0);

  assert.deepEqual(игра.getVerdict(), { name: 'Пшеница', ok: true });
  assert.equal(игра.getResult().correct, 1);
});

/*
  Неверный признак не подсвечивается на шаге: ветка уводит к чужому названию,
  и это ровно то, что происходит у ботаника с настоящим определителем.
*/
test('неверный признак уводит к чужому названию, а не к отказу', () => {
  const игра = собранный();
  игра.pick(1); // жилки сеткой — а у образца параллельные

  assert.deepEqual(игра.getVerdict(), { name: 'Берёза', ok: false });
  const t = текст(игра.element);
  assert.ok(t.includes('Но перед тобой не он'), 'не сказано, что определитель привёл не туда');
  assert.ok(t.includes('посмотри путь выше'), 'не подсказано, где искать ошибку');
});

test('после промаха определитель проходится заново', () => {
  const игра = собранный();
  игра.pick(1);
  игра.retry();

  assert.equal(игра.getNode(), '1');
  assert.equal(игра.getVerdict(), null);
  assert.equal(текст(игра.element).includes('Жилки ветвятся сеткой  '), false, 'путь должен быть очищен');
});

test('в счёт идёт только первая попытка', () => {
  const игра = собранный();
  игра.pick(1);            // мимо
  игра.retry();
  игра.pick(0);
  игра.pick(0);            // теперь верно

  assert.deepEqual(игра.getVerdict(), { name: 'Пшеница', ok: true });
  assert.equal(игра.getResult().correct, 0, 'со второго захода образец уже не засчитывается');
  assert.equal(игра.getResult().details[0].tries, 2);
});

test('к следующему образцу переходят только после верного определения', () => {
  const игра = собранный();
  игра.pick(0);
  игра.pick(0);
  assert.equal(игра.isComplete(), false, 'образцов два, работа не закончена');

  игра.next();
  assert.equal(игра.getSpecimen(), 'ber');
  assert.equal(игра.getNode(), '1');

  игра.pick(1);
  assert.deepEqual(игра.getVerdict(), { name: 'Берёза', ok: true });
  assert.equal(игра.getResult().correct, 2);
  assert.ok(игра.isComplete());
});

test('за последним образцом следующего нет', () => {
  const игра = собранный();
  игра.pick(0); игра.pick(0); игра.next();
  assert.equal(игра.next(), false);
});

test('пояснение к образцу показывается только после верного ответа', () => {
  const с_пояснением = собранный({
    specimens: [{ ...конфиг.specimens[0], note: 'Полый стебель — примета злаков.' }],
  });
  с_пояснением.pick(1);
  assert.equal(текст(с_пояснением.element).includes('примета злаков'), false);

  с_пояснением.retry();
  с_пояснением.pick(0);
  с_пояснением.pick(0);
  assert.ok(текст(с_пояснением.element).includes('примета злаков'));
});

test('сброс возвращает к первому образцу и обнуляет счёт', () => {
  const игра = собранный();
  игра.pick(0); игра.pick(0); игра.next(); игра.pick(1);
  assert.equal(игра.getResult().correct, 2);

  игра.reset();
  assert.equal(игра.getSpecimen(), 'psh');
  assert.equal(игра.getNode(), '1');
  assert.equal(игра.getResult().correct, 0);
  assert.equal(игра.isComplete(), false);
});

test('после названия дальше выбирать нечего', () => {
  const игра = собранный();
  игра.pick(1);
  assert.equal(игра.pick(0), false, 'вердикт уже вынесен, шагать некуда');
});

test('единственный образец не показывает счётчик образцов', () => {
  const игра = собранный({ specimens: [конфиг.specimens[0]] });
  assert.equal(узлы(игра.element).some((n) => (n.textContent ?? '').startsWith('Образец 1 из')), false);
});
