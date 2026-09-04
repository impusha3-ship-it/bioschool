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
  // «Урок на отлично» здесь тоже выдаётся, и это верно: весь состав урока в
  // этой проверке — одна игра, и она пройдена начисто. В настоящем уроке так
  // не бывает, планка требует ещё и блок ВПР.
  assert.deepEqual(первое.значки.map((з) => з.id).sort(), ['clean-game', 'first', 'lesson-perfect']);
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

test('слияние сохраняет незнакомое поле и не занижает версию', () => {
  const a = { v: 2, lessons: {}, weeks: {}, lastSeen: 0, future: 'x' };
  const b = { v: 1, lessons: {}, weeks: {}, lastSeen: 0 };
  const результат = слить(a, b);
  assert.equal(результат.v, 2);
  assert.equal(результат.future, 'x');
});

test('испорченное числом значение при слиянии не даёт NaN', () => {
  const a = { v: 1, lessons: { у1: { game0: 'abc' } }, weeks: { '2026-W33': 'nope' }, lastSeen: 0 };
  const b = { v: 1, lessons: { у1: { game0: 10 } }, weeks: { '2026-W33': 5 }, lastSeen: 0 };
  const результат = слить(a, b);
  assert.equal(результат.lessons['у1'].game0, 10);
  assert.equal(результат.weeks['2026-W33'], 5);
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
  await p.дождатьсяОтправки(); // отказ уже проглочен внутри, тут просто ждём, чтобы не утекало в следующий тест
});

test('отказ хранилища при записи не мешает начислению', async () => {
  const storage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
  const { p } = собрать({ storage });

  const { добавлено } = await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.equal(добавлено, 15);
});

test('негодное событие не роняет запись и не портит накопленное', async () => {
  const { p } = собрать();
  await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });

  const результат = await p.record({ lessonId: 'у1', kind: 'дз' });
  assert.equal(результат.добавлено, 0);
  assert.deepEqual(результат.значки, []);
  assert.equal(p.read().lessons['у1'].game0, 15);
});

test('слияние не зависит от порядка доводов', () => {
  const a = { v: 1, lessons: { у1: { game0: 15 } }, weeks: { '2026-W33': 19 }, lastSeen: 5 };
  const b = { v: 1, lessons: { у1: { game0: 10 }, у2: { lab: 20 } }, weeks: { '2026-W34': 3 }, lastSeen: 9 };
  assert.deepEqual(слить(a, b), слить(b, a));
});

test('незнакомое поле берётся из более свежего источника, а не из второго довода', () => {
  // Иначе место вызова молча решало бы, чей черновик выживет: слияние
  // локального с облачным происходит в разных местах и в разном порядке.
  const старое = { v: 1, lessons: {}, weeks: {}, lastSeen: 5, черновик: 'старый' };
  const свежее = { v: 1, lessons: {}, weeks: {}, lastSeen: 9, черновик: 'свежий' };
  assert.equal(слить(старое, свежее).черновик, 'свежий');
  assert.equal(слить(свежее, старое).черновик, 'свежий');
});

test('вошедший пишет в свою ветку и в таблицу класса', async () => {
  const { p, записи } = собрать({ сессия: () => ({ studentId: 's1', classId: '5a' }) });
  await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  await p.дождатьсяОтправки();
  const пути = записи.map((з) => з.path);
  assert.equal(пути.some((п) => п.endsWith('progress/s1/game')), true);
  assert.equal(пути.some((п) => п.endsWith('leaderboard/5a/s1')), true);
});

