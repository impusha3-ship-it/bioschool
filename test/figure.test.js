import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFigure, parseSvg, clearFigureCache, подогнатьХолст } from '../js/ui/figure.js';

function fakeFetch(files) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (!(url in files)) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => files[url] };
  };
  fn.calls = calls;
  return fn;
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

test('loadFigure читает файл схемы из папки картинок', async () => {
  clearFigureCache();
  const fetchFn = fakeFetch({ './img/bio/sem-priznakov.svg': SVG });
  assert.equal(await loadFigure('sem-priznakov.svg', { fetchFn }), SVG);
});

test('loadFigure кеширует и не ходит в сеть дважды', async () => {
  clearFigureCache();
  const fetchFn = fakeFetch({ './img/bio/sem-priznakov.svg': SVG });
  await loadFigure('sem-priznakov.svg', { fetchFn });
  await loadFigure('sem-priznakov.svg', { fetchFn });
  assert.equal(fetchFn.calls.length, 1);
});

test('loadFigure на отсутствующей схеме бросает понятную ошибку', async () => {
  clearFigureCache();
  await assert.rejects(
    () => loadFigure('net-shemy.svg', { fetchFn: fakeFetch({}) }),
    /Схема не найдена: net-shemy.svg/,
  );
});

// Имя схемы приходит из файла урока, который правит учитель через панель,
// поэтому оно проверяется так же строго, как идентификатор урока.
test('loadFigure отвергает выход за пределы папки и посторонние расширения', async () => {
  clearFigureCache();
  const fetchFn = fakeFetch({});
  for (const плохое of ['../../secret.svg', 'shema.svg.js', 'схема.svg', 'shema.png']) {
    await assert.rejects(
      () => loadFigure(плохое, { fetchFn }),
      /Недопустимое имя схемы/,
      `должно быть отвергнуто: ${плохое}`,
    );
  }
  assert.equal(fetchFn.calls.length, 0);
});

test('parseSvg возвращает узел для корректного файла', () => {
  const узлы = [];
  const parser = {
    parseFromString: () => ({
      documentElement: { nodeName: 'svg', querySelector: () => null },
    }),
  };
  const doc = { importNode: (node) => { узлы.push(node); return { импортирован: node }; } };
  const результат = parseSvg(SVG, { parser, doc });
  assert.equal(узлы.length, 1);
  assert.equal(результат.импортирован.nodeName, 'svg');
});

test('parseSvg возвращает null на повреждённом файле', () => {
  const parser = {
    parseFromString: () => ({
      documentElement: { nodeName: 'parsererror', querySelector: () => null },
    }),
  };
  assert.equal(parseSvg('мусор', { parser, doc: { importNode: () => ({}) } }), null);
});

test('parseSvg замечает ошибку разбора внутри документа', () => {
  const parser = {
    parseFromString: () => ({
      documentElement: { nodeName: 'svg', querySelector: (s) => (s === 'parsererror' ? {} : null) },
    }),
  };
  assert.equal(parseSvg('мусор', { parser, doc: { importNode: () => ({}) } }), null);
});

/*
  Размер схемы. Правило схем — кегль не мельче 11 единиц холста, и оно
  держится, только пока единица холста равна пикселю. Тест закрепляет обе
  границы: меньше холста никогда, больше — не более чем в 1,35 раза.
*/
function фейкSvg(viewBox) {
  return { style: {}, getAttribute: (имя) => (имя === 'viewBox' ? viewBox : null) };
}

test('подогнатьХолст не даёт схеме сжаться меньше холста', () => {
  const svg = фейкSvg('0 0 480 300');
  подогнатьХолст(svg);
  assert.equal(svg.style.minWidth, '480px');
});

test('подогнатьХолст ограничивает рост схемы', () => {
  const svg = фейкSvg('0 0 320 200');
  подогнатьХолст(svg);
  assert.equal(svg.style.maxWidth, '432px');
});

test('подогнатьХолст обходит запятые в viewBox', () => {
  const svg = фейкSvg('0,0,400,272');
  подогнатьХолст(svg);
  assert.equal(svg.style.minWidth, '400px');
});

test('подогнатьХолст молчит, если холста нет', () => {
  const svg = фейкSvg(null);
  подогнатьХолст(svg);
  assert.equal(svg.style.minWidth, undefined);
  assert.equal(svg.style.maxWidth, undefined);
});
