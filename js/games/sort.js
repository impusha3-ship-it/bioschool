import { createPlacementState, shuffle } from './engine.js';

/**
 * «Разложи по корзинам»: тапнул объект — тапнул корзину.
 * Применение: царства живой природы, среды обитания, признаки живого и неживого.
 */
export function createSortGame(config, { document: doc = globalThis.document, random = Math.random } = {}) {
  const buckets = config.buckets ?? [];
  const items = config.items ?? [];

  if (!buckets.length || !items.length) {
    throw new Error('Игре «sort» нужны корзины и объекты');
  }

  const known = new Set(buckets.map((b) => b.id));
  for (const item of items) {
    if (!known.has(item.bucket)) {
      throw new Error(`Объект «${item.id}» отправлен в несуществующую корзину «${item.bucket}»`);
    }
  }

  const state = createPlacementState({
    items: items.map((i) => ({ id: i.id, target: i.bucket })),
  });

  const byId = new Map(items.map((i) => [i.id, i]));
  const order = shuffle(items.map((i) => i.id), random);

  const element = doc.createElement('div');
  element.className = 'game game--sort';

  const bank = doc.createElement('div');
  bank.className = 'game__bank';

  const board = doc.createElement('div');
  board.className = 'game__buckets';

  if (config.prompt) {
    const prompt = doc.createElement('p');
    prompt.className = 'game__prompt';
    prompt.textContent = config.prompt;
    element.append(prompt);
  }
  element.append(bank, board);

  function render() {
    const placements = state.getPlacements();
    const selected = state.getSelected();

    const свободные = order.filter((id) => !(id in placements));
    bank.replaceChildren(
      ...свободные.map((id) => makeChip(id, selected === id)),
    );

    board.replaceChildren(
      ...buckets.map((bucket) => {
        const box = doc.createElement('button');
        box.className = 'game__bucket';
        box.setAttribute('type', 'button');
        box.setAttribute('data-bucket', bucket.id);

        const title = doc.createElement('span');
        title.className = 'game__bucket-title';
        title.textContent = bucket.title;

        const list = doc.createElement('span');
        list.className = 'game__bucket-items';
        list.append(
          ...order
            .filter((id) => placements[id] === bucket.id)
            .map((id) => makeChip(id, selected === id, true)),
        );

        box.append(title, list);
        box.addEventListener('click', () => {
          if (state.getSelected() !== null) state.place(bucket.id);
        });
        return box;
      }),
    );
  }

  function makeChip(id, isSelected, placed = false) {
    const chip = doc.createElement('button');
    chip.className = isSelected ? 'game__chip game__chip--selected' : 'game__chip';
    chip.setAttribute('type', 'button');
    chip.setAttribute('data-item', id);
    if (isSelected) chip.setAttribute('aria-pressed', 'true');
    chip.textContent = byId.get(id).text;
    chip.addEventListener('click', (event) => {
      event?.stopPropagation?.();
      if (placed) state.remove(id);
      else state.select(id);
    });
    return chip;
  }

  state.onChange(render);
  render();

  return {
    element,
    getResult: () => state.getResult(),
    isComplete: () => state.isComplete(),
    reset: () => state.reset(),
    onChange: (fn) => state.onChange(fn),
    // Точки входа для тестов и для будущего управления с клавиатуры
    selectItem: (id) => state.select(id),
    placeInBucket: (bucketId) => state.place(bucketId),
  };
}
