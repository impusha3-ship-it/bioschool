import { el } from './dom.js';

/**
 * Плашка «+15» и названия новых значков.
 *
 * Собирается отдельно от показа: узел проверяется тестом без браузера, а
 * таймер и удаление живут в `показать`, где проверять нечего.
 */
export function плашка({ добавлено = 0, значки = [] } = {}, { document: doc = globalThis.document } = {}) {
  if (!добавлено && !значки.length) return null;

  const части = [];
  if (добавлено) {
    const xp = el('p', { class: 'toast__xp' }, [], { document: doc });
    xp.textContent = `+${добавлено}`;
    части.push(xp);
  }
  for (const з of значки) {
    const строка = el('p', { class: 'toast__award' }, [], { document: doc });
    строка.textContent = з.имя;
    части.push(строка);
  }

  return el('div', { class: 'toast', role: 'status' }, части, { document: doc });
}

/** Показывает плашку и убирает её сама. Возвращает узел или null. */
export function показать(итог, { root = globalThis.document?.body, document: doc = globalThis.document, задержка = 4000 } = {}) {
  const узел = плашка(итог, { document: doc });
  if (!узел || !root) return null;
  root.append(узел);
  setTimeout(() => узел.remove?.(), задержка);
  return узел;
}
