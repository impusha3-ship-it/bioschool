import { el } from '../ui/dom.js';
import { loadCourse } from '../content.js';
import { progress } from '../progress/index.js';

export async function renderClassPage({ grade }) {
  let course;
  try {
    course = await loadCourse(grade);
  } catch (error) {
    return el('section', { class: 'error' }, [
      el('h1', {}, 'Класс не найден'),
      el('p', {}, error.message),
      el('a', { class: 'button', href: '#/' }, 'На главную'),
    ]);
  }

  return el('section', { class: 'course' }, [
    el('a', { class: 'back-link', href: '#/' }, '← Все классы'),
    el('h1', { class: 'course__title' }, course.title),
    course.subtitle ? el('p', { class: 'course__sub' }, course.subtitle) : null,
    ...course.sections.map((section) => renderSection(section, progress.read())),
  ]);
}

function renderSection(section, состояние) {
  // Заголовки берём из файла курса, а не скачиваем каждый урок ради названия.
  const items = section.lessons.map((entry) =>
    el('li', {}, [
      el('a', { class: 'lesson-link', href: `#/lesson/${entry.id}` }, entry.title),
      // Пометка о лабораторной стоит в файле курса, а не вычисляется из урока:
      // иначе ради шести значков пришлось бы скачать все тридцать четыре.
      // Тест следит, чтобы пометка не разошлась с уроками.
      entry.lab ? el('span', { class: 'lesson-lab' }, '(+ лабораторная)') : null,
      метка(состояние.lessons?.[entry.id]),
    ]),
  );

  return секция(section, items);
}

/**
 * Отметка о состоянии урока. Нужна затем, чтобы в списке из тридцати четырёх
 * одинаковых строк было видно, куда идти дальше: до этого пройденный урок и
 * нетронутый выглядели одинаково.
 */
function метка(урок) {
  if (!урок) return null;
  if (урок.done) {
    return el('span', { class: 'lesson-mark lesson-mark--done', title: 'Пройден' }, '✓');
  }
  return el('span', { class: 'lesson-mark lesson-mark--started', title: 'Начат' }, '·');
}

function секция(section, items) {
  return el('div', { class: 'section' }, [
    el('h2', { class: 'section__title' }, section.title),
    el('p', { class: 'section__hours' }, `${section.hours} ч`),
    items.length
      ? el('ul', { class: 'section__lessons' }, items)
      : el('p', { class: 'empty' }, 'Уроки этого раздела ещё готовятся.'),
  ]);
}
