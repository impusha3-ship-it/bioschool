import { createPlacementState, shuffle } from './engine.js';

/**
 * «Найди пару»: тапнул слева — тапнул справа.
 * Правый столбец перемешан, иначе порядок сам выдаёт ответы.
 * Применение: термин и определение, орган и функция, животное и среда.
 */
export function createMatchGame(config, { document: doc = globalThis.document, random = Math.random } = {}) {
  const pairs = config.pairs ?? [];
  if (!pairs.length) throw new Error('Игре «match» нужны пары');

  const state = createPlacementState({
    items: pairs.map((p) => ({ id: p.id, target: p.id })),
  });

  const byId = new Map(pairs.map((p) => [p.id, p]));
  const rightOrder = shuffle(pairs.map((p) => p.id), random);

  const element = doc.createElement('div');
  element.className = 'game game--match';

  const columns = doc.createElement('div');
  columns.className = 'game__columns';

  const leftCol = doc.createElement('div');
  leftCol.className = 'game__column';
  const rightCol = doc.createElement('div');
  rightCol.className = 'game__column';

  if (config.prompt) {
    const prompt = doc.createElement('p');
    prompt.className = 'game__prompt';
    prompt.textContent = config.prompt;
    element.append(prompt);
  }
  columns.append(leftCol, rightCol);
  element.append(columns);

  function render() {
    const placements = state.getPlacements();
    const selected = state.getSelected();
    const занятыеСправа = new Set(Object.values(placements));

    leftCol.replaceChildren(
      ...pairs.map((p) => {
        const btn = makeButton(p.left, selected === p.id, p.id in placements);
        btn.addEventListener('click', () => выбратьЛевое(p.id));
        return btn;
      }),
    );

    rightCol.replaceChildren(
      ...rightOrder.map((id) => {
        const btn = makeButton(byId.get(id).right, false, занятыеСправа.has(id));
        btn.addEventListener('click', () => выбратьПравое(id));
        return btn;
      }),
    );
  }

  function makeButton(text, isSelected, isUsed) {
    const btn = doc.createElement('button');
    let cls = 'game__cell';
    if (isSelected) cls += ' game__cell--selected';
    if (isUsed) cls += ' game__cell--used';
    btn.className = cls;
    btn.setAttribute('type', 'button');
    if (isSelected) btn.setAttribute('aria-pressed', 'true');
    btn.textContent = text;
    return btn;
  }

  /** Кто занял это правое. `null` — свободно. */
  function чьёПравое(id) {
    return Object.entries(state.getPlacements()).find(([, цель]) => цель === id)?.[0] ?? null;
  }

  /*
    Переставлять ответ ученик должен мочь до самой сдачи. До 19 октября 2026
    сложенную пару нельзя было разобрать никак, а одно правое могло оказаться
    сразу в двух парах: вторая ложилась поверх первой, и обе считались.

    Поэтому нажатие по сложенной паре её разбивает — и сразу берёт левое в
    руку: ученик передумал и перекладывает, а не ищет, как отменить.
  */
  function выбратьЛевое(id) {
    if (id in state.getPlacements()) state.remove(id);
    return state.select(id);
  }

  function выбратьПравое(id) {
    const чьё = чьёПравое(id);

    // Ничего не выбрано — значит, нажали по занятому, чтобы разбить пару.
    if (state.getSelected() === null) {
      if (чьё === null) return false;
      state.remove(чьё);
      return true;
    }

    // Одно правое — одной паре: прежнее сочетание уступает место.
    if (чьё !== null && чьё !== state.getSelected()) state.remove(чьё);
    return state.place(id);
  }

  state.onChange(render);
  render();

  return {
    element,
    getResult: () => state.getResult(),
    isComplete: () => state.isComplete(),
    reset: () => state.reset(),
    onChange: (fn) => state.onChange(fn),
    selectLeft: выбратьЛевое,
    selectRight: выбратьПравое,
  };
}
