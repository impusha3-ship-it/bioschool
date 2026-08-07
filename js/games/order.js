import { shuffle } from './engine.js';

/**
 * «Собери цепочку»: ученик тапает элементы в том порядке, в каком они идут.
 * Состояние здесь своё, а не общее: важен не выбор цели, а позиция в списке.
 * Применение: пищевые цепи, стадии развития, круги кровообращения, таксоны.
 */
export function createOrderGame(config, { document: doc = globalThis.document, random = Math.random } = {}) {
  const sequence = config.sequence ?? [];
  if (sequence.length < 2) {
    throw new Error('Игре «order» нужна цепочка хотя бы из двух элементов');
  }

  const expected = new Map(sequence.map((text, index) => [text, index]));
  const shuffled = shuffle(sequence, random);
  let picked = [];
  const listeners = new Set();

  const element = doc.createElement('div');
  element.className = 'game game--order';

  const chain = doc.createElement('ol');
  chain.className = 'game__chain';

  const bank = doc.createElement('div');
  bank.className = 'game__bank';

  if (config.prompt) {
    const prompt = doc.createElement('p');
    prompt.className = 'game__prompt';
    prompt.textContent = config.prompt;
    element.append(prompt);
  }
  element.append(chain, bank);

  function notify() {
    render();
    for (const fn of listeners) fn();
  }

  function render() {
    chain.replaceChildren(
      ...picked.map((text, index) => {
        const li = doc.createElement('li');
        li.className = 'game__chain-item';
        const btn = doc.createElement('button');
        btn.className = 'game__chip game__chip--placed';
        btn.setAttribute('type', 'button');
        btn.textContent = text;
        // Снять можно только последний: иначе цепочка рвётся посередине.
        if (index === picked.length - 1) {
          btn.addEventListener('click', () => undo());
        } else {
          btn.setAttribute('disabled', 'true');
        }
        li.append(btn);
        return li;
      }),
    );

    bank.replaceChildren(
      ...shuffled
        .filter((text) => !picked.includes(text))
        .map((text) => {
          const btn = doc.createElement('button');
          btn.className = 'game__chip';
          btn.setAttribute('type', 'button');
          btn.textContent = text;
          btn.addEventListener('click', () => pick(text));
          return btn;
        }),
    );
  }

  function pick(text) {
    if (!expected.has(text) || picked.includes(text)) return false;
    picked.push(text);
    notify();
    return true;
  }

  function undo() {
    if (!picked.length) return false;
    picked.pop();
    notify();
    return true;
  }

  render();

  return {
    element,
    pick,
    undo,
    getPicked: () => [...picked],
    isComplete: () => picked.length === sequence.length,
    reset() {
      picked = [];
      notify();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getResult() {
      const details = sequence.map((text) => {
        const got = picked.indexOf(text);
        return {
          id: text,
          ok: got === expected.get(text),
          expected: expected.get(text),
          got: got === -1 ? null : got,
        };
      });
      return {
        total: sequence.length,
        correct: details.filter((d) => d.ok).length,
        details,
      };
    },
  };
}
