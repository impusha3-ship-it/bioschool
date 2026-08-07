import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRevealController } from '../js/ui/reveal.js';

function fakeElement() {
  const classes = new Set();
  return {
    classList: {
      add: (c) => classes.add(c),
      contains: (c) => classes.has(c),
    },
    has: (c) => classes.has(c),
  };
}

test('элемент передаётся наблюдателю, а не показывается сразу', () => {
  const observed = [];
  const controller = createRevealController({
    observerFactory: () => ({
      observe: (node) => observed.push(node),
      unobserve() {},
      disconnect() {},
    }),
  });
  const node = fakeElement();
  controller.observe(node);
  assert.equal(observed.length, 1);
  assert.equal(observed[0], node);
  assert.ok(!node.has('reveal--shown'), 'до пересечения показывать рано');
});

test('без IntersectionObserver элементы показываются сразу', () => {
  const controller = createRevealController({ observerFactory: null });
  const node = fakeElement();
  controller.observe(node);
  assert.ok(node.has('reveal--shown'), 'должен показаться без наблюдателя');
});

test('обработчик показывает только пересёкшиеся элементы', () => {
  let saved;
  const controller = createRevealController({
    observerFactory: (cb) => {
      saved = cb;
      return { observe() {}, unobserve() {}, disconnect() {} };
    },
  });
  const shown = fakeElement();
  const hidden = fakeElement();
  controller.observe(shown);
  controller.observe(hidden);

  saved([
    { target: shown, isIntersecting: true },
    { target: hidden, isIntersecting: false },
  ]);

  assert.ok(shown.has('reveal--shown'));
  assert.ok(!hidden.has('reveal--shown'));
});
