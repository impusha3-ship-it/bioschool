/**
 * Показывает элементы по мере попадания в поле зрения.
 * Наблюдатель передаётся снаружи, чтобы логику можно было проверить без браузера.
 * Если IntersectionObserver недоступен, всё показывается сразу — интерфейс
 * никогда не должен оставаться невидимым из-за отсутствия украшения.
 */
export function createRevealController({
  observerFactory = defaultObserverFactory,
  rootMargin = '0px 0px -10% 0px',
} = {}) {
  let observer = null;

  if (observerFactory) {
    observer = observerFactory(handleEntries, { rootMargin });
  }

  function handleEntries(entries) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('reveal--shown');
      observer?.unobserve?.(entry.target);
    }
  }

  return {
    observe(node) {
      if (!observer) {
        node.classList.add('reveal--shown');
        return;
      }
      observer.observe(node);
    },
    disconnect() {
      observer?.disconnect?.();
    },
  };
}

function defaultObserverFactory(callback, options) {
  if (typeof IntersectionObserver === 'undefined') return null;
  return new IntersectionObserver(callback, options);
}
