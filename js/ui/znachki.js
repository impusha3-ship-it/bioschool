/**
 * Рисунки значков.
 *
 * Лежат в коде, а не отдельными файлами: их тринадцать, каждый в десяток
 * строк, и тринадцать запросов ради этого — плохая сделка. Рисуются они
 * штрихом и берут цвет от строки значка через `currentColor`, поэтому
 * полученный значок зелёный, неполученный — блёклый, и тёмная тема
 * подхватывается сама, без единого правила на каждый рисунок.
 *
 * Язык рисунков — тот же, что у схем сайта: гербарий и лаборатория.
 */

const РИСУНКИ = {
  // Первый шаг: семя дало один листок. Дальше расти некуда — это начало.
  first: `<path d="M12 21v-8"/><path d="M12 13c-4 0-6-3-6-6 3 0 6 2 6 6z"/>`,

  // Без ошибок: попадание в середину.
  'clean-game': `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>`,

  // Чистая работа: пробирка, ничего не пролито.
  'clean-lab': `<path d="M9.5 3h5"/><path d="M10.5 3v11.2a3.5 3.5 0 1 0 3 0V3"/><path d="M9.6 15.4h4.8"/>`,

  // Ботаник: лупа над листом с жилкой.
  botanist: `<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2 21 21"/><path d="M7.6 13.4c0-3.2 2.4-5.4 5.4-5.6-.2 3-2.4 5.4-5.4 5.6z"/><path d="M13 7.8 7.9 13.1"/>`,

  // Все пять: пять делений блока ВПР, все взяты.
  'vpr-full': `<rect x="2.6" y="8.5" width="3.2" height="7" rx="1" fill="currentColor" stroke="none"/><rect x="6.6" y="8.5" width="3.2" height="7" rx="1" fill="currentColor" stroke="none"/><rect x="10.6" y="8.5" width="3.2" height="7" rx="1" fill="currentColor" stroke="none"/><rect x="14.6" y="8.5" width="3.2" height="7" rx="1" fill="currentColor" stroke="none"/><rect x="18.6" y="8.5" width="3.2" height="7" rx="1" fill="currentColor" stroke="none"/>`,

  // Месяц подряд: четыре недели в календаре.
  month: `<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9h17M8 3v3.4M16 3v3.4"/><rect x="6.6" y="11.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="11.2" y="11.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="6.6" y="15.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="11.2" y="15.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/>`,

  // Четверть подряд: тот же календарь, но закрашен весь.
  quarter: `<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9h17M8 3v3.4M16 3v3.4"/><rect x="6" y="11.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="10.4" y="11.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="14.8" y="11.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="6" y="15.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="10.4" y="15.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="14.8" y="15.4" width="3.2" height="2.6" rx="0.6" fill="currentColor" stroke="none"/>`,

  // Раздел закрыт: стопка гербарных листов, верхний подписан.
  section: `<rect x="6.5" y="3.5" width="13" height="15" rx="1.6"/><path d="M4.5 6.5v13a1.6 1.6 0 0 0 1.6 1.6h11"/><path d="M9.6 8h6.8M9.6 11.2h6.8M9.6 14.4h4.2"/>`,

  // Год закрыт: выросшее дерево. Кольца на спиле пробовались первыми, но
  // вышли неотличимы от мишени значка «Без ошибок».
  year: `<path d="M12 21v-5"/><path d="M7.6 16c-2.5 0-4.4-1.9-4.4-4.2 0-1.9 1.3-3.4 3.1-3.9C6.6 5.2 9 3 12 3s5.4 2.2 5.7 4.9c1.8.5 3.1 2 3.1 3.9 0 2.3-1.9 4.2-4.4 4.2z"/>`,

  // Урок на отлично: гербарный лист с печатью в углу.
  'lesson-perfect': `<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7.2 8.4h6.4M7.2 12h4.6"/><path d="m16.4 12.6 1.1 2.2 2.4.35-1.75 1.7.41 2.4-2.16-1.14-2.16 1.14.41-2.4-1.75-1.7 2.42-.35z" fill="currentColor" stroke="none"/>`,

  // Отличник: тетрадь, и в ней пятёрка.
  'five-homework': `<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 3.5v17"/><path d="M14.6 8.2h-2.9l-.35 3.1c1.9-.9 3.6.15 3.6 2.1 0 1.5-1.2 2.6-2.7 2.6-1 0-1.9-.45-2.4-1.2"/>`,

  // Ударная неделя: неделя из семи дней, и один вырос выше всех.
  'week-100': `<path d="M3 20h18"/><rect x="4" y="15.5" width="2.2" height="4.5" rx="0.6" fill="currentColor" stroke="none"/><rect x="7.2" y="13.5" width="2.2" height="6.5" rx="0.6" fill="currentColor" stroke="none"/><rect x="10.4" y="4" width="2.2" height="16" rx="0.9" fill="currentColor" stroke="none"/><rect x="13.6" y="14.5" width="2.2" height="5.5" rx="0.6" fill="currentColor" stroke="none"/><rect x="16.8" y="16.5" width="2.2" height="3.5" rx="0.6" fill="currentColor" stroke="none"/>`,

  // Твёрдая рука: три подряд верных попадания, ни одной осечки.
  'three-clean': `<path d="m2.6 12.6 1.8 2 3.4-4.4"/><path d="m10 12.6 1.8 2 3.4-4.4"/><path d="m17.4 12.6 1.8 2 3.4-4.4"/>`,
};

/** Разметка рисунка для значка. Незнакомому значку — росток: он ничей не займёт. */
export function рисунокЗначка(id) {
  return РИСУНКИ[id] ?? РИСУНКИ.first;
}

export const ЕСТЬ_РИСУНОК = Object.keys(РИСУНКИ);
