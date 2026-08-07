/**
 * Показывает элементы по мере попадания в поле зрения.
 * Наблюдатель передаётся снаружи, чтобы логику можно было проверить без браузера.
 * Если IntersectionObserver недоступен, всё показывается сразу — интерфейс
 * никогда не должен оставаться невидимым из-за отсутствия украшения.
 */
export function createRevealController({
  observerFactory = defaultObserverFactory,
  rootMargin = '0px 0px -10% 0px',
  fallbackDelay = 1500,
  scheduleFallback = defaultSchedule,
} = {}) {
  let observer = null;
  let observerReported = false;
  let timer = null;
  const pending = new Set();

  if (observerFactory) {
    observer = observerFactory(handleEntries, { rootMargin });
  }

  function show(node) {
    node.classList.add('reveal--shown');
    pending.delete(node);
  }

  function handleEntries(entries) {
    observerReported = true;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      show(entry.target);
      observer?.unobserve?.(entry.target);
    }
  }

  /*
    Страховка. Если наблюдатель ни разу не отчитался — например, страница
    не композитится или окружение повело себя неожиданно, — через полторы
    секунды показываем всё, что ждёт. Невидимый текст «Главного за 30 секунд»
    куда хуже потерянной анимации: ученик просто не прочитает материал.
    Если наблюдатель отчитался хотя бы раз, он работает, и мы не вмешиваемся.
  */
  function armFallback() {
    if (timer !== null) return;
    timer = scheduleFallback(() => {
      timer = null;
      if (observerReported) return;
      for (const node of [...pending]) show(node);
    }, fallbackDelay);
  }

  return {
    observe(node) {
      if (!observer) {
        show(node);
        return;
      }
      pending.add(node);
      observer.observe(node);
      armFallback();
    },
    disconnect() {
      observer?.disconnect?.();
      pending.clear();
    },
  };
}

function defaultObserverFactory(callback, options) {
  if (typeof IntersectionObserver === 'undefined') return null;
  return new IntersectionObserver(callback, options);
}

function defaultSchedule(fn, delay) {
  return setTimeout(fn, delay);
}
