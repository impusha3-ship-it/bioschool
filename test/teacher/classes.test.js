import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  транслитерировать,
  разобратьСписок,
  построитьИдентификаторы,
  придуматьPin,
  createClassAdmin,
} from '../../js/teacher/classes.js';

// ── Транслитерация ───────────────────────────────────────────

test('фамилия превращается в латинский идентификатор', () => {
  assert.equal(транслитерировать('Иванов Иван'), 'ivanov-ivan');
});

test('шипящие и мягкий знак не ломают идентификатор', () => {
  assert.equal(транслитерировать('Щербакова Ольга'), 'scherbakova-olga');
  assert.equal(транслитерировать('Жужин Юрий'), 'zhuzhin-yuriy');
});

test('«ё» не теряется и не остаётся кириллицей', () => {
  assert.equal(транслитерировать('Фёдоров'), 'fedorov');
});

test('дефисные фамилии остаются одним идентификатором', () => {
  assert.equal(транслитерировать('Римская-Корсакова Анна'), 'rimskaya-korsakova-anna');
});

test('в идентификаторе не остаётся ничего, кроме латиницы, цифр и дефиса', () => {
  const id = транслитерировать('Пётр  «Первый», 2-й ');
  assert.match(id, /^[a-z0-9-]+$/);
  assert.equal(id.startsWith('-'), false);
  assert.equal(id.endsWith('-'), false);
});

// ── Разбор вставленного списка ───────────────────────────────

test('список из строк разбирается по фамилиям', () => {
  assert.deepEqual(разобратьСписок('Иванов Иван\nПетрова Мария\n'), ['Иванов Иван', 'Петрова Мария']);
});

// Нумерацию вставляют вместе с текстом из журнала, и она попала бы в имя.
test('нумерация из журнала отбрасывается', () => {
  const список = разобратьСписок('1. Иванов Иван\n2) Петрова Мария\n3 — Сидоров Пётр');
  assert.deepEqual(список, ['Иванов Иван', 'Петрова Мария', 'Сидоров Пётр']);
});

test('пустые строки и лишние пробелы не создают учеников-призраков', () => {
  assert.deepEqual(разобратьСписок('  Иванов Иван  \n\n\n   \nПетрова Мария'), ['Иванов Иван', 'Петрова Мария']);
});

test('повторы в списке отсеиваются', () => {
  assert.deepEqual(разобратьСписок('Иванов Иван\nИванов Иван'), ['Иванов Иван']);
});

test('пустой список не роняет разбор', () => {
  assert.deepEqual(разобратьСписок(''), []);
  assert.deepEqual(разобратьСписок(null), []);
});

// ── Уникальность идентификаторов ─────────────────────────────

// Два Иванова в классе — обычное дело, и второй не должен затереть первого.
test('однофамильцы получают разные идентификаторы', () => {
  const пары = построитьИдентификаторы(['Иванов Иван', 'Иванов Иван']);
  assert.deepEqual(пары.map((п) => п.id), ['ivanov-ivan', 'ivanov-ivan-2']);
});

test('идентификатор не совпадает с уже существующим в базе', () => {
  const пары = построитьИдентификаторы(['Иванов Иван'], new Set(['ivanov-ivan']));
  assert.equal(пары[0].id, 'ivanov-ivan-2');
});

test('имя без латинского следа всё равно получает идентификатор', () => {
  assert.equal(построитьИдентификаторы(['???'])[0].id, 'uchenik');
});

// ── Коды ─────────────────────────────────────────────────────

test('код — ровно четыре цифры, включая ведущие нули', () => {
  assert.equal(придуматьPin(() => 0), '0000');
  assert.equal(придуматьPin(() => 0.0001), '0001');
  assert.match(придуматьPin(), /^\d{4}$/);
});

// ── Работа с базой ───────────────────────────────────────────

function собрать() {
  const записи = [];
  const api = {
    dbPut: async (path, value) => { записи.push({ path, value }); return value; },
    dbPatch: async (path, value) => { записи.push({ path, value, patch: true }); return value; },
    dbGet: async (path) => (path.includes('/students/') ? { name: 'Иванов Иван', classId: '5a', salt: 'старая' } : null),
  };
  const admin = createClassAdmin({
    api,
    getToken: async () => 'т',
    hash: async (код, соль) => `хеш:${соль}`,
    salt: () => 'соль-' + записи.length,
    pin: () => '1234',
  });
  return { admin, записи };
}

