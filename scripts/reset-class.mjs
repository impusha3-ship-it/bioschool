/**
 * Обнуляет баллы класса: прогресс каждого ученика и его строку в таблице.
 *
 * Заведён 3 сентября 2026, когда выяснилось, что на общем школьном
 * компьютере каждый следующий вошедший забирал себе работу предыдущего.
 * Сама ошибка исправлена, но испорченные суммы сами не разойдутся.
 *
 * Что НЕ трогается: сданные домашние работы и выставленные за них оценки.
 * Это журнал, а не игровые баллы, и терять его нельзя. Из-за этого ребёнок,
 * уже сдавший домашку, не сможет набрать за неё баллы заново — сдать можно
 * один раз. Разница невелика, а журнал важнее.
 *
 * Запускать проще всего двойным щелчком по «Обнулить баллы класса.cmd».
 * Из командной строки:
 *   node scripts/reset-class.mjs почта пароль «Название класса»
 *
 * Название спрашивается и сверяется с базой нарочно: действие необратимое,
 * и промахнуться классом здесь стоило бы дороже, чем набрать лишнее слово.
 */
import { firebaseConfig, SCHOOL_ID } from '../js/firebase-config.js';
import { signInWithPassword, dbGet, dbPut } from '../js/api/firebase-rest.js';
import { планСброса } from '../js/teacher/sbros.js';

const ROOT = `schools/${SCHOOL_ID}`;
const [email, password, подтверждение] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

if (!email || !password || !подтверждение) {
  console.error('Нужны почта, пароль учителя и название класса.');
  console.error('Проще всего: двойной щелчок по «Обнулить баллы класса.cmd» в папке проекта.');
  process.exit(1);
}

try {
  await главное();
} catch (error) {
  console.error('');
  console.error('Не получилось: ' + error.message);
  if (/Неверн|почты нет/.test(error.message)) {
    console.error('Проверь почту и пароль — те же, что в Firebase → Authentication → Users.');
  }
  process.exitCode = 1;
}

async function главное() {
  const auth = await signInWithPassword(email, password, { config: firebaseConfig });
  const token = auth.idToken;
  console.log('вошёл как учитель');

  const классы = (await dbGet(`${ROOT}/classes`, { token })) ?? {};
  // Название или идентификатор: кириллица в консоли Windows иногда приходит
  // покорёженной, и тогда остаётся латинский идентификатор класса.
  const искомое = подтверждение.trim().toLowerCase();
  const найден = Object.entries(классы).find(
    ([id, к]) => (к.title ?? '').trim().toLowerCase() === искомое || id.toLowerCase() === искомое,
  );

  if (!найден) {
    const список = Object.entries(классы).map(([id, к]) => `«${к.title}» (${id})`).join(', ') || 'ни одного';
    throw new Error(`класса «${подтверждение}» нет. Есть: ${список}`);
  }

  const [classId, класс] = найден;
  const все = (await dbGet(`${ROOT}/students`, { token })) ?? {};
  const свои = Object.entries(все).filter(([, у]) => у?.classId === classId);

  if (!свои.length) {
    console.log(`В классе «${класс.title}» нет учеников — обнулять нечего.`);
    return;
  }

  const таблица = (await dbGet(`${ROOT}/leaderboard/${classId}`, { token })) ?? {};
  console.log('');
  console.log(`Класс «${класс.title}», учеников: ${свои.length}. Обнуляю баллы:`);
  for (const [id, у] of свои) {
    const было = таблица[id]?.xp ?? 0;
    console.log(`  ${у.name} — было ${было}`);
  }

  /*
    Что именно писать, решает `планСброса` — там же и тест, который следит,
    чтобы обнуление не залезло в коды входа, карточки и сданные работы.
    Пометка времени в записи нужна затем, что у каждого ребёнка в браузере
    лежит своя копия: без пометки перенос залил бы её обратно при первом же
    заходе, и обнуление не продержалось бы и дня.
  */
  const записи = планСброса({
    root: ROOT,
    classId,
    studentIds: свои.map(([id]) => id),
    сброс: Date.now(),
  });

  for (const { path, value } of записи) {
    await dbPut(path, value, { token });
  }

  console.log('');
  console.log(`Готово: обнулено учеников — ${свои.length}.`);
  console.log('Коды входа не тронуты — дети заходят по тем же четырём цифрам.');
  console.log('Сданные домашние работы и оценки за них тоже на месте.');
}
