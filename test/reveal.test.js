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

test('страховка показывает всё, если наблюдатель ни разу не отчитался', () => {
  let fire = null;
  const controller = createRevealController({
    observerFactory: () => ({ observe() {}, unobserve() {}, disconnect() {} }),
    scheduleFallback: (fn) => {
      fire = fn;
      return 1;
    },
  });

  const a = fakeElement();
  const b = fakeElement();
  controller.observe(a);
  controller.observe(b);

  assert.ok(!a.has('reveal--shown'), 'до срабатывания страховки показывать рано');
  fire();
  assert.ok(a.has('reveal--shown'), 'страховка обязана показать текст');
  assert.ok(b.has('reveal--shown'));
});

test('страховка молчит, если наблюдатель уже работает', () => {
  let fire = null;
  let saved = null;
  const controller = createRevealController({
    observerFactory: (cb) => {
      saved = cb;
      return { observe() {}, unobserve() {}, disconnect() {} };
    },
    scheduleFallback: (fn) => {
      fire = fn;
      return 1;
    },
  });

  const видимый = fakeElement();
  const ниже = fakeElement();
  controller.observe(видимый);
  controller.observe(ниже);

  // Наблюдатель отчитался: видимый пересёкся, нижний пока нет.
  saved([
    { target: видимый, isIntersecting: true },
    { target: ниже, isIntersecting: false },
  ]);

  fire();

  assert.ok(видимый.has('reveal--shown'));
  assert.ok(!ниже.has('reveal--shown'), 'наблюдатель жив — страховка не должна вмешиваться');
});

test('страховка ставится один раз на всю пачку элементов', () => {
  let calls = 0;
  const controller = createRevealController({
    observerFactory: () => ({ observe() {}, unobserve() {}, disconnect() {} }),
    scheduleFallback: () => {
      calls += 1;
      return 1;
    },
  });

  controller.observe(fakeElement());
  controller.observe(fakeElement());
  controller.observe(fakeElement());

  assert.equal(calls, 1);
});