test('класс создаётся с латинским идентификатором', async () => {
  const { admin, записи } = собрать();
  const класс = await admin.создатьКласс({ title: '5А', grade: 5 });
  assert.equal(класс.id, '5a');
  assert.match(записи[0].path, /classes\/5a$/);
  assert.deepEqual(записи[0].value, { title: '5А', grade: 5 });
});

test('ученик заводится, а его код возвращается для выдачи', async () => {
  const { admin, записи } = собрать();
  const выданные = await admin.добавитьУчеников('5a', ['Иванов Иван']);

  assert.equal(выданные[0].код, '1234');
  assert.equal(выданные[0].id, 'ivanov-ivan');
  assert.match(записи[0].path, /students\/ivanov-ivan$/);
  assert.match(записи[1].path, /secrets\/ivanov-ivan$/);
});

// Это главное свойство схемы: PIN нигде не сохраняется, только его хеш.
test('сам код в базу не попадает — только хеш', async () => {
  const { admin, записи } = собрать();
  await admin.добавитьУчеников('5a', ['Иванов Иван']);
  assert.equal(JSON.stringify(записи).includes('1234'), false);
});

test('сброс кода меняет соль и стирает старую привязку', async () => {
  const { admin, записи } = собрать();
  const результат = await admin.сброситьPin('ivanov-ivan');

  assert.equal(результат.код, '1234');
  const привязка = записи.find((з) => з.path.includes('/bindings/'));
  assert.equal(привязка.value, null, 'старое устройство больше не этот ученик');
  const ученик = записи.find((з) => з.path.includes('/students/'));
  assert.notEqual(ученик.value.salt, 'старая', 'соль должна смениться');
  assert.equal(ученик.value.name, 'Иванов Иван', 'имя не должно потеряться');
});

test('сброс кода несуществующему ученику даёт понятный отказ', async () => {
  const admin = createClassAdmin({
    api: { dbGet: async () => null },
    getToken: async () => 'т',
  });
  await assert.rejects(() => admin.сброситьPin('нет-такого'), /Такого ученика нет/);
});

// ── Переименование класса ────────────────────────────────────

/*
  Класс переименовывают чаще, чем кажется: «5А» через год становится «6А»,
  а наспех созданный класс — настоящим. Идентификатор при этом не трогается:
  он вшит в карточки учеников, и смена сломала бы им вход.
*/
test('переименование меняет название и параллель, не трогая идентификатор', async () => {
  const { admin, записи } = собрать();
  const класс = await admin.переименоватьКласс({ classId: 'test', title: '7А', grade: 7 });

  assert.equal(класс.id, 'test', 'идентификатор менять нельзя — на него ссылаются ученики');
  assert.match(записи[0].path, /classes\/test$/);
  assert.deepEqual(записи[0].value, { title: '7А', grade: 7 });
});

test('параллель сохраняется числом, а не строкой из выпадающего списка', async () => {
  const { admin, записи } = собрать();
  await admin.переименоватьКласс({ classId: 'test', title: '7А', grade: '7' });
  assert.strictEqual(записи[0].value.grade, 7);
});

test('класс без названия не сохраняется', async () => {
  const { admin, записи } = собрать();
  await assert.rejects(() => admin.переименоватьКласс({ classId: 'test', title: '  ', grade: 7 }), /название/i);
  assert.deepEqual(записи, []);
});

// ── Удаление ученика ─────────────────────────────────────────

/*
  Удаление необратимо и уносит с собой оценки, поэтому проверяется подробно:
  что стирается всё, что нигде не остаётся хвостов и что путь удаления
  укладывается в правила базы. Правила разрешают учителю писать в
  submissions только на уровне урока, а в leaderboard — на уровне ученика;
  попытка снести ветку целиком получила бы отказ уже на живой базе.
*/
function собратьСледами({ работы = { 'у1': {}, 'у2': {} }, ученик = { name: 'Иванов Иван', classId: '5a', salt: 'с' } } = {}) {
  const записи = [];
  const api = {
    dbPut: async (path, value) => { записи.push({ path, value }); return value; },
    dbPatch: async (path, value) => { записи.push({ path, value, patch: true }); return value; },
    dbGet: async (path) => {
      if (path.includes('/students/')) return ученик;
      if (path.includes('/submissions/')) return работы;
      return null;
    },
  };
  const admin = createClassAdmin({ api, getToken: async () => 'т' });
  return { admin, записи };
}

