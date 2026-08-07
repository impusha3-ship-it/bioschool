/**
 * Обращение к Firebase через обычный REST, без официального SDK.
 *
 * Почему так: SDK весит около 250 КБ и грузится с gstatic, который из России
 * бывает медленным, а нам нужны всего четыре операции — вход, обновление
 * токена, чтение и запись. Заодно у проекта не появляется ни одной зависимости,
 * и всё это покрывается тестами с подставным fetch.
 */
import { firebaseConfig } from '../firebase-config.js';

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts';
const SECURE_TOKEN = 'https://securetoken.googleapis.com/v1/token';

/** Путь в базе: только буквы, цифры, дефис, подчёркивание и косая черта. */
const SAFE_PATH = /^[A-Za-z0-9_\-/]+$/;

/**
 * Сообщения Firebase приходят кодами вроде INVALID_PASSWORD.
 * Показывать их ученику нельзя, поэтому переводим то, что реально встречается.
 */
const MESSAGES = {
  EMAIL_NOT_FOUND: 'Такой почты нет среди учителей.',
  INVALID_PASSWORD: 'Неверный пароль.',
  INVALID_LOGIN_CREDENTIALS: 'Неверная почта или пароль.',
  USER_DISABLED: 'Этот аккаунт отключён.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Слишком много попыток. Подожди немного и попробуй снова.',
  ADMIN_ONLY_OPERATION: 'Этот способ входа отключён в настройках проекта.',
  OPERATION_NOT_ALLOWED: 'Этот способ входа отключён в настройках проекта.',
  TOKEN_EXPIRED: 'Сессия истекла, нужно войти заново.',
  INVALID_REFRESH_TOKEN: 'Сессия больше не действует, нужно войти заново.',
};

function translate(code) {
  if (!code) return 'Не удалось связаться с сервером.';
  const key = String(code).split(' : ')[0].trim();
  return MESSAGES[key] ?? `Ошибка входа: ${key}`;
}

async function postJson(url, body, fetchFn) {
  let response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Нет связи с сервером. Проверь интернет.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(translate(data?.error?.message));
  return data;
}

/** Анонимный вход: ученику не нужен аккаунт, сессия только опознаёт устройство. */
export async function signInAnonymously({ fetchFn = fetch, config = firebaseConfig } = {}) {
  const data = await postJson(
    `${IDENTITY}:signUp?key=${config.apiKey}`,
    { returnSecureToken: true },
    fetchFn,
  );
  return normalizeAuth(data);
}

/** Вход учителя по почте и паролю. */
export async function signInWithPassword(email, password, { fetchFn = fetch, config = firebaseConfig } = {}) {
  const data = await postJson(
    `${IDENTITY}:signInWithPassword?key=${config.apiKey}`,
    { email, password, returnSecureToken: true },
    fetchFn,
  );
  return normalizeAuth(data);
}

/** Продление сессии: idToken живёт час, refreshToken — долго. */
export async function refreshSession(refreshToken, { fetchFn = fetch, config = firebaseConfig } = {}) {
  const data = await postJson(
    `${SECURE_TOKEN}?key=${config.apiKey}`,
    { grant_type: 'refresh_token', refresh_token: refreshToken },
    fetchFn,
  );
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    uid: data.user_id,
    expiresInSec: Number(data.expires_in ?? 3600),
  };
}

function normalizeAuth(data) {
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: data.localId,
    email: data.email ?? null,
    expiresInSec: Number(data.expiresIn ?? 3600),
  };
}

function dbUrl(path, token, config) {
  if (!SAFE_PATH.test(String(path ?? ''))) {
    throw new Error(`Недопустимый путь в базе: ${path}`);
  }
  const auth = token ? `?auth=${encodeURIComponent(token)}` : '';
  return `${config.databaseURL}/${path}.json${auth}`;
}

async function dbRequest(method, path, value, { token = null, fetchFn = fetch, config = firebaseConfig }) {
  const url = dbUrl(path, token, config);
  let response;
  try {
    response = await fetchFn(url, {
      method,
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    });
  } catch {
    throw new Error('Нет связи с сервером. Проверь интернет.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Доступ запрещён.');
    }
    throw new Error(data?.error ? String(data.error) : 'Сервер не принял запрос.');
  }
  return data;
}

export const dbGet = (path, options = {}) => dbRequest('GET', path, undefined, options);
export const dbPut = (path, value, options = {}) => dbRequest('PUT', path, value, options);
export const dbPatch = (path, value, options = {}) => dbRequest('PATCH', path, value, options);
