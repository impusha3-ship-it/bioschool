import { el } from '../ui/dom.js';
import { ступень } from '../progress/core.js';

/** Две недели без единого захода — повод спросить, что случилось. */
export const ДАВНО_НЕ_БЫЛ_МС = 14 * 86400000;

/**
 * Собирает таблицу прогресса класса.
 *
 * Чистая функция: получает уже загруженные данные и ничего не запрашивает —
 * иначе её не проверить без сети.
 *
 * Ученики без единой записи в таблице тоже в списке, нулём. Именно они и есть
 * тот сигнал, ради которого вкладка заведена: пропавшего видно только тогда,
 * когда его строка на месте.
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

/**
 * Таблица по каждому классу. Сортировка по фамилии, а не по баллам: список
 * учеников учитель читает глазами по алфавиту, а рейтинг ему тут не нужен.
 */
export function показатьПрогресс({ classes = {}, students = {}, leaderboards = {} }) {
  const списки = Object.entries(classes);
  if (!списки.length) return el('div', { class: 'empty' }, [el('p', {}, 'Классов пока нет.')]);

  return el(
    'div',
    { class: 'teacher-progress' },
    списки.map(([classId, класс]) => {
      const { строки } = собратьПрогресс({
        classId,
        students,
        leaderboard: leaderboards[classId] ?? {},
      });

      return el('div', { class: 'teacher-progress__class' }, [
        el('h2', {}, класс.title ?? classId),
        строки.length ? таблица(строки) : el('p', { class: 'empty' }, 'В этом классе пока нет учеников.'),
      ]);
    }),
  );
}

function таблица(строки) {
  return el('table', { class: 'journal' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, 'Ученик'),
        el('th', {}, 'Ступень'),
        el('th', {}, 'Баллы'),
        el('th', {}, 'За неделю'),
        el('th', {}, 'Уроков'),
        el('th', {}, 'Последний заход'),
      ]),
    ]),
    el(
      'tbody',
      {},
      строки.map((с) =>
        el('tr', { class: с.давноНеБыл ? 'row--stale' : null }, [
          el('td', {}, с.имя),
          el('td', {}, с.ступень),
          el('td', {}, String(с.xp)),
          el('td', {}, String(с.заНеделю)),
          el('td', {}, String(с.уроков)),
          el('td', {}, с.последний ? new Date(с.последний).toLocaleDateString('ru-RU') : 'ни разу'),
        ]),
      ),
    ),
  ]);
}
