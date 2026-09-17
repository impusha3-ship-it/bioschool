import { test } from 'node:test';
import assert from 'node:assert/strict';
import { отпечаток, записанный, файлыСайта } from '../scripts/versiya.mjs';
import { createВерсия, перезагрузитьСвежим, ПАУЗА_МС, ПАУЗА_ПЕРЕЗАГРУЗКИ_МС } from '../js/versiya.js';

/*
  Открытая вкладка перезагружается, когда сайт обновился, — а узнаёт она об
  этом по отпечатку в version.json. Устаревший отпечаток значит, что дети с
  открытой вкладкой так и останутся на старом коде. Сборки у проекта нет,
  поэтому стережёт тест.
*/
test('отпечаток версии совпадает с файлами сайта', async () => {
  assert.equal(
    await записанный(),
    await отпечаток(),
    'отпечаток устарел — перед выкладкой запусти: node scripts/versiya.mjs',
  );
});

test('в отпечаток идут файлы сайта, а не тесты и черновики', async () => {
  const файлы = await файлыСайта();
  assert.ok(файлы.includes('index.html'));
  assert.ok(файлы.includes('js/app.js'));
  assert.ok(файлы.some((ф) => ф.startsWith('content/lessons/')));
  assert.equal(файлы.some((ф) => /^(test|scripts|docs|\.scratch)\//.test(ф)), false);
  assert.equal(файлы.includes('version.json'), false, 'отпечаток не может входить сам в себя');
});

// ── Слежение во вкладке ─────────────────────────────────────

function сеть(версии) {
  const запросы = [];
  return {
    запросы,
    fetchFn: async (адрес, настройки) => {
      запросы.push({ адрес, настройки });
      const v = версии.shift();
      if (v instanceof Error) throw v;
      return { ok: true, json: async () => ({ версия: v }) };
    },
  };
}

function память() {
  const м = new Map();
  return { getItem: (k) => м.get(k) ?? null, setItem: (k, v) => м.set(k, v) };
}

test('вкладка замечает, что сайт обновился', async () => {
  let t = 0;
  const { fetchFn } = сеть(['a', 'b']);
  const в = createВерсия({ fetchFn, now: () => t, хранилище: память() });

  await в.запомнить();
  assert.equal(в.устарела(), false);

  t += ПАУЗА_МС;
  assert.equal(await в.проверить(), true);
  assert.equal(в.устарела(), true);
});

test('версия спрашивается мимо кеша', async () => {
  const с = сеть(['a']);
  await createВерсия({ fetchFn: с.fetchFn, хранилище: память() }).запомнить();
  assert.equal(с.запросы[0].настройки.cache, 'no-store');
});

// Сеть у детей бывает медленной, и спрашивать на каждом переходе незачем.
test('чаще паузы сайт не спрашивают', async () => {
  let t = 0;
  const с = сеть(['a', 'b']);
  const в = createВерсия({ fetchFn: с.fetchFn, now: () => t, хранилище: память() });
  await в.запомнить();

  t += ПАУЗА_МС - 1;
  await в.проверить();
  assert.equal(с.запросы.length, 1);

  await в.проверить({ сразу: true });
  assert.equal(с.запросы.length, 2);
});

test('сбой сети не считается новой версией', async () => {
  let t = 0;
  const { fetchFn } = сеть(['a', new Error('нет сети')]);
  const в = createВерсия({ fetchFn, now: () => t, хранилище: память() });
  await в.запомнить();
  t += ПАУЗА_МС;
  assert.equal(await в.проверить(), false);
});

test('если версию при открытии не узнали, вкладка работает как раньше', async () => {
  const { fetchFn } = сеть([new Error('нет сети'), 'b']);
  const в = createВерсия({ fetchFn, хранилище: память() });
  await в.запомнить();
  assert.equal(await в.проверить({ сразу: true }), false);
  assert.equal(в.устарела(), false);
});

// Страховка от петли перезагрузок.
test('после перезагрузки следующая — не раньше паузы', () => {
  let t = 1_000_000;
  const хранилище = память();
  const в = createВерсия({ fetchFn: async () => ({}), now: () => t, хранилище });

  assert.equal(в.можноПерезагрузить(), true);
  в.отметитьПерезагрузку();
  t += ПАУЗА_ПЕРЕЗАГРУЗКИ_МС - 1;
  assert.equal(в.можноПерезагрузить(), false);
  t += 1;
  assert.equal(в.можноПерезагрузить(), true);
});

/*
  Обычная перезагрузка взяла бы код из кеша браузера, и вкладка открылась бы
  снова старой. Поэтому свои файлы сперва запрашиваются мимо кеша, а чужие
  (база, шрифты) не трогаются.
*/
test('перед перезагрузкой свои файлы обновляются в кеше', async () => {
  const запрошено = [];
  let перезагружено = false;
  const win = {
    location: { origin: 'https://site', reload: () => { перезагружено = true; } },
    performance: {
      getEntriesByType: () => [
        { name: 'https://site/bioschool/js/app.js' },
        { name: 'https://site/bioschool/css/base.css?x=1' },
        { name: 'https://site/bioschool/content/lessons/5-griby.json' },
        { name: 'https://site/bioschool/img/foto.jpg' },
        { name: 'https://db.firebase.example/x.json' },
      ],
    },
  };
  await перезагрузитьСвежим({
    win,
    fetchFn: async (адрес, настройки) => { запрошено.push([адрес, настройки.cache]); },
  });

  assert.deepEqual(запрошено.map(([а]) => а).sort(), [
    'https://site/bioschool/content/lessons/5-griby.json',
    'https://site/bioschool/css/base.css',
    'https://site/bioschool/js/app.js',
  ]);
  assert.ok(запрошено.every(([, кеш]) => кеш === 'reload'));
  assert.equal(перезагружено, true);
});

test('медленная сеть не держит перезагрузку', async () => {
  let перезагружено = false;
  await перезагрузитьСвежим({
    win: {
      location: { origin: 'https://site', reload: () => { перезагружено = true; } },
      performance: { getEntriesByType: () => [{ name: 'https://site/js/app.js' }] },
    },
    fetchFn: () => new Promise(() => {}),
    ждатьМс: 5,
  });
  assert.equal(перезагружено, true);
});
