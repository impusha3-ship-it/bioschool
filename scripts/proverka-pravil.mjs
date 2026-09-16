/**
 * Проверка правил базы без входа и без записи.
 *
 * До 16 сентября 2026 правила сравнивали привязку ученика с `auth.uid`, не
 * требуя самого входа. У ученика, который ни разу не входил, привязки нет, и
 * пустое сравнивалось с пустым как равное: его работы читались без входа, а
 * в его прогресс, строку почёта и даже домашку мог писать кто угодно.
 *
 * Скрипт только читает — работы учеников, ещё не входивших на сайт. После
 * публикации исправленных правил каждое такое чтение должно получать отказ.
 *
 *   node scripts/proverka-pravil.mjs
 */
import { firebaseConfig, SCHOOL_ID } from '../js/firebase-config.js';

const U = `${firebaseConfig.databaseURL}/schools/${SCHOOL_ID}`;
const читать = (путь) => fetch(`${U}/${путь}.json`);

const ученики = (await (await читать('students')).json()) ?? {};
const таблицы = {};
for (const classId of new Set(Object.values(ученики).map((у) => у.classId))) {
  таблицы[classId] = (await (await читать(`leaderboard/${classId}`)).json()) ?? {};
}

const новички = Object.entries(ученики).filter(([id, у]) => !таблицы[у.classId]?.[id]);
let открыто = 0;
for (const [id] of новички) {
  const ответ = await читать(`submissions/${id}`);
  if (ответ.ok) открыто += 1;
}

console.log('');
console.log(`Учеников, ещё не входивших на сайт: ${новички.length}`);
if (открыто) {
  console.log(`ПРОВАЛ: у ${открыто} из них работы читаются без входа — правила ещё старые.`);
  process.exitCode = 1;
} else {
  console.log('ok: без входа к их работам доступа нет.');
}