test('выжимка несёт баллы, неделю и пройденные уроки', async () => {
  const { p, записи } = собрать({ сессия: () => ({ studentId: 's1', classId: '5a' }) });
  await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  await p.дождатьсяОтправки();
  const строка = записи.find((з) => з.path.endsWith('leaderboard/5a/s1')).value;
  assert.deepEqual(строка, {
    xp: 15, weekId: '2026-W34', weekXp: 15, lessonsDone: 1, lastSeen: ДАТА.getTime(),
  });
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

test('повторный перенос ничего не меняет', async () => {
  const storage = память({ v: 1, lessons: { у1: { game0: 15 } }, weeks: { '2026-W34': 15 }, lastSeen: 1 });
  const { p } = собрать({ storage, сессия: () => ({ studentId: 's1', classId: '5a' }) });
  const первый = await p.перенести();
  const второй = await p.перенести();
  assert.deepEqual(первый, второй);
});

test('отказ чтения при переносе оставляет локальное нетронутым', async () => {
  const storage = память({ v: 1, lessons: { у1: { game0: 15 } }, weeks: { '2026-W34': 15 }, lastSeen: 1 });
  const api = {
    dbGet: async () => { throw new Error('Доступ запрещён.'); },
    dbPut: async () => null,
  };
  const p = createProgress({
    api, storage, сессия: () => ({ studentId: 's1', classId: '5a' }),
    токен: async () => 'т', now: () => ДАТА,
  });

  assert.equal(await p.перенести(), null);
  assert.equal(p.read().lessons['у1'].game0, 15);
});

test('наружу торчит только то, чем пользуются страницы', () => {
  const { p } = собрать();
  assert.deepEqual(
    Object.keys(p).sort(),
    ['record', 'read', 'дождатьсяОтправки', 'забыть', 'перенести', 'шкалаКласса'].sort(),
  );
});

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

test('чужой в таблице класса не считается своим', async () => {
  // Правила базы это запрещают, но таблица открыта на чтение, и опираться
  // на неё как на список класса нельзя: список — только students.
  const { p } = собрать({
    сессия: () => ({ studentId: 's1', classId: '5a' }),
    данные: {
      'leaderboard/5a': { s1: { xp: 10, weekId: '2026-W34', weekXp: 10, lessonsDone: 1 },
                          чужой: { xp: 999, weekId: '2026-W34', weekXp: 999, lessonsDone: 34 } },
      'students': { s1: { name: 'Петров Иван', classId: '5a' } },
      'assignments/5a': { у1: { isOpen: true } },
    },
  });

  const шкала = await p.шкалаКласса('5a');
  assert.equal(шкала.пройдено, 1);
  assert.deepEqual(шкала.герои, [{ имя: 'Петров Иван', xp: 10 }]);
});

test('без класса шкалы нет', async () => {
  const { p } = собрать();
  assert.equal(await p.шкалаКласса(null), null);
});

test('отказ чтения не роняет шкалу', async () => {
  const api = { dbGet: async () => { throw new Error('Доступ запрещён.'); }, dbPut: async () => null };
  const p = createProgress({ api, storage: память(), сессия: () => null, токен: async () => null, now: () => ДАТА });
  const шкала = await p.шкалаКласса('5a');
  assert.deepEqual(шкала, { пройдено: 0, цель: 0, герои: [] });
});

// ── Общее устройство ─────────────────────────────────────────

/*
  Ошибка, найденная на живом сайте 3 сентября: семеро учеников оказались
  с почти одинаковыми баллами в районе 730, при том что пройденных уроков
  у них было от пяти до четырнадцати.

  Причина: браузерный прогресс лежит под одним ключом на всё устройство,
  а перенос сливал его с облачным для того, кто вошёл. На общем школьном
  компьютере это значило, что каждый следующий вошедший забирал себе всю
  работу предыдущего.
*/
test('чужой прогресс с общего устройства не достаётся вошедшему', async () => {
  const storage = память();

  // Первый ученик поработал и вошёл: его работа ушла в облако — так и надо.
  const первый = собрать({ storage, сессия: () => ({ studentId: 'первый' }) });
  await первый.p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  await первый.p.перенести();
  assert.equal(первый.p.read().lessons['у1'].game0, 15);

  // На том же устройстве входит второй. В облаке у него пусто.
  const второй = собрать({ storage, сессия: () => ({ studentId: 'второй' }) });
  await второй.p.перенести();

  assert.equal(
    второй.p.read().lessons['у1'],
    undefined,
    'работа первого ученика не должна попасть второму',
  );
});

test('свой же прогресс с другого устройства подтягивается по-прежнему', async () => {
  const storage = память();
  const { p } = собрать({
    storage,
    сессия: () => ({ studentId: 'он-же' }),
    данные: { '/progress/он-же/game': { v: 1, lessons: { у9: { vpr: 10 } }, weeks: {}, lastSeen: 1 } },
  });
  await p.перенести();
  assert.equal(p.read().lessons['у9'].vpr, 10, 'своё облачное должно приехать');
});

// Гость считается наравне — это отдельное решение, и ломать его нельзя:
// баллы копятся до входа, и вход не должен их обнулять.
test('работа гостя при первом входе засчитывается', async () => {
  const storage = память();

  const гость = собрать({ storage });
  await гость.p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });

  const вошёл = собрать({ storage, сессия: () => ({ studentId: 'новичок' }) });
  await вошёл.p.перенести();
  assert.equal(вошёл.p.read().lessons['у1'].game0, 15, 'наработанное до входа должно остаться');
});

