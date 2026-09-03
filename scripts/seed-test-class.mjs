/**
 * Заводит тестовый класс с выдуманными учениками — чтобы проверить вход
 * насквозь, не трогая настоящих детей.
 *
 * Запускать после того, как учитель закрепился в проекте. Проще всего —
 * двойным щелчком по «Завести тестовый класс.cmd» в корне проекта.
 * Из командной строки:
 *   node scripts/seed-test-class.mjs            (спросит почту и пароль)
 *   node scripts/seed-test-class.mjs --remove   (удалит тестовый класс)
 *
 * Пароль никуда не сохраняется: он уходит только в Firebase и живёт в памяти
 * до конца работы скрипта.
 */
import { firebaseConfig, SCHOOL_ID } from '../js/firebase-config.js';
import { signInWithPassword, dbGet, dbPut } from '../js/api/firebase-rest.js';
import { hashPin, makeSalt } from '../js/auth/pin.js';

const args = process.argv.slice(2);
const remove = args.includes('--remove');
const позиционные = args.filter((a) => !a.startsWith('--'));

/*
  Почта и пароль приходят аргументами. Спрашивает их обёртка на PowerShell:
  у неё для скрытого ввода есть штатный Read-Host -AsSecureString, а здесь
  тогда не остаётся ни строчки непроверяемого кода — всё, что делает работу,
  запускается и проверяется без клавиатуры.
*/
const [email, password] = позиционные;

if (!email || !password) {
  console.error('Нужны почта и пароль учителя.');
  console.error('Проще всего: двойной щелчок по «Завести тестовый класс.cmd» в папке проекта.');
  console.error('Из командной строки: node scripts/seed-test-class.mjs почта пароль');
  // Здесь выйти резко можно: до сети дело ещё не дошло.
  process.exit(1);
}

const ROOT = `schools/${SCHOOL_ID}`;
const CLASS_ID = 'test';

const УЧЕНИКИ = [
  { id: 'test-ivanov', name: 'Иванов Иван', pin: '1111' },
  { id: 'test-petrova', name: 'Петрова Мария', pin: '2222' },
  { id: 'test-sidorov', name: 'Сидоров Пётр', pin: '3333' },
];

// Ошибку показываем строкой, а не стеком: скрипт запускают двойным щелчком,
// и внутренности Node тут никому ничего не объяснят.
try {
  await главное();
} catch (error) {
  console.error('');
  console.error('Не получилось: ' + error.message);
  if (/Неверн|почты нет/.test(error.message)) {
    console.error('Проверь почту и пароль — те же, что в Firebase → Authentication → Users.');
  }
  if (/Доступ запрещён/.test(error.message)) {
    console.error('Похоже, этот аккаунт не закреплён учителем. Войди на сайте через «Я учитель».');
  }
  // Не process.exit: он рвёт открытое сетевое соединение, и Node под Windows
  // вываливает внутреннюю ругань поверх нашего понятного сообщения.
  process.exitCode = 1;
}

async function главное() {
  const auth = await signInWithPassword(email, password, { config: firebaseConfig });
  const token = auth.idToken;
  console.log('вошёл как учитель, uid:', auth.uid);

  if (remove) {
    /*
      Предохранитель. Тестовый класс легко превращается в настоящий: если
      учитель добавил в него живых детей или переименовал его, то удаление
      снесёт класс вместе с ними. Идентификатор `test` при переименовании
      не меняется — по нему одному отличить настоящий класс от выдуманного
      нельзя, поэтому спрашиваем базу, кто в нём сейчас.
    */
    const все = (await dbGet(`${ROOT}/students`, { token })) ?? {};
    const свои = new Set(УЧЕНИКИ.map((у) => у.id));
    const чужие = Object.entries(все)
      .filter(([id, у]) => у?.classId === CLASS_ID && !свои.has(id))
      .map(([, у]) => у.name);

    if (чужие.length) {
      throw new Error(
        `в классе «test» есть настоящие ученики (${чужие.length}): ${чужие.slice(0, 3).join(', ')}` +
        (чужие.length > 3 ? ' и другие' : '') +
        '.\nУдалять его нельзя — иначе они останутся без класса. ' +
        'Переименуй класс в панели, а выдуманных учеников удали там же кнопкой «Удалить».',
      );
    }

    await dbPut(`${ROOT}/classes/${CLASS_ID}`, null, { token });
    for (const у of УЧЕНИКИ) {
      await dbPut(`${ROOT}/students/${у.id}`, null, { token });
      await dbPut(`${ROOT}/secrets/${у.id}`, null, { token });
      await dbPut(`${ROOT}/bindings/${у.id}`, null, { token });
      /*
        Проверка входа шла насквозь, до сданной работы и начисленных баллов,
        поэтому за учеником остаются следы и вне карточки. Стереть их надо
        здесь же: класса уже нет, показать их некому, но лежать в базе они
        будут вечно и попадутся при следующей же выгрузке.

        Работы удаляются по одному уроку, а строка в таблице — по одному
        ученику: правила базы разрешают учителю писать только на этих
        уровнях, и снос ветки целиком получил бы отказ.
      */
      const работы = (await dbGet(`${ROOT}/submissions/${у.id}`, { token })) ?? {};
      for (const lessonId of Object.keys(работы)) {
        await dbPut(`${ROOT}/submissions/${у.id}/${lessonId}`, null, { token });
      }
      await dbPut(`${ROOT}/progress/${у.id}`, null, { token });
      await dbPut(`${ROOT}/leaderboard/${CLASS_ID}/${у.id}`, null, { token });
    }
    await dbPut(`${ROOT}/assignments/${CLASS_ID}`, null, { token });
    console.log('тестовый класс удалён: ученики, коды, работы, прогресс и таблица класса');
    return;
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

  console.log('');
  console.log('готово: класс «Тест», три ученика, один назначенный урок');
  console.log('теперь можно войти на сайте: класс «Тест» → любая фамилия → код выше');
}
