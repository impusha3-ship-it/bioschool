import { refreshSession } from '../api/firebase-rest.js';

/**
 * Хранит сессию между заходами и продлевает её, пока она жива.
 *
 * idToken живёт час, refreshToken — долго. Ученик не должен вводить PIN
 * каждый урок, поэтому сессия лежит в браузере и продлевается молча.
 *
 * Хранилище и часы передаются снаружи, чтобы всё это проверялось без браузера.
 */
const KEY = 'bioschool.session';

/** Обновляем чуть заранее: иначе токен протухнет прямо в полёте запроса. */
const SKEW_MS = 60_000;

export function createSessionStore({
  storage = globalThis.localStorage,
  now = () => Date.now(),
  refresh = refreshSession,
} = {}) {
  function save(session) {
    storage.setItem(KEY, JSON.stringify(session));
    return session;
  }

  function load() {
    try {
      const raw = storage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      // Испорченная запись — не повод падать, просто просим войти заново.
      return null;
    }
  }

  function clear() {
    storage.removeItem(KEY);
  }

  /** Собирает сессию из ответа входа, переводя срок жизни в момент истечения. */
  function fromAuth(auth, extra = {}) {
    return {
      idToken: auth.idToken,
      refreshToken: auth.refreshToken,
      uid: auth.uid,
      expiresAt: now() + auth.expiresInSec * 1000,
      ...extra,
    };
  }

  function isExpired(session) {
    if (!session?.expiresAt) return true;
    return now() + SKEW_MS >= session.expiresAt;
  }

  /**
   * Отдаёт годный токен: живой возвращает как есть, протухший продлевает.
   * Если продлить не вышло — сессии больше нет, надо входить заново.
   */
  async function getValidToken(options = {}) {
    const session = load();
    if (!session) return null;
    if (!isExpired(session)) return session.idToken;

    try {
      const обновлённая = await refresh(session.refreshToken, options);
      save({ ...session, ...fromAuth(обновлённая) });
      return обновлённая.idToken;
    } catch {
      clear();
      return null;
    }
  }

  return { save, load, clear, fromAuth, isExpired, getValidToken };
}
