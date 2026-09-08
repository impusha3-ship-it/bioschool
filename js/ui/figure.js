/**
 * Загружает схему и вставляет её в страницу как настоящий SVG-узел.
 *
 * Почему не <img src="...svg">: во внешнем документе не работают ни currentColor,
 * ни переменные темы, поэтому схема осталась бы чёрной на тёмном фоне. Инлайновый
 * SVG наследует цвета страницы и переключается вместе с ней.
 *
 * Разметка не собирается из строки через innerHTML: файл разбирается как
 * image/svg+xml и переносится узлами. Скрипты при таком разборе не выполняются,
 * а сами файлы лежат в нашем репозитории.
 */
const cache = new Map();

const FIGURE_SRC = /^[a-z0-9-]+\.svg$/;

export function clearFigureCache() {
  cache.clear();
}

export async function loadFigure(src, { fetchFn = fetch } = {}) {
  if (!FIGURE_SRC.test(String(src ?? ''))) {
    throw new Error(`Недопустимое имя схемы: ${src}`);
  }

  const url = `./img/bio/${src}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      (async () => {
        const response = await fetchFn(url);
        if (!response.ok) throw new Error(`Схема не найдена: ${src}`);
        return response.text();
      })(),
    );
  }

  try {
    return await cache.get(url);
  } catch (error) {
    cache.delete(url);
    throw error;
  }
}

/**
 * Разбирает текст SVG и возвращает готовый узел.
 * Возвращает null, если файл повреждён, — подпись под схемой тогда останется
 * и объяснит, о чём была картинка.
 */
/**
 * Ставит схеме размер по её собственному холсту.
 *
 * Правило схем — кегль не мельче 11 единиц холста, и держится оно только
 * пока единица холста равна пикселю. А `.figure__svg` растягивал любую схему
 * до 420 px: холст 480 садился до 0,87, и подпись кеглем 10 превращалась в
 * 8,7 px на ноутбуке и в 6,5 px на телефоне (померено, 375 px, 8 сентября).
 * Так рендерились все широкие схемы курса, а не только новые.
 *
 * Поэтому: меньше холста схема не показывается никогда — на узком экране её
 * прокручивают по горизонтали, — а больше растёт не более чем в `увеличение`
 * раз, иначе схема на 320 единиц в широкой колонке раздувалась бы вдвое.
 * Так у всех схем курса примерно одинаковый кегль подписи на экране.
 */
export function подогнатьХолст(svg, { увеличение = 1.35 } = {}) {
  const части = String(svg?.getAttribute?.('viewBox') ?? '').trim().split(/[\s,]+/);
  const ширина = Number(части[2]);
  if (!Number.isFinite(ширина) || ширина <= 0) return svg;
  svg.style.minWidth = `${ширина}px`;
  svg.style.maxWidth = `${Math.round(ширина * увеличение)}px`;
  return svg;
}

export function parseSvg(text, { parser = new DOMParser(), doc = document } = {}) {
  const parsed = parser.parseFromString(text, 'image/svg+xml');
  const root = parsed.documentElement;
  if (!root || root.nodeName === 'parsererror' || root.querySelector('parsererror')) {
    return null;
  }
  return doc.importNode(root, true);
}
