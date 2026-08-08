import * as rest from '../api/firebase-rest.js';
import { SCHOOL_ID } from '../firebase-config.js';
import { hashPin, makeSalt, PIN_LENGTH } from '../auth/pin.js';

const ROOT = `schools/${SCHOOL_ID}`;

const ТРАНСЛИТ = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Фамилия становится частью адреса в базе, а туда пускают только латиницу.
 * Поэтому «Иванов Иван» превращается в «ivanov-ivan».
 */
export function транслитерировать(имя) {
  return String(имя ?? '')
    .toLowerCase()
    .split('')
    .map((c) => (c in ТРАНСЛИТ ? ТРАНСЛИТ[c] : c))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Разбирает список фамилий, вставленный из журнала или документа.
 * Нумерацию вида «1.», «1)», «1 —» убираем: её вставляют вместе с текстом,
 * и она попала бы в имя ученика.
 */
export function разобратьСписок(текст) {
  return String(текст ?? '')
    .split(/\r?\n/)
    .map((строка) => строка.replace(/^\s*\d+\s*[.)\-–—]?\s*/, '').trim())
    .filter(Boolean)
    .filter((имя, i, все) => все.indexOf(имя) === i);
}

/** Делает идентификаторы уникальными: два Иванова в классе — обычное дело. */
export function построитьИдентификаторы(имена, занятые = new Set()) {
  const взятые = new Set(занятые);
  return имена.map((имя) => {
    const основа = транслитерировать(имя) || 'uchenik';
    let id = основа;
    let n = 2;
    while (взятые.has(id)) id = `${основа}-${n++}`;
    взятые.add(id);
    return { имя, id };
  });
}

/** Четырёхзначный код, который ученик будет вводить. */
export function придуматьPin(random = Math.random) {
  const максимум = 10 ** PIN_LENGTH;
  return String(Math.floor(random() * максимум)).padStart(PIN_LENGTH, '0');
}

export function createClassAdmin({ api = rest, getToken, hash = hashPin, salt = makeSalt, pin = придуматьPin } = {}) {
  async function токен() {
    const t = await getToken();
    if (!t) throw new Error('Сессия закончилась, нужно войти заново.');
    return t;
  }

  async function создатьКласс({ title, grade }) {
    const token = await токен();
    const id = транслитерировать(title) || `class-${Date.now()}`;
    await api.dbPut(`${ROOT}/classes/${id}`, { title, grade: Number(grade) }, { token });
    return { id, title, grade: Number(grade) };
  }

  /**
   * Добавляет учеников и возвращает их коды.
   *
   * Коды показываются **один раз**: в базу уходит только хеш, и восстановить
   * PIN потом не сможет никто, включая учителя. Забытый код не вспоминают,
   * а выдают новый.
   */
  async function добавитьУчеников(classId, имена, занятыеId = new Set()) {
    const token = await токен();
    const выданные = [];

    for (const { имя, id } of построитьИдентификаторы(имена, занятыеId)) {
      const соль = salt();
      const код = pin();
      await api.dbPut(`${ROOT}/students/${id}`, { name: имя, classId, salt: соль }, { token });
      await api.dbPut(`${ROOT}/secrets/${id}`, { pinHash: await hash(код, соль) }, { token });
      выданные.push({ id, имя, код });
    }

    return выданные;
  }

  /** Забытый код не восстанавливают — выдают новый и стирают старую привязку. */
  async function сброситьPin(studentId) {
    const token = await токен();
    const соль = salt();
    const код = pin();
    const ученик = await api.dbGet(`${ROOT}/students/${studentId}`, { token });
    if (!ученик) throw new Error('Такого ученика нет.');

    await api.dbPut(`${ROOT}/students/${studentId}`, { ...ученик, salt: соль }, { token });
    await api.dbPut(`${ROOT}/secrets/${studentId}`, { pinHash: await hash(код, соль) }, { token });
    // Старое устройство больше не должно считаться этим учеником.
    await api.dbPut(`${ROOT}/bindings/${studentId}`, null, { token });
    return { id: studentId, имя: ученик.name, код };
  }

  async function задатьУрок({ classId, lessonId, dueAt }) {
    const token = await токен();
    const запись = { isOpen: true, assignedAt: Date.now(), ...(dueAt ? { dueAt } : {}) };
    await api.dbPut(`${ROOT}/assignments/${classId}/${lessonId}`, запись, { token });
    return запись;
  }

  /** Закрыть — не значит стереть: сданные работы остаются в журнале. */
  async function закрытьУрок({ classId, lessonId }) {
    const token = await токен();
    await api.dbPatch(`${ROOT}/assignments/${classId}/${lessonId}`, { isOpen: false }, { token });
  }

  return { создатьКласс, добавитьУчеников, сброситьPin, задатьУрок, закрытьУрок };
}
