# Геймификация — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделанное на сайте перестаёт исчезать: складывается в баллы, ступени, значки, серию недель и общую шкалу класса.

**Architecture:** Чистое ядро (`js/progress/core.js` и `weeks.js`) считает всю экономику без DOM и без сети — оно и покрыто тестами. Хранилище (`js/progress/store.js`) прячет за одним интерфейсом localStorage у гостя и базу у вошедшего, сливая их по наибольшему. Страницы шлют одно событие на все случаи и ничего про экономику не знают.

**Tech Stack:** Ванильный ES-модульный JavaScript без сборки и без зависимостей, Firebase Realtime Database через REST, тесты на `node --test`.

**Спецификация:** `docs/specs/2026-08-18-geymifikaciya-design.md` — там записано, почему решения именно такие. При расхождении плана и спецификации права спецификация.

---

## Порядок и договорённости

Задачи идут снизу вверх: сначала ядро с тестами, потом хранилище, потом экраны. После каждой задачи `npm test` должен быть зелёным целиком, а не только в новом файле.

**Язык кода.** В проекте имена на русском там, где речь о предметной области (`собратьЖурнал`, `статусКлетки`), и на английском там, где речь о данных на сервере (`lessonId`, `weeks`). План этого держится — не «исправляй» на единый язык.

**Запуск тестов:** `npm test` — всё; `node --test test/progress/core.test.js` — один файл.

**Никаких зависимостей.** `npm install` в проекте не выполняется, `package.json` не трогаем.

---

### Task 1: Недели

Идентификатор недели по ISO — основа серии. Отдельным файлом, потому что тут легко ошибиться на границе года и потому что это единственное место с датами.

**Files:**
- Create: `js/progress/weeks.js`
- Test: `test/progress/weeks.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/progress/weeks.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { неделя, предыдущая } from '../../js/progress/weeks.js';

// 18 августа 2026 — вторник, 34-я неделя года.
test('будний день попадает в свою неделю', () => {
  assert.equal(неделя(new Date(2026, 7, 18)), '2026-W34');
});

test('понедельник начинает новую неделю', () => {
  assert.equal(неделя(new Date(2026, 7, 17)), '2026-W34');
});

test('воскресенье остаётся в прежней неделе', () => {
  assert.equal(неделя(new Date(2026, 7, 16)), '2026-W33');
});

// Неделя принадлежит тому году, в котором лежит её четверг.
test('конец декабря уходит в первую неделю следующего года', () => {
  assert.equal(неделя(new Date(2025, 11, 29)), '2026-W01');
});

test('номер недели всегда из двух цифр', () => {
  assert.equal(неделя(new Date(2026, 0, 1)), '2026-W01');
});

test('предыдущая неделя переходит через год', () => {
  assert.equal(предыдущая('2026-W01'), '2025-W52');
});

test('предыдущая неделя внутри года', () => {
  assert.equal(предыдущая('2026-W34'), '2026-W33');
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/progress/weeks.test.js`
Expected: FAIL, `Cannot find module` — файла `js/progress/weeks.js` ещё нет.

- [ ] **Step 3: Написать модуль**

Создай `js/progress/weeks.js`:

```js
/**
 * Неделя как идентификатор вида «2026-W34».
 *
 * Считается по ISO: неделя начинается в понедельник и принадлежит тому году,
 * в котором лежит её четверг. Из-за этого 29 декабря может оказаться первой
 * неделей следующего года — это не ошибка, а правило, и на нём держится серия
 * через новогодние каникулы.
 */
export function неделя(дата = new Date()) {
  const d = new Date(Date.UTC(дата.getFullYear(), дата.getMonth(), дата.getDate()));
  const день = d.getUTCDay() || 7; // воскресенье в ISO — седьмой день, а не нулевой
  d.setUTCDate(d.getUTCDate() + 4 - день); // сдвигаемся на четверг своей недели
  const началоГода = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const номер = Math.ceil(((d - началоГода) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(номер).padStart(2, '0')}`;
}

/** Неделя перед данной. Нужна, чтобы отматывать серию назад. */
export function предыдущая(id) {
  const [год, номер] = String(id).split('-W').map(Number);
  const четверг = четвергНедели(год, номер);
  четверг.setUTCDate(четверг.getUTCDate() - 7);
  return неделя(new Date(четверг.getUTCFullYear(), четверг.getUTCMonth(), четверг.getUTCDate()));
}

/** Четверг заданной недели — точка, по которой неделя опознаётся однозначно. */
function четвергНедели(год, номер) {
  const янв4 = new Date(Date.UTC(год, 0, 4)); // 4 января всегда в первой неделе
  const день = янв4.getUTCDay() || 7;
  const понедельник = new Date(янв4);
  понедельник.setUTCDate(янв4.getUTCDate() - день + 1);
  const четверг = new Date(понедельник);
  четверг.setUTCDate(понедельник.getUTCDate() + (номер - 1) * 7 + 3);
  return четверг;
}
```

- [ ] **Step 4: Запустить тесты**

Run: `node --test test/progress/weeks.test.js`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Коммит**

```bash
git add js/progress/weeks.js test/progress/weeks.test.js && git commit -m "Прогресс: идентификатор недели по ISO"
```

---

### Task 2: Ядро — начисление

Правило одно: за вид работы положено столько, сколько даёт лучший результат, начисляется разница с уже выданным. Из него следуют и «повтор не фармится», и «добавка догоняет».

**Files:**
- Create: `js/progress/core.js`
- Test: `test/progress/core.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/progress/core.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ПУСТО, начислить, ценность, всегоXp } from '../../js/progress/core.js';

const ДАТА = new Date(2026, 7, 18); // вторник 34-й недели

function начать() {
  return структурированный(ПУСТО);
}
function структурированный(o) {
  return JSON.parse(JSON.stringify(o));
}

test('игра с ошибками стоит десять баллов', () => {
  assert.equal(ценность({ kind: 'game0', correct: 6, total: 8 }), 10);
});

test('игра без ошибок стоит пятнадцать', () => {
  assert.equal(ценность({ kind: 'game0', correct: 8, total: 8 }), 15);
});

test('определитель стоит столько же, сколько игра', () => {
  assert.equal(ценность({ kind: 'key0', correct: 4, total: 4 }), 15);
});

test('лабораторная без промахов стоит двадцать', () => {
  assert.equal(ценность({ kind: 'lab', correct: 6, total: 6 }), 20);
});

test('за задания ВПР дают по два балла', () => {
  assert.equal(ценность({ kind: 'vpr', correct: 3, total: 5 }), 6);
});

test('баллы за ВПР упираются в потолок', () => {
  assert.equal(ценность({ kind: 'vpr', correct: 9, total: 9 }), 10);
});

test('домашка на девяносто процентов даёт добавку', () => {
  assert.equal(ценность({ kind: 'homework', percent: 90 }), 30);
  assert.equal(ценность({ kind: 'homework', percent: 89 }), 20);
});

test('первое прохождение начисляет всё', () => {
  const { состояние, добавлено } = начислить(начать(), {
    lessonId: 'у1', kind: 'game0', correct: 6, total: 8, состав: ['game0'],
  }, ДАТА);
  assert.equal(добавлено, 10);
  assert.equal(состояние.lessons['у1'].game0, 10);
  assert.equal(состояние.weeks['2026-W34'], 10);
});

test('повтор с тем же результатом не начисляет ничего', () => {
  const первое = начислить(начать(), {
    lessonId: 'у1', kind: 'game0', correct: 6, total: 8, состав: ['game0'],
  }, ДАТА);
  const второе = начислить(первое.состояние, {
    lessonId: 'у1', kind: 'game0', correct: 6, total: 8, состав: ['game0'],
  }, ДАТА);
  assert.equal(второе.добавлено, 0);
  assert.equal(второе.состояние.lessons['у1'].game0, 10);
  assert.equal(второе.состояние.weeks['2026-W34'], 10);
});

test('добавка за безошибочность догоняет при повторе', () => {
  const первое = начислить(начать(), {
    lessonId: 'у1', kind: 'game0', correct: 6, total: 8, состав: ['game0'],
  }, ДАТА);
  const второе = начислить(первое.состояние, {
    lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'],
  }, ДАТА);
  assert.equal(второе.добавлено, 5);
  assert.equal(второе.состояние.lessons['у1'].game0, 15);
});

test('худший повтор не отнимает выданное', () => {
  const первое = начислить(начать(), {
    lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'],
  }, ДАТА);
  const второе = начислить(первое.состояние, {
    lessonId: 'у1', kind: 'game0', correct: 1, total: 8, состав: ['game0'],
  }, ДАТА);
  assert.equal(второе.добавлено, 0);
  assert.equal(второе.состояние.lessons['у1'].game0, 15);
});

test('ключ пишется даже при нуле баллов', () => {
  const { состояние } = начислить(начать(), {
    lessonId: 'у1', kind: 'vpr', correct: 0, total: 5, состав: ['vpr'],
  }, ДАТА);
  assert.equal(состояние.lessons['у1'].vpr, 0);
});

test('урок пройден, когда закрыт весь состав', () => {
  const состав = ['game0', 'vpr'];
  const первое = начислить(начать(), { lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав }, ДАТА);
  assert.equal(первое.состояние.lessons['у1'].done, false);
  const второе = начислить(первое.состояние, { lessonId: 'у1', kind: 'vpr', correct: 0, total: 5, состав }, ДАТА);
  assert.equal(второе.состояние.lessons['у1'].done, true);
});

test('домашка в состав не входит и одна урока не закрывает', () => {
  const { состояние } = начислить(начать(), {
    lessonId: 'у1', kind: 'homework', percent: 100, состав: ['game0', 'vpr'],
  }, ДАТА);
  assert.equal(состояние.lessons['у1'].done, false);
  assert.equal(состояние.lessons['у1'].homework, 30);
});

test('исходное состояние не меняется', () => {
  const было = начать();
  начислить(было, { lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] }, ДАТА);
  assert.deepEqual(было.lessons, {});
});

