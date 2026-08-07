/**
 * Минимальная подделка document для тестов игр.
 * jsdom не нужен: проверяется логика игры, а не браузерная отрисовка.
 */
export function makeFakeDocument() {
  const make = (tag) => {
    const node = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      children: [],
      attributes: {},
      dataset: {},
      listeners: {},
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name.startsWith('data-')) this.dataset[name.slice(5)] = String(value);
      },
      getAttribute(name) {
        return name in this.attributes ? this.attributes[name] : null;
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
      append(...nodes) {
        this.children.push(...nodes);
      },
      replaceChildren(...nodes) {
        this.children = nodes;
      },
      addEventListener(type, fn) {
        (this.listeners[type] ??= []).push(fn);
      },
      querySelectorAll() {
        return [];
      },
    };
    return node;
  };
  return { createElement: make };
}
