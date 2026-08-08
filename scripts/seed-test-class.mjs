/**
 * Заводит тестовый класс с выдуманными учениками — чтобы проверить вход
 * насквозь, не трогая настоящих детей.
 *
 * Запускать после того, как учитель закрепился в проекте:
 *   node scripts/seed-test-class.mjs почта пароль
 *
 * Класс называется «Тест», и его видно на экране входа. Удалить его можно
 * тем же скриптом с ключом --remove.
 */
import { firebaseConfig, SCHOOL_ID } from '../js/firebase-config.js';
import { signInWithPassword, dbPut } from '../js/api/firebase-rest.js';
import { hashPin, makeSalt } from '../js/auth/pin.js';

const [email, password, ...flags] = process.argv.slice(2);
const remove = flags.includes('--remove');

if (!email || !password) {
  console.error('Нужны почта и пароль учителя: node scripts/seed-test-class.mjs почта пароль');
  process.exit(1);
}

const ROOT = `schools/${SCHOOL_ID}`;
const CLASS_ID = 'test';

const УЧЕНИКИ = [
  { id: 'test-ivanov', name: 'Иванов Иван', pin: '1111' },
  { id: 'test-petrova', name: 'Петрова Мария', pin: '2222' },
  { id: 'test-sidorov', name: 'Сидоров Пётр', pin: '3333' },
];

const auth = await signInWithPassword(email, password, { config: firebaseConfig });
const token = auth.idToken;
console.log('вошёл как учитель, uid:', auth.uid);

if (remove) {
  await dbPut(`${ROOT}/classes/${CLASS_ID}`, null, { token });
  for (const у of УЧЕНИКИ) {
    await dbPut(`${ROOT}/students/${у.id}`, null, { token });
    await dbPut(`${ROOT}/secrets/${у.id}`, null, { token });
    await dbPut(`${ROOT}/bindings/${у.id}`, null, { token });
  }
  console.log('тестовый класс удалён');
  process.exit(0);
}

await dbPut(`${ROOT}/classes/${CLASS_ID}`, { grade: 5, title: 'Тест' }, { token });

for (const у of УЧЕНИКИ) {
  const salt = makeSalt();
  const pinHash = await hashPin(у.pin, salt);
  await dbPut(`${ROOT}/students/${у.id}`, { name: у.name, classId: CLASS_ID, salt }, { token });
  await dbPut(`${ROOT}/secrets/${у.id}`, { pinHash }, { token });
  console.log(`  ${у.name} — код ${у.pin}`);
}

// Урок, назначенный тестовому классу: без него нельзя проверить запись работы.
await dbPut(
  `${ROOT}/assignments/${CLASS_ID}/5-priznaki-zhivogo`,
  { isOpen: true, assignedAt: Date.now(), dueAt: Date.now() + 7 * 24 * 3600 * 1000 },
  { token },
);

console.log('готово: класс «Тест», три ученика, один назначенный урок');
