import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDocument } from '../helpers/fake-dom.js';
import { createLabGame } from '../../js/games/lab.js';

/*
  Виртуальная лабораторная. Главное её свойство — неверный выбор не заканчивает
  работу: он показывает последствие и позволяет пройти шаг заново. У большинства
  учеников это единственная возможность увидеть, чем работа кончается, и
  лаборатория, закрывшаяся на третьем шаге, свою задачу не выполнит.
*/

const конфиг = {
  prompt: 'Приготовим препарат.',
  equipment: {
    prompt: 'Собери на стол нужное.',
    need: ['Микроскоп', 'Пипетка'],
    extra: ['Компас', 'Весы'],
  },
  stages: [
    {
      id: 'kaplya',
      prompt: 'Стекло протёрто. Что дальше?',
      result: 'В середине стекла капля воды.',
      options: [
        { text: 'Капнуть воды в середину', ok: true },
        { text: 'Положить кожицу на сухое стекло', result: 'Кожица свернулась и высохла.' },
      ],
    },
    {
      id: 'nakryt',
      prompt: 'Кожица в капле. Что дальше?',
      result: 'Покровное стекло легло без пузырьков.',
      options: [
        { text: 'Опустить покровное стекло с краю', ok: true },
        { text: 'Уронить покровное стекло плашмя', result: 'Под стеклом остались пузырьки воздуха.' },
      ],
    },
  ],
  outcome: { text: 'Видны клетки.', figure: 'kletka-rastitelnaya.svg' },
};

function собранная(over = {}) {
  return createLabGame({ ...конфиг, ...over }, { document: makeFakeDocument() });
}

/** Все узлы поддерева. Строки среди детей — это текст, а не элементы. */
function узлы(node, acc = []) {
  if (typeof node !== 'object' || node === null) return acc;
  acc.push(node);
  for (const c of node.children ?? []) узлы(c, acc);
  return acc;
}

/*
  Механики пишут подписи через `textContent`, а не детьми-строками, поэтому
  собирать текст надо и оттуда: подделка document эти два способа не сводит,
  в отличие от настоящего DOM.
*/
function текст(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return [node.textContent ?? '', ...(node.children ?? []).map(текст)].join(' ');
}

test('работа без шагов не собирается', () => {
  assert.throws(
    () => createLabGame({ stages: [] }, { document: makeFakeDocument() }),
    /хотя бы один шаг/,
  );
});

test('шаг с двумя верными вариантами не собирается', () => {
  assert.throws(
    () => createLabGame(
      { stages: [{ id: 'a', prompt: '?', options: [{ text: 'раз', ok: true }, { text: 'два', ok: true }] }] },
      { document: makeFakeDocument() },
    ),
    /ровно один/,
  );
});

test('неверный вариант без последствия не собирается: молчаливая ошибка ничему не учит', () => {
  assert.throws(
    () => createLabGame(
      { stages: [{ id: 'a', prompt: '?', options: [{ text: 'раз', ok: true }, { text: 'два' }] }] },
      { document: makeFakeDocument() },
    ),
    /нет последствия/,
  );
});

test('пока оборудование не собрано, работа не начата', () => {
  const игра = собранная();
  assert.equal(игра.getStep(), -1);
  assert.equal(игра.choose('kaplya', 'Капнуть воды в середину'), false, 'выбор до начала работы не должен проходить');
});

test('верно собранный стол так и оценивается', () => {
  const игра = собранная();
  игра.putOnTable('Микроскоп');
  игра.putOnTable('Пипетка');
  assert.equal(игра.checkEquipment(), true);
  assert.ok(текст(игра.element).includes('Стол собран верно'));
});

test('разбор стола называет и забытое, и лишнее', () => {
  const игра = собранная();
  игра.putOnTable('Микроскоп');
  игра.putOnTable('Компас');
  assert.equal(игра.checkEquipment(), false);

  const t = текст(игра.element);
  assert.ok(t.includes('Не хватает: Пипетка'), 'забытое не названо');
  assert.ok(t.includes('Лишнее на столе: Компас'), 'лишнее не названо');
});

