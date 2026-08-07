/**
 * Превращение PIN в доказательство, которое проверяют правила базы.
 *
 * Хеш считается медленным алгоритмом намеренно. PIN короткий, и от подбора
 * его защищает не длина, а цена одной попытки: чтобы перебрать 10 000
 * вариантов, придётся 10 000 раз выполнить эту работу. При 200 000 итераций
 * один расчёт занимает доли секунды у честного ученика и превращает полный
 * перебор в часы работы процессора у того, кто полезет подбирать.
 *
 * Соль не секрет: её задача только в том, чтобы одинаковые PIN у разных
 * детей давали разные хеши и подобранный один не открывал сразу всех.
 */
const ITERATIONS = 200000;

export const PIN_LENGTH = 4;

/** PIN — ровно четыре цифры. Буквы и пробелы не принимаются. */
export function isValidPin(pin) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(String(pin ?? ''));
}

/** Случайная соль в виде шестнадцатеричной строки. */
export function makeSalt(bytes = 16, getRandomValues = (a) => globalThis.crypto.getRandomValues(a)) {
  return toHex(getRandomValues(new Uint8Array(bytes)));
}

/**
 * Считает доказательство: hash(PIN + соль).
 * Результат уходит в базу как `proof`, а правило сравнивает его с хешем,
 * который клиенту читать запрещено.
 */
export async function hashPin(pin, salt, { subtle = globalThis.crypto.subtle, iterations = ITERATIONS } = {}) {
  if (!isValidPin(pin)) throw new Error(`PIN должен состоять из ${PIN_LENGTH} цифр`);
  if (!salt) throw new Error('Не задана соль');

  const encoder = new TextEncoder();
  const key = await subtle.importKey('raw', encoder.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(String(salt)), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
