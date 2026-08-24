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

    // Последний рубеж, а не способ прятать ошибки: `начислить` намеренно
    // падает на негодном событии (неизвестный kind, нет lessonId) — это
    // верно для тестов и разработки, где такое исключение обязано быть
    // громким. Но в браузере ученик к этому моменту уже прошёл игру, и
    // ценой необработанного исключения был бы сорванный урок, а не баг в
    // консоли. Поэтому здесь исключение гасится, хранилище не трогается,
    // а сам отказ ядра как был, так и остаётся ловиться тестами core.js.
    let подсчитано;
    try {
      подсчитано = начислить(было, событие, now());
    } catch {
      return { добавлено: 0, значки: [], состояние: было };
    }

    const { состояние, добавлено } = подсчитано;
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