test('после выхода браузер не помнит чужих баллов', async () => {
  const storage = память();
  const { p } = собрать({ storage, сессия: () => ({ studentId: 'первый' }) });
  await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });

  p.забыть();

  assert.deepEqual(собрать({ storage }).p.read().lessons, {},
    'следующий за этим компьютером не должен видеть чужую работу');
});

// ── Обнуление класса ─────────────────────────────────────────

/*
  Обнулить баллы только в базе недостаточно: у каждого ребёнка в браузере
  лежит своя копия, и при следующем заходе перенос залил бы её обратно.
  Поэтому сброс помечается в облачной записи временем, и локальная копия,
  наработанная до этого времени, отбрасывается.
*/
test('после обнуления старая копия из браузера не возвращается', async () => {
  const storage = память();
  const { p } = собрать({ storage, сессия: () => ({ studentId: 'с1' }) });
  await p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  const наработано = p.read().lastSeen;

  const после = собрать({
    storage,
    сессия: () => ({ studentId: 'с1' }),
    данные: { '/progress/с1/game': { v: 1, lessons: {}, weeks: {}, lastSeen: 0, resetAt: наработано + 1 } },
  });
  await после.p.перенести();

  assert.deepEqual(после.p.read().lessons, {}, 'обнуление должно пережить возврат ученика');
});

test('работа после обнуления не пропадает', async () => {
  const storage = память();
  const сброс = ДАТА.getTime() - 1000;
  const данные = { '/progress/с1/game': { v: 1, lessons: {}, weeks: {}, lastSeen: 0, resetAt: сброс } };

  // Ученик поработал уже после сброса — его новое трогать нельзя.
  const { p } = собрать({ storage, сессия: () => ({ studentId: 'с1' }), данные });
  await p.record({ lessonId: 'у2', kind: 'vpr', correct: 5, total: 5, состав: ['vpr'] });
  await p.перенести();

  assert.equal(p.read().lessons['у2'].vpr, 10);
});

/*
  Перенос при запуске зовётся без ожидания: страница не должна ждать сеть.
  Значит, между входом и переносом есть окно, и ребёнок успевает в нём
  что-то пройти. Если в браузере лежит чужая работа, она в этот момент
  уйдёт в облако уже как его — перенос просто не успеет её вытеснить.

  Поэтому чужая запись считается пустой в самой точке чтения: тогда её не
  видно ни на экране, ни в начислении, ни в отправке.
*/
test('чужая запись в браузере не видна вошедшему до всякого переноса', async () => {
  const storage = память();
  const первый = собрать({ storage, сессия: () => ({ studentId: 'первый' }) });
  await первый.p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });

  const второй = собрать({ storage, сессия: () => ({ studentId: 'второй' }) });
  assert.deepEqual(второй.p.read().lessons, {}, 'на экране у второго не должно быть чужого');
});

test('чужая работа не уходит в облако как своя при быстром клике', async () => {
  const storage = память();
  const первый = собрать({ storage, сессия: () => ({ studentId: 'первый' }) });
  await первый.p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });

  // Второй вошёл и сразу играет — перенос ещё не отработал.
  const записи = [];
  const второй = собрать({ storage, записи, сессия: () => ({ studentId: 'второй', classId: '7a' }) });
  await второй.p.record({ lessonId: 'у2', kind: 'vpr', correct: 5, total: 5, состав: ['vpr'] });
  await второй.p.дождатьсяОтправки();

  const ушло = записи.find((з) => з.path.endsWith('progress/второй/game')).value;
  assert.equal(ушло.lessons['у1'], undefined, 'работа первого не должна попасть в облако второго');
  assert.equal(ушло.lessons['у2'].vpr, 10, 'своё при этом уходит');
});

test('гость видит своё и после входа не теряет его', async () => {
  const storage = память();
  const гость = собрать({ storage });
  await гость.p.record({ lessonId: 'у1', kind: 'game0', correct: 8, total: 8, состав: ['game0'] });
  assert.equal(гость.p.read().lessons['у1'].game0, 15, 'гость видит свои баллы');

  const вошёл = собрать({ storage, сессия: () => ({ studentId: 'новичок' }) });
  assert.equal(вошёл.p.read().lessons['у1'].game0, 15, 'ничьё достаётся вошедшему');
});
