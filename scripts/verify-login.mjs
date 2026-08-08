/**
 * Проверка входа и правил безопасности на живой базе.
 *
 * Работает поверх тестового класса (scripts/seed-test-class.mjs) и не требует
 * учительского пароля: заходит так же, как заходит ученик. Ничего, кроме
 * тестовых записей, не трогает.
 *
 *   node scripts/verify-login.mjs
 */
import { firebaseConfig, SCHOOL_ID } from '../js/firebase-config.js';
import { signInAnonymously, dbGet, dbPut } from '../js/api/firebase-rest.js';
import { hashPin } from '../js/auth/pin.js';

const ROOT = `schools/${SCHOOL_ID}`;
const cfg = { config: firebaseConfig };

let провалов = 0;

function итог(название, ожидание, получилось, подробность = '') {
  const ок = ожидание === получилось;
  if (!ок) провалов += 1;
  const метка = ок ? '  ok  ' : ' ПРОВАЛ';
  console.log(`${метка} │ ${название}${подробность ? ' — ' + подробность : ''}`);
}

/** Выполняет действие и говорит, разрешили его или отказали. */
async function попытка(действие) {
  try {
    await действие();
    return 'разрешено';
  } catch (error) {
    return /Доступ запрещён/.test(error.message) ? 'отказано' : `ошибка: ${error.message}`;
  }
}

console.log('');
console.log('Проверка входа на живой базе');
console.log('─'.repeat(64));

const классы = (await dbGet(`${ROOT}/classes`, cfg)) ?? {};
итог('тестовый класс заведён', true, Boolean(классы.test), классы.test?.title ?? 'не найден');

if (!классы.test) {
  console.log('');
  console.log('Сначала заведи тестовый класс: «Завести тестовый класс.cmd»');
  process.exit(1);
}

const ученики = (await dbGet(`${ROOT}/students`, cfg)) ?? {};
const ivanov = ученики['test-ivanov'];
const petrova = ученики['test-petrova'];
итог('ученики видны без входа', true, Boolean(ivanov && petrova), `${ivanov?.name}, ${petrova?.name}`);
итог('соль у учеников разная', true, ivanov?.salt !== petrova?.salt);

// ── Вход Иванова с верным кодом ──────────────────────────────
const сессия = await signInAnonymously(cfg);
const верное = await hashPin('1111', ivanov.salt);

итог(
  'ГЛАВНОЕ: верный код пускает',
  'разрешено',
  await попытка(() =>
    dbPut(`${ROOT}/bindings/test-ivanov`, { uid: сессия.uid, proof: верное }, { token: сессия.idToken, ...cfg }),
  ),
);

// ── Тот же ученик с неверным кодом ───────────────────────────
const неверное = await hashPin('9999', ivanov.salt);
итог(
  'неверный код не пускает',
  'отказано',
  await попытка(() =>
    dbPut(`${ROOT}/bindings/test-ivanov`, { uid: сессия.uid, proof: неверное }, { token: сессия.idToken, ...cfg }),
  ),
);

// ── Чужой код к чужой записи ─────────────────────────────────
итог(
  'код Иванова не открывает Петрову',
  'отказано',
  await попытка(() =>
    dbPut(`${ROOT}/bindings/test-petrova`, { uid: сессия.uid, proof: верное }, { token: сессия.idToken, ...cfg }),
  ),
);

// ── Сдача работы по назначенному уроку ───────────────────────
итог(
  'работа по назначенному уроку записывается',
  'разрешено',
  await попытка(() =>
    dbPut(
      `${ROOT}/submissions/test-ivanov/5-priznaki-zhivogo`,
      { attempt: 1, submittedAt: Date.now(), autoScore: 7 },
      { token: сессия.idToken, ...cfg },
    ),
  ),
);

итог(
  'работа по НЕназначенному уроку отклоняется',
  'отказано',
  await попытка(() =>
    dbPut(
      `${ROOT}/submissions/test-ivanov/5-sistema-nauk`,
      { attempt: 1, submittedAt: Date.now() },
      { token: сессия.idToken, ...cfg },
    ),
  ),
);

итог(
  'ученик не может поставить себе балл за развёрнутый ответ',
  'отказано',
  await попытка(() =>
    dbPut(
      `${ROOT}/submissions/test-ivanov/5-priznaki-zhivogo`,
      { attempt: 1, submittedAt: Date.now(), manualScore: 2 },
      { token: сессия.idToken, ...cfg },
    ),
  ),
);

// ── Чтение ───────────────────────────────────────────────────
итог(
  'свои работы читаются',
  'разрешено',
  await попытка(() => dbGet(`${ROOT}/submissions/test-ivanov`, { token: сессия.idToken, ...cfg })),
);

итог(
  'ГЛАВНОЕ: чужие работы не читаются',
  'отказано',
  await попытка(() => dbGet(`${ROOT}/submissions/test-petrova`, { token: сессия.idToken, ...cfg })),
);

итог(
  'хеши кодов не читаются даже после входа',
  'отказано',
  await попытка(() => dbGet(`${ROOT}/secrets`, { token: сессия.idToken, ...cfg })),
);

console.log('─'.repeat(64));
console.log(провалов === 0 ? 'Все проверки прошли.' : `ПРОВАЛОВ: ${провалов}`);
process.exitCode = провалов === 0 ? 0 : 1;