test('удаление стирает карточку, код и привязку к устройству', async () => {
  const { admin, записи } = собратьСледами();
  await admin.удалитьУченика('ivanov-ivan');

  for (const ветка of ['students', 'secrets', 'bindings']) {
    const з = записи.find((з) => з.path.endsWith(`/${ветка}/ivanov-ivan`));
    assert.ok(з, `не стёрта ветка ${ветка}`);
    assert.equal(з.value, null);
  }
});

test('работы стираются по одному уроку: ветку ученика целиком правила не дают', async () => {
  const { admin, записи } = собратьСледами({ работы: { 'у1': {}, 'у2': {} } });
  await admin.удалитьУченика('ivanov-ivan');

  const работы = записи.filter((з) => з.path.includes('/submissions/'));
  assert.deepEqual(работы.map((з) => з.path.split('/').pop()).sort(), ['у1', 'у2']);
  assert.equal(работы.every((з) => з.value === null), true);
  assert.equal(
    записи.some((з) => з.path.endsWith('/submissions/ivanov-ivan')),
    false,
    'запись прямо в ветку ученика правилами запрещена',
  );
});

test('прогресс и строка в таблице класса тоже уходят', async () => {
  const { admin, записи } = собратьСледами();
  await admin.удалитьУченика('ivanov-ivan');

  const прогресс = записи.find((з) => з.path.endsWith('/progress/ivanov-ivan'));
  assert.equal(прогресс?.value, null);
  const таблица = записи.find((з) => з.path.endsWith('/leaderboard/5a/ivanov-ivan'));
  assert.equal(таблица?.value, null, 'иначе ученик останется в соревновании класса');
});

// Карточка — единственный след, который видит учитель. Уйди она первой,
// незамеченная ошибка в середине оставила бы данные без владельца.
test('карточка ученика стирается последней', async () => {
  const { admin, записи } = собратьСледами();
  await admin.удалитьУченика('ivanov-ivan');
  assert.match(записи[записи.length - 1].path, /\/students\/ivanov-ivan$/);
});

test('удаление возвращает имя — его показывают учителю после', async () => {
  const { admin } = собратьСледами();
  assert.deepEqual(await admin.удалитьУченика('ivanov-ivan'), { id: 'ivanov-ivan', имя: 'Иванов Иван' });
});

test('ученик без единой работы удаляется без лишних запросов', async () => {
  const { admin, записи } = собратьСледами({ работы: null });
  await admin.удалитьУченика('ivanov-ivan');
  assert.equal(записи.some((з) => з.path.includes('/submissions/')), false);
});

test('удаление несуществующего ученика ничего не стирает', async () => {
  const записи = [];
  const admin = createClassAdmin({
    api: {
      dbGet: async () => null,
      dbPut: async (path, value) => { записи.push({ path, value }); },
    },
    getToken: async () => 'т',
  });
  await assert.rejects(() => admin.удалитьУченика('нет-такого'), /Такого ученика нет/);
  assert.deepEqual(записи, [], 'до записи дело доходить не должно');
});

test('без сессии ученик не удаляется', async () => {
  const admin = createClassAdmin({ api: {}, getToken: async () => null });
  await assert.rejects(() => admin.удалитьУченика('ivanov-ivan'), /войти заново/);
});

test('урок задаётся классу и открывается', async () => {
  const { admin, записи } = собрать();
  await admin.задатьУрок({ classId: '5a', lessonId: '5-priznaki-zhivogo', dueAt: 999 });
  assert.match(записи[0].path, /assignments\/5a\/5-priznaki-zhivogo$/);
  assert.equal(записи[0].value.isOpen, true);
  assert.equal(записи[0].value.dueAt, 999);
});

test('урок без срока задаётся без поля срока', async () => {
  const { admin, записи } = собрать();
  await admin.задатьУрок({ classId: '5a', lessonId: 'у' });
  assert.equal('dueAt' in записи[0].value, false);
});

// Закрыть — не значит стереть: журнал должен сохранить сданное.
test('закрытие урока не удаляет назначение', async () => {
  const { admin, записи } = собрать();
  await admin.закрытьУрок({ classId: '5a', lessonId: 'у' });
  assert.equal(записи[0].patch, true);
  assert.deepEqual(записи[0].value, { isOpen: false });
});

test('без сессии ничего не пишется', async () => {
  const admin = createClassAdmin({ api: {}, getToken: async () => null });
  await assert.rejects(() => admin.создатьКласс({ title: '5А', grade: 5 }), /войти заново/);
});
