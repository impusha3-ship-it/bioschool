import { test } from 'node:test';
import assert from 'node:assert/strict';
import { плашкаПроверок } from '../../js/ui/uvedomlenie.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

const doc = () => makeFakeDocument();

/** Все узлы поддерева. Строки среди детей — это текст, а не элементы. */
function собрать(node, acc = []) {
  if (typeof node !== 'object' || node === null) return acc;
  acc.push(node);
  for (const c of node.children ?? []) собрать(c, acc);
  return acc;
}

const найти = (узел, класс) => собрать(узел).filter((n) => n.className === класс);

test('без новостей плашки нет', () => {
  assert.equal(плашкаПроверок([], { document: doc() }), null);
});

test('в плашке видно урок, балл и слово учителя', () => {
  const узел = плашкаПроверок(
    [{ lessonId: '5-griby', manualScore: 3, comment: 'Опыт поставлен как надо', метка: 7 }],
    { названия: new Map([['5-griby', 'Грибы']]), document: doc() },
  );

  const ссылка = найти(узел, 'notice__link')[0];
  assert.equal(ссылка.children[0], 'Грибы');
  assert.equal(ссылка.getAttribute('href'), '#/lesson/5-griby/homework');
  assert.match(найти(узел, 'notice__score')[0].children[0], /3$/);
  assert.equal(найти(узел, 'notice__comment')[0].children[0], 'Опыт поставлен как надо');
});

// Названия уроков грузятся отдельно и могут не приехать. Плашка из-за этого
// не должна пропадать: балл важнее красивого заголовка.
test('без названия урока плашка показывает идентификатор', () => {
  const узел = плашкаПроверок([{ lessonId: '7-vodorosli', manualScore: 1, метка: 2 }], { document: doc() });
  assert.equal(найти(узел, 'notice__link')[0].children[0], '7-vodorosli');
});

/*
  Любое касание значит «прочитал»: балл и комментарий написаны прямо в плашке,
  и к моменту нажатия ученик их уже увидел. Отдельного «отметить прочитанным»
  здесь нет намеренно — лишняя кнопка ради того, что и так произошло.
*/
test('крестик отмечает новость прочитанной', () => {
  const прочитано = [];
  const проверки = [{ lessonId: 'u1', manualScore: 2, метка: 5 }];
  const узел = плашкаПроверок(проверки, { document: doc(), onRead: (п) => прочитано.push(...п) });

  найти(узел, 'notice__close')[0].listeners.click[0]();
  assert.deepEqual(прочитано, проверки);
});

test('переход к работе тоже отмечает прочитанным', () => {
  let прочитано = null;
  const узел = плашкаПроверок([{ lessonId: 'u1', manualScore: 2, метка: 5 }], {
    document: doc(),
    onRead: (п) => { прочитано = п; },
  });

  найти(узел, 'notice__link')[0].listeners.click[0]();
  assert.equal(прочитано.length, 1);
});

test('несколько проверок собираются в одну плашку', () => {
  const узел = плашкаПроверок(
    [
      { lessonId: 'u1', manualScore: 2, метка: 9 },
      { lessonId: 'u2', manualScore: 0, метка: 8 },
    ],
    { document: doc() },
  );
  assert.equal(найти(узел, 'notice__row').length, 2);
});
