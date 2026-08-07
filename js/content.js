/**
 * Накладывает правки учителя поверх материала из репозитория.
 * Объекты сливаются вглубь, массивы и примитивы заменяются целиком,
 * значение null удаляет поле. Исходные данные не изменяются.
 */
export function applyOverrides(base, overrides) {
  if (!isPlainObject(overrides)) return base;

  const out = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete out[key];
    } else if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = applyOverrides(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const GRADES = ['5', '6', '7', '8', '9'];
const LESSON_ID = /^[\p{L}\p{N}-]+$/u;

const cache = new Map();

/** Сбрасывает кеш. Нужен тестам и перезагрузке контента после правки. */
export function clearContentCache() {
  cache.clear();
}

async function loadJson(url, fetchFn, notFoundMessage) {
  if (cache.has(url)) return cache.get(url);

  const promise = (async () => {
    const response = await fetchFn(url);
    if (!response.ok) throw new Error(notFoundMessage);
    return response.json();
  })();

  cache.set(url, promise);
  try {
    return await promise;
  } catch (error) {
    cache.delete(url); // не запоминаем неудачу — при следующей попытке пробуем снова
    throw error;
  }
}

/**
 * Загружает урок по стабильному идентификатору (например, "5-priznaki-zhivogo").
 * Порядкового номера в идентификаторе нет намеренно: порядок уроков подвижен.
 */
export async function loadLesson(lessonId, { fetchFn = fetch, overrides = null } = {}) {
  if (!LESSON_ID.test(String(lessonId ?? ''))) {
    throw new Error(`Недопустимый идентификатор урока: ${lessonId}`);
  }
  const data = await loadJson(
    `./content/lessons/${lessonId}.json`,
    fetchFn,
    `Урок не найден: ${lessonId}`,
  );
  return applyOverrides(data, overrides);
}

/** Загружает разделы и порядок уроков класса. */
export async function loadCourse(grade, { fetchFn = fetch } = {}) {
  if (!GRADES.includes(String(grade))) {
    throw new Error(`Недопустимый класс: ${grade}`);
  }
  return loadJson(`./content/courses/${grade}.json`, fetchFn, `Курс не найден: ${grade}`);
}
