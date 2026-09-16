/**
 * Повторный вход без потерь: куда вернуть ученика и что он успел ответить.
 *
 * Нужно, когда вход на устройстве устарел (под тем же именем вошли на
 * другом). Ученик жмёт «Войти заново» посреди домашки — после входа он
 * должен оказаться на той же странице и с теми же ответами, иначе второй
 * раз он работу писать не станет.
 *
 * Лежит в sessionStorage: это одна вкладка и одна попытка, и хранить
 * черновик дольше незачем. Недоступное хранилище (приватное окно) — не
 * ошибка: вход всё равно сработает, просто без возврата.
 */
const ВОЗВРАТ = 'bio-vozvrat';
const ЧЕРНОВИК = 'bio-chernovik:';

function хранилище(storage) {
  try {
    return storage ?? globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function запомнитьВозврат(адрес, { storage } = {}) {
  try { хранилище(storage)?.setItem(ВОЗВРАТ, адрес); } catch { /* без возврата */ }
}

/** Адрес возврата, один раз: после чтения он стирается. Чужие адреса не берутся. */
export function взятьВозврат({ storage } = {}) {
  try {
    const с = хранилище(storage);
    const адрес = с?.getItem(ВОЗВРАТ) ?? null;
    с?.removeItem(ВОЗВРАТ);
    return адрес && адрес.startsWith('#/') ? адрес : null;
  } catch {
    return null;
  }
}

export function сохранитьЧерновик(lessonId, ответы, { storage } = {}) {
  try { хранилище(storage)?.setItem(ЧЕРНОВИК + lessonId, JSON.stringify(ответы ?? {})); } catch { /* без черновика */ }
}

export function прочитатьЧерновик(lessonId, { storage } = {}) {
  try {
    const сырой = хранилище(storage)?.getItem(ЧЕРНОВИК + lessonId);
    const ответы = сырой ? JSON.parse(сырой) : null;
    return ответы && typeof ответы === 'object' ? ответы : null;
  } catch {
    return null;
  }
}

export function стеретьЧерновик(lessonId, { storage } = {}) {
  try { хранилище(storage)?.removeItem(ЧЕРНОВИК + lessonId); } catch { /* нечего стирать */ }
}
