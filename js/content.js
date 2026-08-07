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