test('ошибка в наборе не запирает работу', () => {
  const игра = собранная();
  игра.checkEquipment();
  игра.startWork();
  assert.equal(игра.getStep(), 0);
});

test('верный выбор продвигает шаг и дописывает сделанное', () => {
  const игра = собранная();
  игра.startWork();

  assert.equal(игра.choose('kaplya', 'Капнуть воды в середину'), true);
  assert.equal(игра.getStep(), 1);
  assert.ok(текст(игра.element).includes('В середине стекла капля воды.'));
});

test('неверный выбор показывает последствие, но шаг остаётся', () => {
  const игра = собранная();
  игра.startWork();

  assert.equal(игра.choose('kaplya', 'Положить кожицу на сухое стекло'), false);
  assert.equal(игра.getStep(), 0, 'работа не должна уходить вперёд');
  assert.ok(текст(игра.element).includes('Кожица свернулась и высохла.'), 'последствие не показано');

  // Отвергнутый вариант больше не нажать, а верный по-прежнему доступен.
  const варианты = узлы(игра.element).filter((n) => n.className.startsWith('lab-run__option'));
  const отпавший = варианты.find((n) => n.textContent === 'Положить кожицу на сухое стекло');
  assert.equal(отпавший.className, 'lab-run__option lab-run__option--out');
  assert.ok(отпавший.attributes.disabled);

  assert.equal(игра.choose('kaplya', 'Капнуть воды в середину'), true, 'после ошибки шаг должен проходиться');
});

test('объяснение остаётся на виду, пока идёт тот же шаг', () => {
  const игра = собранная();
  игра.startWork();
  игра.choose('kaplya', 'Положить кожицу на сухое стекло');
  игра.choose('kaplya', 'Положить кожицу на сухое стекло'); // повторный тап не должен ничего ломать

  const заметки = узлы(игра.element).filter((n) => n.className === 'lab-run__note lab-run__note--miss');
  assert.equal(заметки.length, 1, 'одно и то же последствие не должно дублироваться');
});

test('в счёт идут только шаги, взятые с первой попытки', () => {
  const игра = собранная();
  игра.startWork();
  игра.choose('kaplya', 'Положить кожицу на сухое стекло');
  игра.choose('kaplya', 'Капнуть воды в середину');
  игра.choose('nakryt', 'Опустить покровное стекло с краю');

  const итог = игра.getResult();
  assert.equal(итог.total, 2);
  assert.equal(итог.correct, 1);
  assert.equal(итог.details[0].misses, 1);
  assert.equal(итог.details[1].misses, 0);
  assert.ok(игра.isComplete());
});

test('в конце показывается, что получилось увидеть', () => {
  const игра = собранная();
  игра.startWork();
  игра.choose('kaplya', 'Капнуть воды в середину');
  игра.choose('nakryt', 'Опустить покровное стекло с краю');

  const t = текст(игра.element);
  assert.ok(t.includes('Работа выполнена'));
  assert.ok(t.includes('Видны клетки.'), 'результат работы не показан');
  assert.ok(t.includes('с первой попытки'));
});

test('пройденное до конца сбрасывается в исходное состояние', () => {
  const игра = собранная();
  игра.startWork();
  игра.choose('kaplya', 'Капнуть воды в середину');
  игра.choose('nakryt', 'Опустить покровное стекло с краю');
  assert.ok(игра.isComplete());

  игра.reset();
  assert.equal(игра.getStep(), -1, 'сброс должен вернуть и к сбору оборудования');
  assert.equal(игра.isComplete(), false);
  assert.equal(игра.getResult().correct, 0);
});

test('работа без этапа оборудования начинается сразу с первого шага', () => {
  const игра = собранная({ equipment: undefined });
  assert.equal(игра.getStep(), 0);
  assert.equal(игра.choose('kaplya', 'Капнуть воды в середину'), true);
});

test('незаконченная работа не засчитывает последний шаг', () => {
  const игра = собранная({ equipment: undefined });
  игра.choose('kaplya', 'Капнуть воды в середину');
  assert.equal(игра.getResult().correct, 1);
  assert.equal(игра.isComplete(), false);
});
