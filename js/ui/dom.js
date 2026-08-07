/**
 * Создаёт DOM-элемент.
 * Строки среди детей вставляются как текст, не как разметка — материал урока
 * не должен иметь возможности выполнить HTML.
 *
 * el('a', { class: 'card', href: '#/class/5' }, 'Пятый класс')
 */
export function el(tag, attrs = {}, children = [], { document: doc = globalThis.document } = {}) {
  const node = doc.createElement(tag);

  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') node.className = value;
    else node.setAttribute(name, value);
  }

  const list = Array.isArray(children) ? children : [children];
  const keep = list.filter((c) => c !== null && c !== undefined && c !== false && c !== '');
  if (keep.length) node.append(...keep);

  return node;
}

/** Удаляет всё содержимое элемента. */
export function clear(node) {
  node.replaceChildren();
}
