import * as rest from '../api/firebase-rest.js';
import { hashPin } from './pin.js';
import { createSessionStore } from './session.js';
import { SCHOOL_ID } from '../firebase-config.js';

const ROOT = `schools/${SCHOOL_ID}`;

/**
 * Вход учеников и учителя.
 *
 * Всё внешнее передаётся снаружи, чтобы проверять поток без сети и браузера:
 * запросы к базе, хеширование и хранилище сессии.
 */
export function createLogin({
  api = rest,
  hash = hashPin,
  store = null,
  storeOptions = {},
} = {}) {
  const session = store ?? createSessionStore(storeOptions);

  /** Список классов для первого экрана. Читается без входа. */
  async function loadClasses() {
    const raw = (await api.dbGet(`${ROOT}/classes`)) ?? {};
    return Object.entries(raw)
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));
  }

  /** Ученики выбранного класса, по алфавиту. */
  async function loadStudents(classId) {
    const raw = (await api.dbGet(`${ROOT}/students`)) ?? {};
    return Object.entries(raw)
      .filter(([, s]) => s.classId === classId)
      .map(([id, s]) => ({ id, name: s.name, salt: s.salt }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  /**
   * Вход ученика.
   *
   * PIN никуда не отправляется. Браузер считает из него доказательство и
   * пытается записать привязку; сравнивают уже правила базы, у которых есть
   * доступ к хешу, а у нас нет. Отказ записи и означает неверный PIN.
   */
  async function loginStudent({ studentId, name, classId, salt }, pin) {
    const auth = await api.signInAnonymously();
    const proof = await hash(pin, salt);

    try {
      await api.dbPut(
        `${ROOT}/bindings/${studentId}`,
        { uid: auth.uid, proof },
        { token: auth.idToken },
      );
    } catch (error) {
      // Правило отказало — значит, доказательство не совпало.
      if (/Доступ запрещён/.test(error.message)) {
        throw new Error('Неверный код. Попробуй ещё раз.');
      }
      throw error;
    }

    return session.save(session.fromAuth(auth, { kind: 'student', studentId, name, classId }));
  }

  /**
   * Вход учителя.
   *
   * Первый вошедший по паролю записывает себя в ветку `teachers`, после чего
   * правило запрещает это кому-либо ещё. Если запись уже есть и она наша —
   * просто входим; если есть и чужая — доступа нет.
   */
  async function loginTeacher(email, password) {
    const auth = await api.signInWithPassword(email, password);
    const path = `${ROOT}/teachers/${auth.uid}`;

    let уже = null;
    try {
      уже = await api.dbGet(path, { token: auth.idToken });
    } catch {
      // Читать чужую запись правила не дают — значит, место занято не нами.
      уже = null;
    }

    if (уже !== true) {
      try {
        await api.dbPut(path, true, { token: auth.idToken });
      } catch {
        throw new Error(
          'Учитель в этом проекте уже назначен, и это другой аккаунт. ' +
            'Войди тем, которым закреплялся в первый раз.',
        );
      }
    }

    return session.save(session.fromAuth(auth, { kind: 'teacher', email: auth.email }));
  }

  return {
    loadClasses,
    loadStudents,
    loginStudent,
    loginTeacher,
    current: () => session.load(),
    token: (options) => session.getValidToken(options),
    logout: () => session.clear(),
  };
}
