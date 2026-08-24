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
