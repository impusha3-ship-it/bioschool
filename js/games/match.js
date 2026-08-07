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
        btn.addEventListener('click', () => state.select(p.id));
        return btn;
      }),
    );

    rightCol.replaceChildren(
      ...rightOrder.map((id) => {
        const btn = makeButton(byId.get(id).right, false, занятыеСправа.has(id));
        btn.addEventListener('click', () => {
          if (state.getSelected() !== null) state.place(id);
        });
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

  state.onChange(render);
  render();

  return {
    element,
    getResult: () => state.getResult(),
    isComplete: () => state.isComplete(),
    reset: () => state.reset(),
    onChange: (fn) => state.onChange(fn),
    selectLeft: (id) => state.select(id),
    selectRight: (id) => state.place(id),
  };
}
