/**
 * Общее состояние для всех механик: «тапнул источник — тапнул цель».
 *
 * Движок ничего не знает про DOM и про то, что означают цели: для одной игры
 * это корзина, для другой — точка на схеме. Он хранит выбор, размещения и
 * считает результат. Подсчёт вынесен сюда специально: ошибка в нём молча
 * ставит неверные оценки, поэтому он обязан проверяться без браузера.
 *
 * items: [{ id, target }] — target это правильный ответ для этого элемента.
 */
export function createPlacementState({ items }) {
  const expected = new Map(items.map((i) => [i.id, i.target]));
  let selected = null;
  let placements = {};
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn();
  }

  return {
    getSelected: () => selected,
    getPlacements: () => ({ ...placements }),

    select(id) {
      if (!expected.has(id)) return false;
      selected = selected === id ? null : id;
      notify();
      return true;
    },

    place(target) {
      if (selected === null) return false;
      placements[selected] = target;
      selected = null;
      notify();
      return true;
    },

    /**
     * Размещает конкретный элемент, не опираясь на текущий выбор.
     * Нужно механике «label»: там в выборе может оказаться лишняя подпись,
     * о которой движок ничего не знает, и тогда состояния разъезжаются.
     */
    placeFor(id, target) {
      if (!expected.has(id)) return false;
      placements[id] = target;
      if (selected === id) selected = null;
      notify();
      return true;
    },

    /** Убирает элемент обратно, если ученик передумал. */
    remove(id) {
      if (!(id in placements)) return false;
      delete placements[id];
      notify();
      return true;
    },

    isComplete: () => items.every((i) => i.id in placements),

    getResult() {
      const details = items.map((i) => ({
        id: i.id,
        ok: placements[i.id] === expected.get(i.id),
        expected: expected.get(i.id),
        got: i.id in placements ? placements[i.id] : null,
      }));
      return {
        total: items.length,
        correct: details.filter((d) => d.ok).length,
        details,
      };
    },

    reset() {
      selected = null;
      placements = {};
      notify();
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Перемешивание — чтобы порядок вариантов не подсказывал ответ. */
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
