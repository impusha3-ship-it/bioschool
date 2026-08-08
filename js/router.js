export const LESSON_TABS = ['summary', 'practice', 'homework', 'materials'];

/**
 * Разбирает хеш адресной строки в описание маршрута.
 * Чистая функция: не читает location и не трогает DOM.
 */
export function parseRoute(hash) {
  const path = String(hash ?? '')
    .replace(/^#/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (path === '') return { name: 'home', params: {} };

  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'class' && parts[1]) {
    return { name: 'class', params: { grade: parts[1] } };
  }

  if (parts[0] === 'lesson' && parts[1]) {
    const tab = LESSON_TABS.includes(parts[2]) ? parts[2] : 'summary';
    return { name: 'lesson', params: { lessonId: parts[1], tab } };
  }

  if (parts[0] === 'login' && parts.length === 1) {
    return { name: 'login', params: {} };
  }

  if (parts[0] === 'teacher-login' && parts.length === 1) {
    return { name: 'teacherLogin', params: {} };
  }

  if (parts[0] === 'teacher') {
    const виды = ['check', 'classes', 'assign'];
    const view = виды.includes(parts[1]) ? parts[1] : 'journal';
    return { name: 'teacher', params: { view } };
  }

  if (parts[0] === 'sources' && parts.length === 1) {
    return { name: 'sources', params: {} };
  }

  return { name: 'notfound', params: { path } };
}

/**
 * Подписывает обработчик на смену маршрута и сразу вызывает его для текущего адреса.
 * Возвращает функцию отписки.
 */
export function startRouter(onRoute, target = globalThis) {
  const handle = () => onRoute(parseRoute(target.location.hash));
  target.addEventListener('hashchange', handle);
  handle();
  return () => target.removeEventListener('hashchange', handle);
}