test('всего баллов — сумма выданного по всем урокам', () => {
  let s = начать();
  s = начислить(s, { lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] }, ДАТА).состояние;
  s = начислить(s, { lessonId: 'у2', kind: 'vpr', correct: 5, total: 5, состав: ['vpr'] }, ДАТА).состояние;
  assert.equal(всегоXp(s), 25);
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/progress/core.test.js`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Написать модуль**

Создай `js/progress/core.js`:

```js
import { неделя } from './weeks.js';

/**
 * Вся экономика геймификации. Ни DOM, ни сети, ни времени наружу — только
 * чистые функции. Ошибка здесь молча рисует ученику неверные баллы, поэтому
 * править её нужно вместе с тестом, а не вместо него.
 */

/** Таблица начисления. Крутить экономику — только здесь. */
export const НОРМЫ = {
  игра: { за: 10, чисто: 5 },
  лаборатория: { за: 15, чисто: 5 },
  впр: { заЗадание: 2, потолок: 10 },
  домашка: { за: 20, отлично: 10, порог: 90 },
};

/** Пустое состояние. Форма одна и та же в браузере и в базе. */
export const ПУСТО = { v: 1, lessons: {}, weeks: {}, lastSeen: 0 };

/**
 * Сколько баллов даёт такой результат.
 *
 * «Чисто» — это correct === total в момент завершения, а не безошибочность
 * каждого клика: игры позволяют переставить элемент до проверки, и требовать
 * большего значило бы наказывать за раздумья.
 */
export function ценность({ kind, correct = 0, total = 0, percent = 0 }) {
  if (kind === 'lab') {
    return НОРМЫ.лаборатория.за + (total > 0 && correct === total ? НОРМЫ.лаборатория.чисто : 0);
  }
  if (kind === 'vpr') {
    return Math.min(correct * НОРМЫ.впр.заЗадание, НОРМЫ.впр.потолок);
  }
  if (kind === 'homework') {
    return НОРМЫ.домашка.за + (percent >= НОРМЫ.домашка.порог ? НОРМЫ.домашка.отлично : 0);
  }
  // Игры и определители стоят одинаково, но лежат под разными ключами:
  // по ключу потом отличается значок «Ботаник» от значка «Без ошибок».
  return НОРМЫ.игра.за + (total > 0 && correct === total ? НОРМЫ.игра.чисто : 0);
}

/**
 * Начисляет за событие и возвращает новое состояние.
 *
 * Правило одно: положено столько, сколько даёт лучший результат; начисляется
 * разница с уже выданным. Отсюда и то, что повтор ничего не приносит, и то,
 * что добавка за безошибочность догоняет при повторе.
 */
export function начислить(состояние, событие, дата = new Date()) {
  const s = клон(состояние);
  const { lessonId, kind, состав = [] } = событие;

  const урок = s.lessons[lessonId] ?? {};
  const выдано = урок[kind] ?? 0;
  const положено = ценность(событие);
  const добавлено = Math.max(0, положено - выдано);

  // Ключ пишется даже при нуле: иначе «сделано плохо» не отличить от «не тронуто».
  урок[kind] = Math.max(выдано, положено);
  урок.done = состав.length > 0 && состав.every((вид) => вид in урок);
  s.lessons[lessonId] = урок;

  if (добавлено > 0) {
    const w = неделя(дата);
    s.weeks[w] = (s.weeks[w] ?? 0) + добавлено;
  }
  s.lastSeen = дата.getTime();

  return { состояние: s, добавлено };
}

/** Сумма выданного по всем урокам. Отдельно не хранится: разошлась бы. */
export function всегоXp(состояние) {
  return Object.values(состояние.lessons ?? {}).reduce((сумма, урок) => сумма + xpУрока(урок), 0);
}

/** Баллы одного урока. Считаются только числа: рядом лежит признак done. */
export function xpУрока(урок) {
  return Object.values(урок ?? {}).reduce((с, v) => с + (typeof v === 'number' ? v : 0), 0);
}

function клон(состояние) {
  const s = { ...ПУСТО, ...(состояние ?? {}) };
  return {
    v: 1,
    lessons: Object.fromEntries(Object.entries(s.lessons ?? {}).map(([k, v]) => [k, { ...v }])),
    weeks: { ...(s.weeks ?? {}) },
    lastSeen: s.lastSeen ?? 0,
  };
}
```

- [ ] **Step 4: Запустить тесты**

Run: `node --test test/progress/core.test.js`
Expected: PASS, 16 тестов.

- [ ] **Step 5: Коммит**

```bash
git add js/progress/core.js test/progress/core.test.js && git commit -m "Прогресс: начисление баллов"
```

---

### Task 3: Ядро — ступени и серия недель

**Files:**
- Modify: `js/progress/core.js` (дописать в конец)
- Modify: `test/progress/core.test.js` (дописать в конец)

- [ ] **Step 1: Написать падающий тест**

Допиши в конец `test/progress/core.test.js`:

```js
import { ступень, серия, СТУПЕНИ } from '../../js/progress/core.js';

test('ступеней шесть и первая начинается с нуля', () => {
  assert.equal(СТУПЕНИ.length, 6);
  assert.equal(СТУПЕНИ[0].порог, 0);
});

test('ступень по баллам', () => {
  assert.equal(ступень(0).имя, 'Наблюдатель');
  assert.equal(ступень(99).имя, 'Наблюдатель');
  assert.equal(ступень(100).имя, 'Собиратель');
  assert.equal(ступень(1500).имя, 'Биолог');
  assert.equal(ступень(99999).имя, 'Биолог');
});

test('до следующей ступени считается от порога', () => {
  assert.equal(ступень(80).доСледующей, 20);
  assert.equal(ступень(80).следующая, 'Собиратель');
});

test('на последней ступени следующей нет', () => {
  assert.equal(ступень(1500).следующая, null);
  assert.equal(ступень(1500).доСледующей, 0);
});

test('серия считает недели подряд', () => {
  const weeks = { '2026-W32': 10, '2026-W33': 5, '2026-W34': 15 };
  assert.equal(серия(weeks, ДАТА), 3);
});

test('пропущенная неделя обрывает серию', () => {
  const weeks = { '2026-W30': 10, '2026-W32': 5, '2026-W33': 15, '2026-W34': 1 };
  assert.equal(серия(weeks, ДАТА), 3);
});

test('пустая текущая неделя серию ещё не рвёт', () => {
  const weeks = { '2026-W32': 10, '2026-W33': 5 };
  assert.equal(серия(weeks, ДАТА), 2);
});

test('без единой недели серии нет', () => {
  assert.equal(серия({}, ДАТА), 0);
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/progress/core.test.js`
Expected: FAIL, `The requested module ... does not provide an export named 'ступень'`.

- [ ] **Step 3: Дописать модуль**

Допиши в конец `js/progress/core.js` (и добавь `предыдущая` в импорт из `./weeks.js` — первая строка файла становится `import { неделя, предыдущая } from './weeks.js';`):

```js
/** Ступени. Названия — про ученика, а не про растение: он их про себя читает. */
export const СТУПЕНИ = [
  { имя: 'Наблюдатель', порог: 0 },
  { имя: 'Собиратель', порог: 100 },
  { имя: 'Лаборант', порог: 300 },
  { имя: 'Исследователь', порог: 600 },
  { имя: 'Натуралист', порог: 1000 },
  { имя: 'Биолог', порог: 1500 },
];

/** Ступень по баллам и сколько осталось до следующей. */
export function ступень(xp) {
  let индекс = 0;
  for (let i = 0; i < СТУПЕНИ.length; i += 1) {
    if (xp >= СТУПЕНИ[i].порог) индекс = i;
  }
  const следующая = СТУПЕНИ[индекс + 1] ?? null;
  return {
    имя: СТУПЕНИ[индекс].имя,
    индекс,
    порог: СТУПЕНИ[индекс].порог,
    следующая: следующая?.имя ?? null,
    доСледующей: следующая ? следующая.порог - xp : 0,
  };
}

/**
 * Сколько недель подряд ученик занимался, считая назад от текущей.
 *
 * Незачатая текущая неделя серию не рвёт: иначе в понедельник утром у всех
 * обнулялось бы то, что они набирали месяц. Рвёт её только неделя, которая
 * прошла целиком и осталась пустой.
 */
export function серия(weeks = {}, дата = new Date()) {
  let id = неделя(дата);
  if (!weeks[id]) id = предыдущая(id);

  let счёт = 0;
  while (weeks[id]) {
    счёт += 1;
    id = предыдущая(id);
  }
  return счёт;
}
```

- [ ] **Step 4: Запустить тесты**

Run: `node --test test/progress/core.test.js`
Expected: PASS, 24 теста.

- [ ] **Step 5: Коммит**

```bash
git add js/progress/core.js test/progress/core.test.js && git commit -m "Прогресс: ступени и серия недель"
```

---

### Task 4: Ядро — значки и общий итог

Значки не хранятся, а вычисляются: хранимый значок рано или поздно разойдётся с данными, по которым он выдан.

**Files:**
- Modify: `js/progress/core.js` (дописать в конец)
- Test: `test/progress/awards.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/progress/awards.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { итог, ПУСТО } from '../../js/progress/core.js';

const ДАТА = new Date(2026, 7, 18);

const КУРС = {
  grade: 5,
  sections: [
    { id: 'nauka', title: 'Наука', lessons: [{ id: 'у1' }, { id: 'у2' }] },
    { id: 'kletka', title: 'Клетка', lessons: [{ id: 'у3' }] },
  ],
};

function состояние(lessons = {}, weeks = {}) {
  return { ...ПУСТО, lessons, weeks };
}

function значок(итоги, id) {
  return итоги.значки.find((з) => з.id === id);
}

test('без баллов не выдан ни один значок', () => {
  const итоги = итог(состояние(), [КУРС], ДАТА);
  assert.equal(итоги.значки.every((з) => !з.есть), true);
});

test('первый балл выдаёт «Первый шаг»', () => {
  const итоги = итог(состояние({ у1: { game0: 10 } }), [КУРС], ДАТА);
  assert.equal(значок(итоги, 'first').есть, true);
});

test('«Без ошибок» — за чистую игру, а не за пройденную', () => {
  assert.equal(значок(итог(состояние({ у1: { game0: 10 } }), [КУРС], ДАТА), 'clean-game').есть, false);
  assert.equal(значок(итог(состояние({ у1: { game0: 15 } }), [КУРС], ДАТА), 'clean-game').есть, true);
});

test('«Ботаник» даётся за определитель, а не за игру', () => {
  assert.equal(значок(итог(состояние({ у1: { game0: 15 } }), [КУРС], ДАТА), 'botanist').есть, false);
  assert.equal(значок(итог(состояние({ у1: { key0: 15 } }), [КУРС], ДАТА), 'botanist').есть, true);
});

test('«Чистая работа» — за лабораторную без промахов', () => {
  assert.equal(значок(итог(состояние({ у1: { lab: 15 } }), [КУРС], ДАТА), 'clean-lab').есть, false);
  assert.equal(значок(итог(состояние({ у1: { lab: 20 } }), [КУРС], ДАТА), 'clean-lab').есть, true);
});

test('«Все пять» — за полный блок ВПР', () => {
  assert.equal(значок(итог(состояние({ у1: { vpr: 8 } }), [КУРС], ДАТА), 'vpr-full').есть, false);
  assert.equal(значок(итог(состояние({ у1: { vpr: 10 } }), [КУРС], ДАТА), 'vpr-full').есть, true);
});

test('«Месяц подряд» — четыре недели', () => {
  const три = { '2026-W32': 1, '2026-W33': 1, '2026-W34': 1 };
  const четыре = { '2026-W31': 1, ...три };
  assert.equal(значок(итог(состояние({}, три), [КУРС], ДАТА), 'month').есть, false);
  assert.equal(значок(итог(состояние({}, четыре), [КУРС], ДАТА), 'month').есть, true);
});

test('«Раздел закрыт» считает закрытые разделы', () => {
  const итоги = итог(состояние({ у1: { done: true }, у2: { done: true } }), [КУРС], ДАТА);
  assert.equal(значок(итоги, 'section').есть, true);
  assert.equal(значок(итоги, 'section').счёт, '1 из 2');
});

test('незакрытый до конца раздел не считается', () => {
  const итоги = итог(состояние({ у1: { done: true } }), [КУРС], ДАТА);
  assert.equal(значок(итоги, 'section').есть, false);
});

test('«Год закрыт» — все уроки курса', () => {
  const все = { у1: { done: true }, у2: { done: true }, у3: { done: true } };
  assert.equal(значок(итог(состояние(все), [КУРС], ДАТА), 'year').есть, true);
});

test('итог собирает баллы, ступень, серию и уроки', () => {
  const итоги = итог(
    состояние({ у1: { game0: 15, done: true }, у2: { vpr: 10 } }, { '2026-W34': 25 }),
    [КУРС],
    ДАТА,
  );
  assert.equal(итоги.xp, 25);
  assert.equal(итоги.ступень.имя, 'Наблюдатель');
  assert.equal(итоги.серия, 1);
  assert.deepEqual(итоги.уроки, {
    пройдено: 1,
    всего: 3,
    разделы: [
      { id: 'nauka', title: 'Наука', пройдено: 1, всего: 2 },
      { id: 'kletka', title: 'Клетка', пройдено: 0, всего: 1 },
    ],
  });
});

test('без курса итог всё равно считается', () => {
  const итоги = итог(состояние({ у1: { game0: 15, done: true } }), [], ДАТА);
  assert.equal(итоги.xp, 15);
  assert.equal(итоги.уроки.всего, 0);
  assert.equal(значок(итоги, 'year').есть, false);
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/progress/awards.test.js`
Expected: FAIL, `does not provide an export named 'итог'`.

- [ ] **Step 3: Дописать модуль**

Допиши в конец `js/progress/core.js`:

```js
const ЧИСТАЯ_ИГРА = НОРМЫ.игра.за + НОРМЫ.игра.чисто;
const ЧИСТАЯ_ЛАБА = НОРМЫ.лаборатория.за + НОРМЫ.лаборатория.чисто;

/**
 * Значки. Вычисляются из состояния, а не хранятся: хранимый значок и данные,
 * по которым он выдан, однажды разойдутся, и объяснить это будет нечем.
 *
 * Условие каждого значка выводится из одних баллов — чистая игра стоит ровно
 * 15, чистая лабораторная 20, полный блок ВПР 10. Исключение одно: разделы и
 * год, которым нужен курс.
 */
export const ЗНАЧКИ = [
  { id: 'first', имя: 'Первый шаг', условие: 'Заработай первый балл',
    есть: (s) => всегоXp(s) > 0 },
  { id: 'clean-game', имя: 'Без ошибок', условие: 'Пройди игру без единой ошибки',
    есть: (s) => естьКлюч(s, (k, v) => k.startsWith('game') && v === ЧИСТАЯ_ИГРА) },
  { id: 'clean-lab', имя: 'Чистая работа', условие: 'Проведи лабораторную без неверных шагов',
    есть: (s) => естьКлюч(s, (k, v) => k === 'lab' && v === ЧИСТАЯ_ЛАБА) },
  { id: 'botanist', имя: 'Ботаник', условие: 'Определи все образцы без ошибок',
    есть: (s) => естьКлюч(s, (k, v) => k.startsWith('key') && v === ЧИСТАЯ_ИГРА) },
  { id: 'vpr-full', имя: 'Все пять', условие: 'Реши блок ВПР целиком верно',
    есть: (s) => естьКлюч(s, (k, v) => k === 'vpr' && v === НОРМЫ.впр.потолок) },
  { id: 'month', имя: 'Месяц подряд', условие: 'Занимайся четыре недели подряд',
    есть: (s, курсы, дата) => серия(s.weeks, дата) >= 4 },
  { id: 'quarter', имя: 'Четверть подряд', условие: 'Занимайся восемь недель подряд',
    есть: (s, курсы, дата) => серия(s.weeks, дата) >= 8 },
  { id: 'section', имя: 'Раздел закрыт', условие: 'Пройди все уроки одного раздела',
    есть: (s, курсы) => закрытыхРазделов(s, курсы) > 0,
    счёт: (s, курсы) => `${закрытыхРазделов(s, курсы)} из ${всегоРазделов(курсы)}` },
  { id: 'year', имя: 'Год закрыт', условие: 'Пройди все уроки класса',
    есть: (s, курсы) => курсы.length > 0
      && курсы.some((к) => урокиКурса(к).every((id) => s.lessons[id]?.done)) },
];

/**
 * Всё, что нужно экранам: баллы, ступень, серия, пройденные уроки и значки.
 * Курсы передаются снаружи: сколько всего уроков и как они разложены по
 * разделам, в личных данных не записано и записываться не должно.
 */
export function итог(состояние, курсы = [], дата = new Date()) {
  const s = { ...ПУСТО, ...(состояние ?? {}) };
  const xp = всегоXp(s);

  return {
    xp,
    ступень: ступень(xp),
    серия: серия(s.weeks, дата),
    уроки: {
      пройдено: Object.values(s.lessons).filter((у) => у.done).length,
      всего: курсы.reduce((n, к) => n + урокиКурса(к).length, 0),
      разделы: курсы.flatMap((к) =>
        к.sections.map((раздел) => ({
          id: раздел.id,
          title: раздел.title,
          пройдено: раздел.lessons.filter((у) => s.lessons[у.id]?.done).length,
          всего: раздел.lessons.length,
        })),
      ),
    },
    значки: ЗНАЧКИ.map((з) => ({
      id: з.id,
      имя: з.имя,
      условие: з.условие,
      есть: Boolean(з.есть(s, курсы, дата)),
      счёт: з.счёт ? з.счёт(s, курсы) : null,
    })),
  };
}

function естьКлюч(состояние, подходит) {
  return Object.values(состояние.lessons ?? {}).some((урок) =>
    Object.entries(урок).some(([k, v]) => typeof v === 'number' && подходит(k, v)),
  );
}

function урокиКурса(курс) {
  return (курс.sections ?? []).flatMap((р) => (р.lessons ?? []).map((у) => у.id));
}

function всегоРазделов(курсы) {
  return курсы.reduce((n, к) => n + (к.sections?.length ?? 0), 0);
}

function закрытыхРазделов(состояние, курсы) {
  return курсы.reduce(
    (n, к) =>
      n + к.sections.filter((р) => р.lessons.length > 0
        && р.lessons.every((у) => состояние.lessons[у.id]?.done)).length,
    0,
  );
}
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS, все тесты проекта зелёные (289 прежних + новые).

- [ ] **Step 5: Коммит**

```bash
git add js/progress/core.js test/progress/awards.test.js && git commit -m "Прогресс: значки и общий итог"
```

---

### Task 5: Хранилище — гость и слияние

**Files:**
- Create: `js/progress/store.js`
- Test: `test/progress/store.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/progress/store.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, слить } from '../../js/progress/store.js';

const ДАТА = new Date(2026, 7, 18);

function память(начальное = null) {
  const данные = new Map();
  if (начальное) данные.set('bioschool.progress', JSON.stringify(начальное));
  return {
    getItem: (k) => (данные.has(k) ? данные.get(k) : null),
    setItem: (k, v) => данные.set(k, v),
    removeItem: (k) => данные.delete(k),
  };
}

function собрать({ storage = память(), сессия = () => null, записи = [], данные = {} } = {}) {
  const api = {
    dbGet: async (path) => данные[Object.keys(данные).find((k) => path.endsWith(k)) ?? ''] ?? null,
    dbPut: async (path, value) => { записи.push({ path, value }); return value; },
  };
  const p = createProgress({ api, storage, сессия, токен: async () => 'т', now: () => ДАТА });
  return { p, записи, api };
}

test('гость копит баллы в браузере', async () => {
  const { p, записи } = собрать();
  const { добавлено } = await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.equal(добавлено, 15);
  assert.equal(p.read().lessons['у1'].game0, 15);
  assert.deepEqual(записи, []); // без входа в базу не пишем
});

test('состояние переживает пересоздание хранилища', async () => {
  const storage = память();
  const первый = собрать({ storage });
  await первый.p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  const второй = собрать({ storage });
  assert.equal(второй.p.read().lessons['у1'].game0, 15);
});

test('испорченная запись не роняет чтение', () => {
  const storage = память();
  storage.setItem('bioschool.progress', '{это не json');
  const { p } = собрать({ storage });
  assert.deepEqual(p.read().lessons, {});
});

test('record возвращает новые значки, а не все', async () => {
  const { p } = собрать();
  const первое = await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.deepEqual(первое.значки.map((з) => з.id).sort(), ['clean-game', 'first']);
  const второе = await p.record({ lessonId: 'у2', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.deepEqual(второе.значки, []);
});

test('слияние берёт лучшее по каждому виду и не складывает баллы', () => {
  const a = { v: 1, lessons: { у1: { game0: 15, vpr: 4 } }, weeks: { '2026-W33': 19 }, lastSeen: 5 };
  const b = { v: 1, lessons: { у1: { game0: 10, vpr: 10 }, у2: { lab: 20 } }, weeks: { '2026-W33': 20, '2026-W34': 3 }, lastSeen: 9 };
  assert.deepEqual(слить(a, b), {
    v: 1,
    lessons: { у1: { game0: 15, vpr: 10, done: false }, у2: { lab: 20, done: false } },
    weeks: { '2026-W33': 20, '2026-W34': 3 },
    lastSeen: 9,
  });
});

test('пройденность при слиянии не теряется', () => {
  const a = { v: 1, lessons: { у1: { game0: 10, done: true } }, weeks: {}, lastSeen: 0 };
  const b = { v: 1, lessons: { у1: { game0: 15, done: false } }, weeks: {}, lastSeen: 0 };
  assert.equal(слить(a, b).lessons['у1'].done, true);
});

test('слияние пустого с пустым даёт пустое', () => {
  assert.deepEqual(слить(undefined, undefined), { v: 1, lessons: {}, weeks: {}, lastSeen: 0 });
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/progress/store.test.js`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Написать модуль**

Создай `js/progress/store.js`:

```js
import * as rest from '../api/firebase-rest.js';
import { SCHOOL_ID } from '../firebase-config.js';
import { ПУСТО, начислить, итог } from './core.js';
import { неделя as неделяИз } from './weeks.js';

const ROOT = `schools/${SCHOOL_ID}`;
const KEY = 'bioschool.progress';

/**
 * Хранение прогресса и перенос его в базу.
 *
 * Считается всегда локально и сразу: гость набирает баллы с первого действия,
 * а вошедший ученик не ждёт сети, чтобы увидеть «+15». В базу то же состояние
 * уходит следом и молча — если не ушло, локальное остаётся, и при следующем
 * заходе всё сольётся.
 */
export function createProgress({
  api = rest,
  storage = globalThis.localStorage,
  сессия = () => null,
  токен = async () => null,
  now = () => new Date(),
} = {}) {
  function read() {
    try {
      const raw = storage.getItem(KEY);
      const данные = raw ? JSON.parse(raw) : null;
      return { ...ПУСТО, ...(данные ?? {}) };
    } catch {
      // Испорченная запись — не повод терять экран. Считаем, что начали заново.
      return { ...ПУСТО };
    }
  }

  function сохранить(состояние) {
    try {
      storage.setItem(KEY, JSON.stringify(состояние));
    } catch {
      // Переполненное или запрещённое хранилище: баллы потеряются, урок — нет.
    }
    return состояние;
  }

  /** Единственное, что зовут страницы. */
  async function record(событие) {
    const было = read();
    const { состояние, добавлено } = начислить(было, событие, now());
    сохранить(состояние);

    const значки = новыеЗначки(было, состояние);
    отправить(состояние).catch(() => {});

    return { добавлено, значки, состояние };
  }

  /** Что показать плашкой: значки, которых минуту назад не было. */
  function новыеЗначки(было, стало) {
    const прежние = new Set(итог(было, [], now()).значки.filter((з) => з.есть).map((з) => з.id));
    return итог(стало, [], now())
      .значки.filter((з) => з.есть && !прежние.has(з.id));
  }

  async function отправить(состояние) {
    const s = сессия();
    if (!s?.studentId) return null;
    const token = await токен();
    if (!token) return null;

    // Пишем в ветку game, а не в корень записи: в корне живёт practice.
    await api.dbPut(`${ROOT}/progress/${s.studentId}/game`, состояние, { token });
    if (s.classId) {
      await api.dbPut(`${ROOT}/leaderboard/${s.classId}/${s.studentId}`, выжимка(состояние, now()), { token });
    }
    return состояние;
  }

  return { read, record, отправить, сохранить };
}

/**
 * Слияние локального и облачного: по каждому виду работы берётся лучшее.
 * Складывать нельзя — одна и та же игра, пройденная на двух устройствах,
 * дала бы двойные баллы.
 */
export function слить(a, b) {
  const первое = { ...ПУСТО, ...(a ?? {}) };
  const второе = { ...ПУСТО, ...(b ?? {}) };

  const lessons = {};
  for (const id of ключи(первое.lessons, второе.lessons)) {
    const x = первое.lessons[id] ?? {};
    const y = второе.lessons[id] ?? {};
    const урок = {};
    for (const вид of ключи(x, y)) {
      if (вид === 'done') урок.done = Boolean(x.done || y.done);
      else урок[вид] = Math.max(x[вид] ?? 0, y[вид] ?? 0);
    }
    урок.done = Boolean(урок.done);
    lessons[id] = урок;
  }

  const weeks = {};
  for (const w of ключи(первое.weeks, второе.weeks)) {
    weeks[w] = Math.max(первое.weeks[w] ?? 0, второе.weeks[w] ?? 0);
  }

  return { v: 1, lessons, weeks, lastSeen: Math.max(первое.lastSeen ?? 0, второе.lastSeen ?? 0) };
}

/** Короткая открытая выжимка для шкалы класса и героев недели. */
export function выжимка(состояние, дата = new Date()) {
  const свод = итог(состояние, [], дата);
  const текущая = неделяИз(дата);
  return {
    xp: свод.xp,
    weekId: текущая,
    weekXp: состояние.weeks?.[текущая] ?? 0,
    lessonsDone: свод.уроки.пройдено,
    lastSeen: состояние.lastSeen ?? 0,
  };
}

function ключи(a = {}, b = {}) {
  return new Set([...Object.keys(a), ...Object.keys(b)]);
}
```

- [ ] **Step 4: Запустить тесты**

Run: `node --test test/progress/store.test.js`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Коммит**

```bash
git add js/progress/store.js test/progress/store.test.js && git commit -m "Прогресс: хранение у гостя и слияние"
```

---

### Task 6: Хранилище — база, выжимка и перенос при входе

Перенос идемпотентен: слияние берёт наибольшее, поэтому его можно звать при каждом запуске, не заводя флага «уже переносили».

**Files:**
- Modify: `js/progress/store.js`
- Create: `js/progress/index.js`
- Modify: `test/progress/store.test.js` (дописать)

- [ ] **Step 1: Написать падающий тест**

Допиши в конец `test/progress/store.test.js`:

```js
test('вошедший пишет в свою ветку и в таблицу класса', async () => {
  const { p, записи } = собрать({ сессия: () => ({ studentId: 's1', classId: '5a' }) });
  await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  const пути = записи.map((з) => з.path);
  assert.equal(пути.some((п) => п.endsWith('progress/s1/game')), true);
  assert.equal(пути.some((п) => п.endsWith('leaderboard/5a/s1')), true);
});

test('выжимка несёт баллы, неделю и пройденные уроки', async () => {
  const { p, записи } = собрать({ сессия: () => ({ studentId: 's1', classId: '5a' }) });
  await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  const строка = записи.find((з) => з.path.endsWith('leaderboard/5a/s1')).value;
  assert.deepEqual(строка, {
    xp: 15, weekId: '2026-W34', weekXp: 15, lessonsDone: 1, lastSeen: ДАТА.getTime(),
  });
});

test('отказ базы не мешает начислению', async () => {
  const storage = память();
  const api = {
    dbGet: async () => null,
    dbPut: async () => { throw new Error('Нет связи с сервером. Проверь интернет.'); },
  };
  const p = createProgress({
    api, storage, сессия: () => ({ studentId: 's1', classId: '5a' }),
    токен: async () => 'т', now: () => ДАТА,
  });

  const { добавлено } = await p.record({ lessonId: 'у1', kind: 'lab', correct: 6, total: 6, состав: ['lab'] });
  assert.equal(добавлено, 20);
  assert.equal(JSON.parse(storage.getItem('bioschool.progress')).lessons['у1'].lab, 20);
});

test('перенос сливает облачное с локальным и пишет результат', async () => {
  const storage = память({ v: 1, lessons: { у1: { game0: 15 } }, weeks: { '2026-W34': 15 }, lastSeen: 1 });
  const { p, записи } = собрать({
    storage,
    сессия: () => ({ studentId: 's1', classId: '5a' }),
    данные: { 'progress/s1/game': { v: 1, lessons: { у2: { vpr: 10 } }, weeks: { '2026-W33': 10 }, lastSeen: 2 } },
  });

  await p.перенести();

  const состояние = p.read();
  assert.equal(состояние.lessons['у1'].game0, 15);
  assert.equal(состояние.lessons['у2'].vpr, 10);
  assert.deepEqual(состояние.weeks, { '2026-W33': 10, '2026-W34': 15 });
  assert.equal(записи.some((з) => з.path.endsWith('progress/s1/game')), true);
});

test('перенос без входа ничего не делает', async () => {
  const { p, записи } = собрать();
  assert.equal(await p.перенести(), null);
  assert.deepEqual(записи, []);
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/progress/store.test.js`
Expected: FAIL, `p.перенести is not a function`.

- [ ] **Step 3: Дописать перенос**

В `js/progress/store.js` добавь функцию внутрь `createProgress` (перед `return`):

```js
  /**
   * Перенос при входе. Зовётся при каждом запуске с сессией ученика, и это
   * не расточительство: слияние берёт наибольшее, поэтому повторный вызов
   * ничего не меняет. Заодно на новом устройстве прогресс приезжает сам.
   */
  async function перенести() {
    const s = сессия();
    if (!s?.studentId) return null;
    const token = await токен();
    if (!token) return null;

    let облачное = null;
    try {
      облачное = await api.dbGet(`${ROOT}/progress/${s.studentId}/game`, { token });
    } catch {
      // Нет доступа или нет связи — остаёмся на локальном, попробуем в другой раз.
      return null;
    }

    const слитое = слить(read(), облачное);
    сохранить(слитое);
    await отправить(слитое).catch(() => {});
    return слитое;
  }
```

И добавь `перенести` в возвращаемый объект:

```js
  return { read, record, отправить, сохранить, перенести };
```

- [ ] **Step 4: Запустить тесты**

Run: `node --test test/progress/store.test.js`
Expected: PASS, 12 тестов.

- [ ] **Step 5: Создать общую точку входа**

Создай `js/progress/index.js`:

```js
import { createProgress } from './store.js';
import { auth } from '../pages/login.js';

/**
 * Один прогресс на всё приложение. Сессия подставляется здесь, а не внутри
 * хранилища: хранилище не должно знать про страницы, иначе его не проверить
 * без браузера.
 */
export const progress = createProgress({
  сессия: () => {
    const s = auth.current();
    return s?.kind === 'student' ? { studentId: s.studentId, classId: s.classId } : null;
  },
  токен: () => auth.token(),
});
```

- [ ] **Step 6: Полный прогон и коммит**

Run: `npm test`
Expected: PASS, всё зелёное.

```bash
git add js/progress/store.js js/progress/index.js test/progress/store.test.js && git commit -m "Прогресс: запись в базу и перенос при входе"
```

---

### Task 7: Правила базы для таблицы класса

**Files:**
- Modify: `database.rules.json`
- Modify: `scripts/verify-login.mjs`

- [ ] **Step 1: Дописать правило**

В `database.rules.json` внутрь `"apts"`, рядом с `"progress"`, добавь:

```json
        "leaderboard": {
          ".read": true,
          "$classId": {
            "$studentId": {
              ".write": "root.child('schools/apts/bindings').child($studentId).child('uid').val() === auth.uid || root.child('schools/apts/teachers').child(auth.uid).exists()",
              ".validate": "newData.hasChildren(['xp', 'weekId'])"
            }
          }
        },
```

Открытое чтение здесь осознанно: в таблице лежат баллы и идентификатор ученика, а имена и так открыты — по ним работает экран входа.

- [ ] **Step 2: Проверить, что JSON цел**

Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('ок')"`
Expected: `ок`

- [ ] **Step 3: Дописать проверку доступа**

В `scripts/verify-login.mjs`, перед блоком `// ── Чтение ───`, добавь:

```js
// ── Таблица класса ───────────────────────────────────────────
итог(
  'свою строку в таблице класса писать можно',
  'разрешено',
  await попытка(() =>
    dbPut(
      `${ROOT}/leaderboard/test/test-ivanov`,
      { xp: 15, weekId: '2026-W34', weekXp: 15, lessonsDone: 1, lastSeen: Date.now() },
      { token: сессия.idToken, ...cfg },
    ),
  ),
);

итог(
  'ГЛАВНОЕ: чужую строку в таблице класса писать нельзя',
  'отказано',
  await попытка(() =>
    dbPut(
      `${ROOT}/leaderboard/test/test-petrova`,
      { xp: 999, weekId: '2026-W34', weekXp: 999, lessonsDone: 34, lastSeen: Date.now() },
      { token: сессия.idToken, ...cfg },
    ),
  ),
);

итог(
  'таблица класса читается всеми — на ней держится общая шкала',
  'разрешено',
  await попытка(() => dbGet(`${ROOT}/leaderboard/test`, cfg)),
);
```

Здесь `сессия` — сессия Иванова, заведённая выше в этом же файле, а `test` — идентификатор тестового класса.

- [ ] **Step 4: Опубликовать правила и прогнать проверку**

Правила публикуются в консоли Firebase владельцем проекта — это шаг для учителя, не для агента. После публикации:

Run: `node scripts/verify-login.mjs`
Expected: все проверки зелёные, включая две новые.

Если правила ещё не опубликованы, новые проверки покажут отказ записи — это ожидаемо, задача считается сделанной по коду, а публикация отмечается в `STATUS.md`.

- [ ] **Step 5: Коммит**

```bash
git add database.rules.json scripts/verify-login.mjs && git commit -m "Правила: таблица класса для геймификации"
```

---

### Task 8: Плашка и сигнал от блока ВПР

**Files:**
- Create: `js/ui/toast.js`
- Modify: `js/homework/quiz.js`
- Test: `test/ui/toast.test.js`
- Test: `test/homework/quiz.test.js` (дописать)

- [ ] **Step 1: Написать падающий тест плашки**

Создай `test/ui/toast.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { плашка } from '../../js/ui/toast.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

const doc = () => makeFakeDocument();

test('без баллов и значков плашки нет', () => {
  assert.equal(плашка({ добавлено: 0, значки: [] }, { document: doc() }), null);
});

test('плашка показывает начисленное', () => {
  const узел = плашка({ добавлено: 15, значки: [] }, { document: doc() });
  assert.equal(узел.children[0].textContent, '+15');
});

test('значок называется в плашке', () => {
  const узел = плашка({ добавлено: 20, значки: [{ id: 'clean-lab', имя: 'Чистая работа' }] }, { document: doc() });
  const тексты = узел.children.map((c) => c.textContent);
  assert.equal(тексты.includes('Чистая работа'), true);
});

test('значок без баллов тоже показывается', () => {
  const узел = плашка({ добавлено: 0, значки: [{ id: 'month', имя: 'Месяц подряд' }] }, { document: doc() });
  assert.notEqual(узел, null);
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/ui/toast.test.js`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Написать плашку**

Создай `js/ui/toast.js`:

```js
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
  if (добавлено) части.push(el('p', { class: 'toast__xp' }, `+${добавлено}`, { document: doc }));
  for (const з of значки) {
    части.push(el('p', { class: 'toast__award' }, з.имя, { document: doc }));
  }

  return el('div', { class: 'toast reveal reveal--in', role: 'status' }, части, { document: doc });
}

/** Показывает плашку и убирает её сама. Возвращает узел или null. */
export function показать(итог, { root = globalThis.document?.body, document: doc = globalThis.document, задержка = 4000 } = {}) {
  const узел = плашка(итог, { document: doc });
  if (!узел || !root) return null;
  root.append(узел);
  setTimeout(() => узел.remove?.(), задержка);
  return узел;
}
```

- [ ] **Step 4: Тест плашки зелёный**

Run: `node --test test/ui/toast.test.js`
Expected: PASS, 4 теста.

- [ ] **Step 5: Написать падающий тест сигнала от ВПР**

Допиши в конец `test/homework/quiz.test.js`:

```js
test('после проверки зовётся onChecked с результатом', () => {
  const doc = makeFakeDocument();
  const исходы = [];
  const quiz = createQuiz(
    [{ id: 'q1', type: 'single', text: 'Вопрос', options: ['а', 'б'], correct: 0 }],
    { document: doc, onChecked: (р) => исходы.push(р) },
  );
  const кнопка = найтиКнопку(quiz.element, 'Проверить');
  кнопка.listeners.click[0]();
  assert.deepEqual(исходы, [{ correct: 0, total: 1 }]);
});
```

Если в файле ещё нет вспомогательной функции поиска кнопки, добавь её рядом с остальными:

```js
function найтиКнопку(узел, подпись) {
  if (узел.textContent === подпись && узел.tagName === 'BUTTON') return узел;
  for (const ребёнок of узел.children ?? []) {
    const найдено = найтиКнопку(ребёнок, подпись);
    if (найдено) return найдено;
  }
  return null;
}
```

- [ ] **Step 6: Запустить и убедиться, что падает**

Run: `node --test test/homework/quiz.test.js`
Expected: FAIL — `исходы` пуст, потому что `onChecked` пока никем не зовётся.

- [ ] **Step 7: Дописать сигнал в quiz.js**

В `js/homework/quiz.js` поменяй сигнатуру:

```js
export function createQuiz(вопросы, { document: doc = globalThis.document, onChecked = null } = {}) {
```

И в обработчике кнопки «Проверить», сразу после `результат = { correct: верных, total: годные.length };`, добавь:

```js
    // Тренажёр по-прежнему никуда не отправляет ответы: наружу уходит только
    // счёт, и только чтобы начислить баллы.
    onChecked?.({ ...результат });
```

- [ ] **Step 8: Прогнать всё**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Коммит**

```bash
git add js/ui/toast.js js/homework/quiz.js test/ui/toast.test.js test/homework/quiz.test.js && git commit -m "Плашка о начислении и сигнал от блока ВПР"
```

---

### Task 9: Начисление в уроке

**Files:**
- Modify: `js/pages/lesson.js`

- [ ] **Step 1: Подключить прогресс и посчитать состав урока**

В начало `js/pages/lesson.js` добавь импорты:

```js
import { progress } from '../progress/index.js';
import { показать } from '../ui/toast.js';
```

Рядом с `renderPractice` добавь:

```js
/**
 * Виды работы, которые в этом уроке есть. По ним потом ставится признак
 * пройденности: страница урок уже открыла, а список уроков — нет, и скачивать
 * тридцать четыре файла ради галочек не будем.
 */
function составУрока(lesson) {
  const игры = Array.isArray(lesson.game) ? lesson.game : lesson.game ? [lesson.game] : [];
  const состав = игры.map((игра, i) => `${игра.type === 'key' ? 'key' : 'game'}${i}`);
  if ((lesson.vpr ?? []).length) состав.push('vpr');
  return состав;
}

/** Ключ вида работы для игры под таким номером. */
function ключИгры(config, index) {
  return `${config.type === 'key' ? 'key' : 'game'}${index}`;
}

async function начислить(событие) {
  const итог = await progress.record(событие);
  показать(итог);
}
```

- [ ] **Step 2: Начислять за игру**

В `renderExercise` замени сигнатуру и допиши начисление. Функция вызывается из `renderPractice` как `renderExercise(one, index, configs.length)` — добавь четвёртый довод `lesson`:

```js
function renderExercise(config, index, total, lesson) {
```

В `renderPractice` вызов становится:

```js
    ...configs.map((one, index) => renderExercise(one, index, configs.length, lesson)),
```

Внутри `renderExercise`, в конце `updateScore`, после установки класса, добавь:

```js
    // Начисляем один раз на завершение, а не на каждое движение.
    if (game.isComplete() && !начислено) {
      начислено = true;
      начислить({
        lessonId: lesson.id,
        kind: config.type === 'lab' ? 'lab' : ключИгры(config, index),
        correct,
        total: всего,
        состав: составУрока(lesson),
      });
    }
```

А перед `function updateScore()` заведи флаг и сбрасывай его при «Начать заново»:

```js
  let начислено = false;
```

и в обработчике кнопки `again`:

```js
  again.addEventListener('click', () => {
    начислено = false;
    game.reset();
  });
```

- [ ] **Step 3: Начислять за блок ВПР**

В `renderVpr` добавь довод `lesson` и передай `onChecked`:

```js
function renderVpr(вопросы, естьИгра, lesson) {
  const quiz = createQuiz(вопросы, {
    onChecked: ({ correct, total }) =>
      начислить({ lessonId: lesson.id, kind: 'vpr', correct, total, состав: составУрока(lesson) }),
  });
```

Вызов в `renderPractice`:

```js
    впр.length ? renderVpr(впр, configs.length > 0, lesson) : null,
```

- [ ] **Step 4: Начислять за лабораторную**

В `renderLabRun` лабораторная создаётся без урока под рукой. Передай урок сверху: `renderSummary(lesson.summary)` в `renderTabBody` замени на `renderSummary(lesson.summary, lesson)`, и дальше протащи `lesson` через `renderSummary` → `renderBlock` → `renderLab` → `renderLabRun` четвёртым доводом. В `renderLabRun` после создания игры добавь:

```js
  let начислено = false;
  игра.onChange(() => {
    if (!игра.isComplete() || начислено) return;
    начислено = true;
    const { correct, total } = игра.getResult();
    начислить({ lessonId: lesson.id, kind: 'lab', correct, total, состав: составУрока(lesson) });
  });
```

Экспортируемая `renderBlock` используется тестом `test/lab-block.test.js` с двумя доводами — новый довод должен быть **необязательным**: при его отсутствии начисление просто не подключается.

- [ ] **Step 5: Прогнать тесты**

Run: `npm test`
Expected: PASS. Если `test/lab-block.test.js` покраснел — значит, новый довод стал обязательным; сделай его необязательным, а не правь тест.

- [ ] **Step 6: Проверить в браузере**

Открой предпросмотр по имени `bioschool`, зайди на `#/lesson/5-griby/practice`, пройди игру до конца.
Expected: снизу появляется плашка «+15» (или «+10»), через несколько секунд исчезает. В консоли браузера `JSON.parse(localStorage['bioschool.progress'])` показывает урок с начисленным.

- [ ] **Step 7: Коммит**

```bash
git add js/pages/lesson.js && git commit -m "Урок начисляет баллы за игру, лабораторную и блок ВПР"
```

---

### Task 10: Начисление за домашку и перенос при запуске

**Files:**
- Modify: `js/pages/homework.js`
- Modify: `js/app.js`

- [ ] **Step 1: Начислять после сдачи**

В `js/pages/homework.js` добавь импорты:

```js
import { progress } from '../progress/index.js';
import { показать } from '../ui/toast.js';
```

В обработчике кнопки «Сдать работу», сразу после успешного `hw.submit(...)` и до `clear(блок)`, добавь:

```js
      // Баллы начисляются по той же работе, что ушла в журнал, но журнала не
      // касаются: оценку ставит учитель, а это отдельный слой.
      показать(await progress.record({
        lessonId: lesson.id,
        kind: 'homework',
        percent: работа.percent,
        состав: [],
      }));
```

- [ ] **Step 2: Переносить прогресс при запуске**

В `js/app.js` добавь импорт:

```js
import { progress } from './progress/index.js';
```

и после вызова `updateWho()`:

```js
// Перенос прогресса в базу и обратно. Зовётся при каждом запуске: слияние
// берёт наибольшее, поэтому лишним не будет, а на новом устройстве прогресс
// приедет сам.
progress.перенести().catch(() => {});
```

- [ ] **Step 3: Прогнать тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Проверить в браузере**

С сессией тестового ученика (`Завести тестовый класс.cmd`) сдай домашку заданного урока.
Expected: плашка «+20» или «+30», в консоли `localStorage['bioschool.progress']` содержит `homework`.

- [ ] **Step 5: Коммит**

```bash
git add js/pages/homework.js js/app.js && git commit -m "Домашка начисляет баллы, прогресс переносится при запуске"
```

---

### Task 11: Страница «Мой прогресс»

**Files:**
- Create: `js/pages/me.js`
- Modify: `js/router.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Test: `test/router.test.js` (дописать)

- [ ] **Step 1: Написать падающий тест маршрута**

Допиши в `test/router.test.js`:

```js
test('свой прогресс — отдельный маршрут', () => {
  assert.deepEqual(parseRoute('#/me'), { name: 'me', params: {} });
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/router.test.js`
Expected: FAIL — вернулся `notfound`.

- [ ] **Step 3: Добавить маршрут**

В `js/router.js`, рядом с разбором `sources`:

```js
  if (parts[0] === 'me' && parts.length === 1) {
    return { name: 'me', params: {} };
  }
```

- [ ] **Step 4: Тест маршрута зелёный**

Run: `node --test test/router.test.js`
Expected: PASS.

- [ ] **Step 5: Написать страницу**

Создай `js/pages/me.js`:

```js
import { el } from '../ui/dom.js';
import { loadCourse } from '../content.js';
import { итог } from '../progress/core.js';
import { progress } from '../progress/index.js';
import { auth } from './login.js';

/**
 * Личный прогресс: ступень, баллы, серия, значки и пройденное.
 *
 * Гостю показывается то же самое — считается оно с первой секунды и без
 * входа. Разница одна: гостю говорится, что баллы живут только в этом
 * браузере, и это единственный честный повод войти.
 */
export async function renderMePage() {
  const состояние = progress.read();
  const курсы = await загрузитьКурсы(состояние);
  const свод = итог(состояние, курсы);
  const сессия = auth.current();

  return el('section', { class: 'me' }, [
    el('h1', {}, 'Мой прогресс'),
    сессия?.kind === 'student' ? null : гостю(свод),
    ступеньБлок(свод),
    серияБлок(свод),
    урокиБлок(свод),
    значкиБлок(свод),
  ]);
}

/** Курсы тех классов, уроки которых уже встречались. Пока это только пятый. */
async function загрузитьКурсы(состояние) {
  const классы = new Set(
    Object.keys(состояние.lessons ?? {})
      .map((id) => id.split('-')[0])
      .filter((g) => /^[5-9]$/.test(g)),
  );
  const курсы = [];
  for (const grade of классы) {
    try {
      курсы.push(await loadCourse(grade));
    } catch {
      // Курс не открылся — обойдёмся без разбивки по разделам.
    }
  }
  return курсы;
}

function гостю(свод) {
  return el('div', { class: 'me__guest' }, [
    el('p', {}, `Твои ${свод.xp} баллов живут только в этом браузере.`),
    el('a', { class: 'button', href: '#/login' }, 'Войти и сохранить'),
  ]);
}

function ступеньБлок({ xp, ступень }) {
  const доля = ступень.следующая
    ? Math.round(((xp - ступень.порог) / (xp + ступень.доСледующей - ступень.порог)) * 100)
    : 100;

  return el('div', { class: 'me__level' }, [
    el('p', { class: 'me__level-name' }, ступень.имя),
    el('p', { class: 'me__xp' }, `${xp} баллов`),
    полоса(доля),
    el(
      'p',
      { class: 'me__next' },
      ступень.следующая
        ? `До ступени «${ступень.следующая}» ещё ${ступень.доСледующей}`
        : 'Это последняя ступень',
    ),
  ]);
}

function серияБлок({ серия }) {
  return el('div', { class: 'me__streak' }, [
    el('p', {}, серия ? `Занимаешься ${серия} ${недель(серия)} подряд` : 'Серия начнётся с первого балла на этой неделе'),
  ]);
}

function недель(n) {
  const остаток = n % 10;
  if (n >= 11 && n <= 14) return 'недель';
  if (остаток === 1) return 'неделю';
  if (остаток >= 2 && остаток <= 4) return 'недели';
  return 'недель';
}

function урокиБлок({ уроки }) {
  if (!уроки.всего) return null;
  return el('div', { class: 'me__lessons' }, [
    el('h2', {}, 'Пройдено'),
    el('p', { class: 'me__lessons-count' }, `${уроки.пройдено} из ${уроки.всего}`),
    полоса(Math.round((уроки.пройдено / уроки.всего) * 100)),
    el(
      'ul',
      { class: 'me__sections' },
      уроки.разделы.map((р) =>
        el('li', {}, [
          el('span', { class: 'me__section-title' }, р.title),
          el('span', { class: 'me__section-count' }, `${р.пройдено} из ${р.всего}`),
        ]),
      ),
    ),
  ]);
}

function значкиБлок({ значки }) {
  return el('div', { class: 'me__awards' }, [
    el('h2', {}, 'Значки'),
    el(
      'ul',
      { class: 'me__awards-list' },
      значки.map((з) =>
        el('li', { class: з.есть ? 'award award--has' : 'award' }, [
          el('span', { class: 'award__name' }, з.имя),
          el('span', { class: 'award__hint' }, з.есть ? (з.счёт ?? 'получен') : з.условие),
        ]),
      ),
    ),
  ]);
}

function полоса(процент) {
  const заполнение = el('div', { class: 'bar__fill' });
  заполнение.setAttribute('style', `width: ${Math.max(0, Math.min(100, процент))}%`);
  return el('div', {
    class: 'bar', role: 'progressbar',
    'aria-valuenow': String(процент), 'aria-valuemin': '0', 'aria-valuemax': '100',
  }, [заполнение]);
}
```

- [ ] **Step 6: Подключить страницу и метку в шапке**

В `js/app.js` добавь импорт и запись в `PAGES`:

```js
import { renderMePage } from './pages/me.js';
```

```js
  me: renderMePage,
```

Там же расширь `updateWho`, чтобы в шапке была ступень и баллы:

```js
const уровень = document.getElementById('level');

/** Шапка показывает, кто вошёл, и на какой ты ступени. */
function updateWho() {
  const s = auth.current();
  if (!s) who.textContent = 'Войти';
  else who.textContent = s.kind === 'teacher' ? 'Учитель' : s.name.split(' ')[0];

  const свод = итог(progress.read());
  уровень.textContent = свод.xp ? `${свод.ступень.имя} · ${свод.xp}` : 'Прогресс';
}
```

с импортом `import { итог } from './progress/core.js';`. Вызывай `updateWho()` не только на старте, но и после каждой смены маршрута — добавь `updateWho();` в конец обработчика `startRouter`, после `mount.append(view)`.

В `index.html` добавь ссылку в шапку между домом и входом:

```html
    <a class="site-header__level" id="level" href="#/me">Прогресс</a>
```

- [ ] **Step 7: Прогнать тесты и посмотреть глазами**

Run: `npm test`
Expected: PASS.

Открой `#/me` в предпросмотре после прохождения пары игр.
Expected: ступень, баллы, полоса, серия «1 неделю», список значков — полученные выделены, остальные с условием.

- [ ] **Step 8: Коммит**

```bash
git add js/pages/me.js js/router.js js/app.js index.html test/router.test.js && git commit -m "Страница «Мой прогресс» и метка в шапке"
```

---

### Task 12: Шкала класса и герои недели

**Files:**
- Modify: `js/progress/store.js`
- Modify: `js/pages/me.js`
- Modify: `test/progress/store.test.js`

- [ ] **Step 1: Написать падающий тест**

Допиши в `test/progress/store.test.js`:

```js
test('шкала класса: цель — ученики на заданные уроки', async () => {
  const { p } = собрать({
    сессия: () => ({ studentId: 's1', classId: '5a' }),
    данные: {
      'leaderboard/5a': { s1: { xp: 40, weekId: '2026-W34', weekXp: 40, lessonsDone: 2 },
                          s2: { xp: 10, weekId: '2026-W33', weekXp: 10, lessonsDone: 1 } },
      'students': { s1: { name: 'Петров Иван', classId: '5a' },
                    s2: { name: 'Сидорова Аня', classId: '5a' },
                    s3: { name: 'Чужой Ученик', classId: '6б' } },
      'assignments/5a': { у1: { isOpen: true }, у2: { isOpen: true } },
    },
  });

  const шкала = await p.шкалаКласса('5a');
  assert.equal(шкала.пройдено, 3);
  assert.equal(шкала.цель, 4); // два ученика × два заданных урока
});

test('герои недели — только за текущую неделю и не больше трёх', async () => {
  const { p } = собрать({
    сессия: () => ({ studentId: 's1', classId: '5a' }),
    данные: {
      'leaderboard/5a': {
        s1: { xp: 40, weekId: '2026-W34', weekXp: 40, lessonsDone: 2 },
        s2: { xp: 90, weekId: '2026-W33', weekXp: 90, lessonsDone: 1 },
        s3: { xp: 30, weekId: '2026-W34', weekXp: 30, lessonsDone: 1 },
      },
      'students': { s1: { name: 'Петров Иван', classId: '5a' },
                    s2: { name: 'Сидорова Аня', classId: '5a' },
                    s3: { name: 'Иванов Пётр', classId: '5a' } },
      'assignments/5a': {},
    },
  });

  const шкала = await p.шкалаКласса('5a');
  assert.deepEqual(шкала.герои, [
    { имя: 'Петров Иван', xp: 40 },
    { имя: 'Иванов Пётр', xp: 30 },
  ]);
});

test('без класса шкалы нет', async () => {
  const { p } = собрать();
  assert.equal(await p.шкалаКласса(null), null);
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/progress/store.test.js`
Expected: FAIL, `p.шкалаКласса is not a function`.

- [ ] **Step 3: Дописать в store.js**

Внутрь `createProgress`, перед `return`:

```js
  /**
   * Общая шкала класса и трое лучших за неделю.
   *
   * Цель считается сама: сколько учеников на сколько заданных уроков. Ничего
   * задавать руками не надо, и цель растёт вместе с курсом.
   */
  async function шкалаКласса(classId) {
    if (!classId) return null;

    const [таблица, ученики, назначения] = await Promise.all([
      api.dbGet(`${ROOT}/leaderboard/${classId}`).catch(() => null),
      api.dbGet(`${ROOT}/students`).catch(() => null),
      api.dbGet(`${ROOT}/assignments/${classId}`).catch(() => null),
    ]);

    const свои = Object.entries(ученики ?? {}).filter(([, у]) => у.classId === classId);
    const строки = свои.map(([id, у]) => ({ id, имя: у.name, ...(таблица?.[id] ?? {}) }));
    const текущая = неделяИз(now());

    return {
      пройдено: строки.reduce((n, с) => n + (с.lessonsDone ?? 0), 0),
      цель: свои.length * Object.keys(назначения ?? {}).length,
      герои: строки
        .filter((с) => с.weekId === текущая && (с.weekXp ?? 0) > 0)
        .sort((a, b) => b.weekXp - a.weekXp)
        .slice(0, 3)
        .map((с) => ({ имя: с.имя, xp: с.weekXp })),
    };
  }
```

И добавь `шкалаКласса` в возвращаемый объект.

- [ ] **Step 4: Тесты зелёные**

Run: `node --test test/progress/store.test.js`
Expected: PASS, 15 тестов.

- [ ] **Step 5: Показать шкалу на странице**

В `js/pages/me.js`, в `renderMePage`, после `значкиБлок(свод)` добавь место под класс и наполни его отдельно — сеть не должна задерживать отрисовку личной части:

```js
  const классБлок = el('div', { class: 'me__class' });
  if (сессия?.kind === 'student' && сессия.classId) наполнитьКласс(классБлок, сессия.classId);
```

добавь `классБлок` последним ребёнком секции и напиши:

```js
async function наполнитьКласс(узел, classId) {
  let шкала;
  try {
    шкала = await progress.шкалаКласса(classId);
  } catch {
    return; // Не открылось — личная часть уже на экране, и этого достаточно.
  }
  if (!шкала) return;

  узел.append(
    el('h2', {}, 'Класс'),
    el('p', { class: 'me__class-count' },
      шкала.цель ? `Класс прошёл ${шкала.пройдено} из ${шкала.цель}` : `Класс прошёл ${шкала.пройдено} уроков`),
    полоса(шкала.цель ? Math.round((шкала.пройдено / шкала.цель) * 100) : 0),
  );

  if (шкала.герои.length) {
    узел.append(
      el('h3', {}, 'Герои недели'),
      el('ol', { class: 'me__heroes' },
        шкала.герои.map((г) => el('li', {}, `${г.имя} — ${г.xp}`))),
    );
  }
}
```

- [ ] **Step 6: Прогон и глазами**

Run: `npm test`
Expected: PASS.

Под тестовым учеником открой `#/me`.
Expected: блок «Класс» со шкалой; герои недели появляются, если на этой неделе кто-то набрал баллы.

- [ ] **Step 7: Коммит**

```bash
git add js/progress/store.js js/pages/me.js test/progress/store.test.js && git commit -m "Шкала класса и герои недели"
```

---

### Task 13: Отметки в списке уроков

**Files:**
- Modify: `js/pages/class.js`

- [ ] **Step 1: Показать состояние урока**

В `js/pages/class.js` добавь импорт:

```js
import { progress } from '../progress/index.js';
```

Замени `renderClassPage` и `renderSection` так, чтобы состояние прогресса пробрасывалось в разметку:

```js
  const состояние = progress.read();
  ...
    ...course.sections.map((section) => renderSection(section, состояние)),
```

```js
function renderSection(section, состояние) {
  const items = section.lessons.map((entry) =>
    el('li', {}, [
      el('a', { class: 'lesson-link', href: `#/lesson/${entry.id}` }, entry.title),
      метка(состояние.lessons?.[entry.id]),
    ]),
  );
```

и добавь:

```js
/**
 * Отметка о состоянии урока. Нужна ровно затем, чтобы в списке из тридцати
 * четырёх одинаковых строк было видно, куда идти дальше.
 */
function метка(урок) {
  if (!урок) return null;
  if (урок.done) return el('span', { class: 'lesson-mark lesson-mark--done', title: 'Пройден' }, '✓');
  return el('span', { class: 'lesson-mark lesson-mark--started', title: 'Начат' }, '·');
}
```

- [ ] **Step 2: Прогон и глазами**

Run: `npm test`
Expected: PASS.

Открой `#/class/5` после прохождения одного урока целиком и одного наполовину.
Expected: у первого галочка, у второго точка, у остальных ничего.

- [ ] **Step 3: Коммит**

```bash
git add js/pages/class.js && git commit -m "Отметки о пройденных уроках в списке класса"
```

---

### Task 14: Вкладка учителя «Прогресс»

**Files:**
- Create: `js/pages/teacher-progress.js`
- Modify: `js/pages/teacher.js`
- Modify: `js/router.js`
- Modify: `test/router.test.js`
- Test: `test/teacher/progress.test.js`

- [ ] **Step 1: Написать падающий тест маршрута и сборки**

Допиши в `test/router.test.js`:

```js
test('у панели учителя есть вид «прогресс»', () => {
  assert.deepEqual(parseRoute('#/teacher/progress'), { name: 'teacher', params: { view: 'progress' } });
});
```

Создай `test/teacher/progress.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { собратьПрогресс, ДАВНО_НЕ_БЫЛ_МС } from '../../js/pages/teacher-progress.js';

const СЕЙЧАС = new Date(2026, 7, 18).getTime();
const ДЕНЬ = 86400000;

test('строки сортируются по фамилии, а не по баллам', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'Яковлев Пётр', classId: '5a' }, s2: { name: 'Абрамова Ася', classId: '5a' } },
    leaderboard: { s1: { xp: 100 }, s2: { xp: 10 } },
    сейчас: СЕЙЧАС,
  });
  assert.deepEqual(строки.map((с) => с.имя), ['Абрамова Ася', 'Яковлев Пётр']);
});

test('ученик без единого балла попадает в список нулём', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'Петров Иван', classId: '5a' } },
    leaderboard: {},
    сейчас: СЕЙЧАС,
  });
  assert.equal(строки[0].xp, 0);
  assert.equal(строки[0].ступень, 'Наблюдатель');
});

test('две недели без захода помечаются', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'А', classId: '5a' }, s2: { name: 'Б', classId: '5a' } },
    leaderboard: { s1: { xp: 10, lastSeen: СЕЙЧАС - ДЕНЬ }, s2: { xp: 10, lastSeen: СЕЙЧАС - 15 * ДЕНЬ } },
    сейчас: СЕЙЧАС,
  });
  assert.equal(строки[0].давноНеБыл, false);
  assert.equal(строки[1].давноНеБыл, true);
});

test('ученики чужих классов не попадают', () => {
  const { строки } = собратьПрогресс({
    classId: '5a',
    students: { s1: { name: 'А', classId: '5a' }, s2: { name: 'Б', classId: '6б' } },
    leaderboard: {},
    сейчас: СЕЙЧАС,
  });
  assert.equal(строки.length, 1);
});

test('порог «давно не был» — две недели', () => {
  assert.equal(ДАВНО_НЕ_БЫЛ_МС, 14 * ДЕНЬ);
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `node --test test/teacher/progress.test.js test/router.test.js`
Expected: FAIL, `Cannot find module` и `notfound` вместо вида `progress`.

- [ ] **Step 3: Добавить вид в маршрут**

В `js/router.js` в списке видов панели:

```js
    const виды = ['check', 'classes', 'assign', 'progress'];
```

- [ ] **Step 4: Написать вкладку**

Создай `js/pages/teacher-progress.js`:

```js
import { el } from '../ui/dom.js';
import { ступень } from '../progress/core.js';

/** Две недели без единого захода — повод спросить, что случилось. */
export const ДАВНО_НЕ_БЫЛ_МС = 14 * 86400000;

/**
 * Собирает таблицу прогресса класса. Чистая функция: получает уже загруженные
 * данные и ничего не запрашивает — иначе её не проверить без сети.
 *
 * Ученики без единой записи в таблице тоже в списке: именно они и есть тот
 * сигнал, ради которого вкладка заведена.
 */
export function собратьПрогресс({ classId, students = {}, leaderboard = {}, сейчас = Date.now() }) {
  const строки = Object.entries(students)
    .filter(([, у]) => у.classId === classId)
    .map(([id, у]) => {
      const запись = leaderboard[id] ?? {};
      const xp = запись.xp ?? 0;
      return {
        id,
        имя: у.name,
        xp,
        ступень: ступень(xp).имя,
        уроков: запись.lessonsDone ?? 0,
        заНеделю: запись.weekXp ?? 0,
        последний: запись.lastSeen ?? null,
        давноНеБыл: !запись.lastSeen || сейчас - запись.lastSeen > ДАВНО_НЕ_БЫЛ_МС,
      };
    })
    .sort((a, b) => a.имя.localeCompare(b.имя, 'ru'));

  return { строки };
}

/** Отрисовка таблицы. */
export function показатьПрогресс({ classes = {}, students = {}, leaderboards = {} }) {
  const списки = Object.entries(classes);
  if (!списки.length) return el('div', { class: 'empty' }, [el('p', {}, 'Классов пока нет.')]);

  return el(
    'div',
    { class: 'teacher-progress' },
    списки.map(([classId, класс]) => {
      const { строки } = собратьПрогресс({
        classId, students, leaderboard: leaderboards[classId] ?? {},
      });

      return el('div', { class: 'teacher-progress__class' }, [
        el('h2', {}, класс.title ?? classId),
        строки.length
          ? el('table', { class: 'journal' }, [
              el('thead', {}, [
                el('tr', {}, [
                  el('th', {}, 'Ученик'), el('th', {}, 'Ступень'), el('th', {}, 'Баллы'),
                  el('th', {}, 'За неделю'), el('th', {}, 'Уроков'), el('th', {}, 'Последний заход'),
                ]),
              ]),
              el('tbody', {}, строки.map((с) =>
                el('tr', { class: с.давноНеБыл ? 'row--stale' : null }, [
                  el('td', {}, с.имя),
                  el('td', {}, с.ступень),
                  el('td', {}, String(с.xp)),
                  el('td', {}, String(с.заНеделю)),
                  el('td', {}, String(с.уроков)),
                  el('td', {}, с.последний
                    ? new Date(с.последний).toLocaleDateString('ru-RU')
                    : 'ни разу'),
                ]),
              )),
            ])
          : el('p', { class: 'empty' }, 'В этом классе пока нет учеников.'),
      ]);
    }),
  );
}
```

- [ ] **Step 5: Подключить вкладку к панели**

В `js/pages/teacher.js`:

- импорт: `import { показатьПрогресс } from './teacher-progress.js';`
- в разметке вкладок, после «Задать урок»: `вкладка('progress', 'Прогресс', view),`
- в `наполнить`, рядом с прочими видами: `else if (view === 'progress') тело.append(показатьПрогресс(всё));`

В `js/teacher/data.js`, в `загрузитьВсё`, добавь чтение таблиц. Узел `leaderboard` открыт на чтение целиком и уже разложен по классам, поэтому берётся одним запросом:

```js
    const [classes, students, assignments, submissions, leaderboards] = await Promise.all([
      api.dbGet(`${ROOT}/classes`, { token }),
      api.dbGet(`${ROOT}/students`, { token }),
      api.dbGet(`${ROOT}/assignments`, { token }),
      api.dbGet(`${ROOT}/submissions`, { token }),
      // Пустая таблица — это ноль баллов, а не сбой: до первой игры её нет.
      api.dbGet(`${ROOT}/leaderboard`, { token }).catch(() => null),
    ]);

    return {
      classes: classes ?? {},
      students: students ?? {},
      assignments: assignments ?? {},
      submissions: submissions ?? {},
      leaderboards: leaderboards ?? {},
    };
```

- [ ] **Step 6: Прогон и глазами**

Run: `npm test`
Expected: PASS.

Войди учителем, открой `#/teacher/progress`.
Expected: по классу таблица со всеми учениками; у не заходивших — «ни разу» и подсветка строки.

- [ ] **Step 7: Коммит**

```bash
git add js/pages/teacher-progress.js js/pages/teacher.js js/teacher/data.js js/router.js test/teacher/progress.test.js test/router.test.js && git commit -m "Панель учителя: вкладка «Прогресс»"
```

---

### Task 15: Оформление

**Files:**
- Modify: `css/base.css`

- [ ] **Step 1: Написать стили**

Допиши в конец `css/base.css`. Своих цветов не вводи — всё берётся из `css/tokens.css`, поэтому тёмная тема получается сама:

```css
/* ── Прогресс ──────────────────────────────────────────────── */

.site-header__level {
  color: var(--ink-soft);
  font-family: var(--font-ui);
  font-size: 0.85rem;
}

.bar {
  background: var(--paper-sunk);
  border-radius: var(--radius-sm);
  height: calc(var(--step) * 2);
  margin: calc(var(--step) * 2) 0;
  overflow: hidden;
}

.bar__fill {
  background: var(--moss);
  height: 100%;
  transition: width 0.6s var(--ease-out);
}

.me__level-name {
  font-size: 1.6rem;
  font-weight: 600;
  margin: 0;
}

.me__xp {
  color: var(--ink-soft);
  margin: calc(var(--step)) 0 0;
}

.me__next,
.me__streak {
  color: var(--ink-soft);
  font-size: 0.95rem;
}

.me__guest {
  background: var(--wash);
  border-radius: var(--radius);
  padding: calc(var(--step) * 4);
  margin-bottom: calc(var(--step) * 5);
}

.me__lessons-count {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
}

.me__sections {
  list-style: none;
  padding: 0;
}

.me__sections li {
  border-bottom: 1px solid var(--line-soft);
  display: flex;
  gap: calc(var(--step) * 2);
  justify-content: space-between;
  padding: calc(var(--step) * 2) 0;
}

.me__section-count {
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.me__awards-list {
  display: grid;
  gap: calc(var(--step) * 3);
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  list-style: none;
  padding: 0;
}

.award {
  background: var(--paper-sunk);
  border-radius: var(--radius);
  color: var(--ink-faint);
  display: flex;
  flex-direction: column;
  gap: var(--step);
  padding: calc(var(--step) * 3);
}

.award--has {
  background: var(--paper-raised);
  box-shadow: var(--shadow-rest);
  color: var(--ink);
}

.award__name { font-weight: 600; }
.award__hint { font-size: 0.85rem; }

.me__heroes {
  color: var(--ink-soft);
  padding-left: calc(var(--step) * 5);
}

.lesson-mark {
  color: var(--moss);
  font-family: var(--font-ui);
  margin-left: calc(var(--step) * 2);
}

.lesson-mark--started { color: var(--ink-muted); }

/*
  Плашка живёт поверх содержимого и уходит сама. Снизу оставлен отступ под
  безопасную зону: на телефоне туда попадает системная полоса.
*/
.toast {
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--step) * 5);
  box-shadow: var(--shadow-lift);
  left: 50%;
  padding: calc(var(--step) * 3) calc(var(--step) * 5);
  position: fixed;
  text-align: center;
  transform: translateX(-50%);
  z-index: 10;
}

.toast__xp {
  color: var(--moss);
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
}

.toast__award {
  margin: var(--step) 0 0;
}

.row--stale {
  color: var(--ink-faint);
}
```

- [ ] **Step 2: Проверить в светлой и тёмной теме**

В предпросмотре открой `#/me` и `#/class/5`, переключи тему (в браузере — эмуляция `prefers-color-scheme`), сними экран в обеих. Перед снимком выключи анимацию строкой из `STATUS.md` (раздел «Снимки экрана делать можно»).

Expected: читаемо в обеих темах, ничего не выезжает за экран на ширине телефона (375 px).

- [ ] **Step 3: Коммит**

```bash
git add css/base.css && git commit -m "Оформление прогресса, значков и плашки"
```

---

### Task 16: Записать состояние

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Обновить STATUS.md**

- В «Что работает» добавь раздел про геймификацию: экономика, ступени, значки, серия по неделям, шкала класса, вкладка учителя. Коротко, в тон остальному файлу — что работает и почему сделано так.
- Из «Что дальше» убери пункт 1 «Геймификация»; следующим остаётся наполнение 6 класса.
- В «Что ждёт проверки глазами» допиши: правила `leaderboard` должны быть опубликованы владельцем проекта, до публикации запись в таблицу класса будет отклоняться и шкала останется пустой.
- Обнови число тестов в шапке файла: возьми его из вывода `npm test`.

- [ ] **Step 2: Финальный прогон**

Run: `npm test`
Expected: PASS, число тестов совпадает с записанным в `STATUS.md`.

- [ ] **Step 3: Коммит**

```bash
git add STATUS.md && git commit -m "STATUS: геймификация сделана"
```

---

## Чего этот план не делает

Сознательно оставлено за границей — при появлении соблазна сверяйся со спецификацией, раздел «Что сюда не входит»: дневные серии, трата баллов, ручная выдача значков, соревнование между классами, уведомления.
