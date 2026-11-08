import { createPlacementState, shuffle } from './engine.js';
import { loadFigure, parseSvg } from '../ui/figure.js';

/**
 * «Подпиши схему»: тапнул подпись — тапнул точку на рисунке.
 * Точки расположены в процентах от размера схемы, поэтому картинка
 * масштабируется под любой экран, а попадания не съезжают.
 *
 * Лишние подписи (distractors) участвуют в выборе, но в счёт не входят:
 * их задача — не дать угадать методом исключения.
 */
export function createLabelGame(config, { document: doc = globalThis.document, random = Math.random } = {}) {
  const targets = config.targets ?? [];
  if (!config.image) throw new Error('Игре «label» нужна схема');
  if (!targets.length) throw new Error('Игре «label» нужны точки на схеме');

  const state = createPlacementState({
    items: targets.map((t) => ({ id: t.id, target: t.id })),
  });

  const labels = [
    ...targets.map((t) => ({ id: t.id, text: t.label, real: true })),
    ...(config.distractors ?? []).map((text, i) => ({ id: `distractor-${i}`, text, real: false })),
  ];
  const byLabelId = new Map(labels.map((l) => [l.id, l]));
  const order = shuffle(labels.map((l) => l.id), random);

  let selectedLabel = null;
  const pointNodes = [];

  const element = doc.createElement('div');
  element.className = 'game game--label';

  const stage = doc.createElement('div');
  stage.className = 'game__stage';

  const bank = doc.createElement('div');
  bank.className = 'game__bank';

  if (config.prompt) {
    const prompt = doc.createElement('p');
    prompt.className = 'game__prompt';
    prompt.textContent = config.prompt;
    element.append(prompt);
  }
  element.append(stage, bank);

  // Схема грузится асинхронно; точки рисуются сразу поверх места под неё.
  loadFigure(config.image)
    .then((text) => {
      const svg = parseSvg(text);
      if (!svg) return;
      // Схеме нужен и класс конспекта: цвета всех схем описаны для него, и без
      // него рисунок в игре остаётся без заливок, то есть чёрным силуэтом.
      svg.setAttribute('class', 'figure__svg game__image');
      stage.append(svg);
    })
    .catch(() => {
      const miss = doc.createElement('p');
      miss.className = 'figure__missing';
      miss.textContent = 'Схема не загрузилась.';
      stage.append(miss);
    });

  function render() {
    const placements = state.getPlacements();

    const свободные = order.filter((id) => {
      const label = byLabelId.get(id);
      return !label.real || !(id in placements);
    });

    bank.replaceChildren(
      ...свободные.map((id) => {
        const chip = doc.createElement('button');
        chip.className = selectedLabel === id ? 'game__chip game__chip--selected' : 'game__chip';
        chip.setAttribute('type', 'button');
        chip.textContent = byLabelId.get(id).text;
        chip.addEventListener('click', () => selectLabel(id));
        return chip;
      }),
    );

    const занятые = new Map(Object.entries(placements).map(([labelId, targetId]) => [targetId, labelId]));

    for (const node of pointNodes) node.remove?.();
    pointNodes.length = 0;

    for (const target of targets) {
      const point = doc.createElement('button');
      const занят = занятые.get(target.id);
      point.className = занят ? 'game__point game__point--filled' : 'game__point';
      point.setAttribute('type', 'button');
      point.setAttribute('style', `left:${target.x}%;top:${target.y}%`);
      point.textContent = занят ? byLabelId.get(занят).text : '';
      point.setAttribute(
        'aria-label',
        занят ? `${byLabelId.get(занят).text} — нажми, чтобы снять` : 'Пустая точка',
      );
      point.addEventListener('click', () => placeOnTarget(target.id));
      stage.append(point);
      pointNodes.push(point);
    }
  }

  /*
    Выбор подписи хранится здесь, а не в движке: движок знает только настоящие
    подписи, а выбрана может быть лишняя. Если бы выбор жил в движке, эти два
    состояния разъезжались бы. Поэтому размещение идёт через placeFor —
    он не опирается на то, что выбрано внутри движка.
  */
  function selectLabel(id) {
    if (!byLabelId.has(id)) return false;
    selectedLabel = selectedLabel === id ? null : id;
    render();
    return true;
  }

  /**
   * Нажатие по точке: поставить выбранную подпись, снять стоящую или
   * заменить одну другой.
   *
   * Переставлять ответ ученик должен мочь до самой сдачи. До 19 октября
   * 2026 поставленная подпись не снималась никак: из банка она исчезала, а
   * нажатие по точке ничего не делало. Хуже того, подпись, поставленную на
   * занятую точку, движок принимал второй: прежняя оставалась засчитанной
   * на той же точке, но на схеме её уже не было — ни увидеть, ни исправить.
   */
  function placeOnTarget(targetId) {
    const стоит = Object.entries(state.getPlacements())
      .find(([, цель]) => цель === targetId)?.[0] ?? null;

    // Ничего не выбрано — значит, нажали по занятой точке, чтобы снять.
    if (selectedLabel === null) {
      if (стоит === null) return false;
      state.remove(стоит);
      render();
      return true;
    }

    if (byLabelId.get(selectedLabel).real) {
      // Вытесненная подпись возвращается в банк, а не пропадает.
      if (стоит !== null && стоит !== selectedLabel) state.remove(стоит);
      state.placeFor(selectedLabel, targetId);
    }
    selectedLabel = null;
    render();
    return true;
  }

  state.onChange(render);
  render();

  return {
    element,
    getResult: () => state.getResult(),
    isComplete: () => state.isComplete(),
    reset() {
      selectedLabel = null;
      state.reset();
      render();
    },
    onChange: (fn) => state.onChange(fn),
    selectLabel,
    placeOnTarget,
  };
}
