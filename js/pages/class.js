import { el } from '../ui/dom.js';
import { loadCourse } from '../content.js';

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
    ...course.sections.map(renderSection),
  ]);
}

function renderSection(section) {
  // Заголовки берём из файла курса, а не скачиваем каждый урок ради названия.
  const items = section.lessons.map((entry) =>
    el('li', {}, [
      el('a', { class: 'lesson-link', href: `#/lesson/${entry.id}` }, entry.title),
    ]),
  );

  return el('div', { class: 'section' }, [
    el('h2', { class: 'section__title' }, section.title),
    el('p', { class: 'section__hours' }, `${section.hours} ч`),
    items.length
      ? el('ul', { class: 'section__lessons' }, items)
      : el('p', { class: 'empty' }, 'Уроки этого раздела ещё готовятся.'),
  ]);
}
