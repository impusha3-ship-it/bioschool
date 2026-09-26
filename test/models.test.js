import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ГРУППЫ, ОРГАНОИДЫ } from '../js/models/kletka.js';
import { parseRoute } from '../js/router.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/*
  Сцену саму по себе тут не проверить: три.js хочет WebGL, которого в узле нет.
  Проверяется то, что ломается молча, — данные об органоидах, на которых стоит
  и список, и карточка, и пути к файлам, при опечатке в которых страница
  открывается пустой рамкой.
*/

test('каждый органоид описан целиком', () => {
  for (const [ключ, о] of Object.entries(ОРГАНОИДЫ)) {
    assert.ok(о.name, `${ключ}: нет названия`);
    assert.ok(о.short, `${ключ}: нет короткого названия для подписи`);
    assert.match(о.color, /^#[0-9a-f]{6}$/i, `${ключ}: цвет не похож на цвет`);
    assert.ok(о.type, `${ключ}: не сказано, мембранный он или нет`);
    assert.ok(о.structure?.length > 40, `${ключ}: строение описано слишком коротко`);
    assert.ok(о.functions?.length >= 2, `${ключ}: у органоида меньше двух работ в клетке`);
    for (const ф of о.functions) assert.ok(ф?.trim(), `${ключ}: пустая строка среди работ`);
  }
});

test('короткая подпись влезает в ярлык над моделью', () => {
  // Ярлыки висят поверх клетки и не переносятся: длинное название закроет
  // собой половину сцены.
  for (const [ключ, о] of Object.entries(ОРГАНОИДЫ)) {
    assert.ok(о.short.length <= 18, `${ключ}: подпись «${о.short}» слишком длинная`);
  }
});

test('список в разделе показывает все органоиды и ровно по одному разу', () => {
  const перечислены = ГРУППЫ.flatMap(([, ключи]) => ключи);
  assert.deepEqual(
    [...new Set(перечислены)].sort(),
    Object.keys(ОРГАНОИДЫ).sort(),
    'список групп разошёлся с описаниями органоидов',
  );
  assert.equal(перечислены.length, new Set(перечислены).size, 'органоид попал в две группы');
});

test('у каждой группы есть название', () => {
  for (const [название, ключи] of ГРУППЫ) {
    assert.ok(название?.trim(), 'группа без названия');
    assert.ok(ключи.length > 0, `группа «${название}» пуста`);
  }
});

test('библиотека для моделей лежит в репозитории', async () => {
  // Сайт не ходит ни к одному чужому серверу: на школьной сети cdn может быть
  // закрыт, и модель обязана открыться так же, как всё остальное.
  const страница = await readFile(join(ROOT, 'js', 'pages', 'models.js'), 'utf8');
  const пути = [...страница.matchAll(/'\.\/(js\/vendor\/[\w.-]+)'/g)].map((m) => m[1]);
  assert.ok(пути.length >= 2, 'страница моделей не подключает библиотеку');

  for (const путь of пути) {
    const сведения = await stat(join(ROOT, ...путь.split('/')));
    assert.ok(сведения.size > 1000, `${путь}: файл подозрительно мал`);
  }
});

test('ссылка в шапке ведёт в раздел моделей и подсвечивается', async () => {
  // `отметитьРаздел` сверяет имя маршрута со списком в `data-pages`. Разойдись
  // они — пункт в шапке перестал бы подсвечиваться, и заметить это можно
  // только глазами.
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const ссылка = html.match(/<a class="site-nav__link" href="#\/models" data-pages="([^"]+)"/);
  assert.ok(ссылка, 'в шапке нет ссылки на раздел моделей');
  assert.ok(
    ссылка[1].split(' ').includes(parseRoute('#/models').name),
    'data-pages не содержит имени маршрута моделей',
  );
});

test('страница моделей зарегистрирована в приложении', async () => {
  const app = await readFile(join(ROOT, 'js', 'app.js'), 'utf8');
  assert.match(app, /models: renderModelsPage/, 'маршрут models не подключён к странице');
});

test('запасной путь ведёт на существующие файл и урок', async () => {
  const страница = await readFile(join(ROOT, 'js', 'pages', 'models.js'), 'utf8');

  const картинка = страница.match(/'\.\/(img\/bio\/[\w.-]+)'/);
  assert.ok(картинка, 'в заглушке нет плоской схемы');
  await stat(join(ROOT, ...картинка[1].split('/')));

  const урок = страница.match(/'#\/lesson\/([\w-]+)'/);
  assert.ok(урок, 'заглушка не ведёт ни в какой урок');
  await stat(join(ROOT, 'content', 'lessons', `${урок[1]}.json`));
});
