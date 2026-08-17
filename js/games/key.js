/**
 * «Определитель» — узнать организм по признакам, не угадывая.
 *
 * Определитель устроен парами: на каждом шаге два взаимоисключающих
 * утверждения, и надо выбрать то, которое **подходит к образцу перед тобой**.
 * Выбор ведёт либо к следующей паре, либо к названию. Угадывать нечего:
 * если честно отвечать про признаки, название получается само.
 *
 * Поэтому неверный шаг здесь не подсвечивается сразу — иначе определитель
 * превратился бы в обычный вопрос с проверкой, а его смысл в другом. Ветка
 * уводит к чужому названию, и ученик видит то, что видит любой ботаник:
 * определитель привёл не туда, значит, где-то на пути признак прочитан
 * неверно. Пройденный путь остаётся на экране — по нему и ищут ошибку.
 *
 * В счёт идут образцы, определённые с первой попытки; пересдавать можно
 * сколько угодно.
 */
export function createKeyGame(config, { document: doc = globalThis.document } = {}) {
  const couplets = config.couplets ?? {};
  const specimens = config.specimens ?? [];
  const start = config.start ?? Object.keys(couplets)[0];

  проверить(couplets, specimens, start);

  const listeners = new Set();
  let образец = 0;
  let узел = start;
  let путь = [];
  let вердикт = null;                 // null | { name, ok }
  const итоги = new Map();            // id образца → { ok, попыток }

  const element = doc.createElement('div');
  element.className = 'game game--key';

  const холст = doc.createElement('div');
  холст.className = 'key';

  if (config.prompt) {
    const p = doc.createElement('p');
    p.className = 'game__prompt';
    p.textContent = config.prompt;
    element.append(p);
  }
  element.append(холст);

  function notify() {
    render();
    for (const fn of listeners) fn();
  }

  function текущий() {
    return specimens[образец];
  }

  /* ── Действия ─────────────────────────────────────────── */

  function pick(index) {
    if (вердикт || !couplets[узел]) return false;
    const вариант = couplets[узел].options[index];
    if (!вариант) return false;

    путь.push({ couplet: узел, text: вариант.text });

    if (вариант.name) {
      const образецТек = текущий();
      const ok = вариант.name === образецТек.answer;
      const было = итоги.get(образецТек.id) ?? { ok: false, попыток: 0 };
      итоги.set(образецТек.id, {
        // Засчитывается только первая попытка: со второй ученик уже знает,
        // куда не сворачивать, и определять ему больше нечего.
        ok: было.попыток === 0 ? ok : было.ok,
        попыток: было.попыток + 1,
      });
      вердикт = { name: вариант.name, ok };
    } else {
      узел = вариант.go;
    }

    notify();
    return true;
  }

  /** Пройти определитель для того же образца заново. */
  function retry() {
    узел = start;
    путь = [];
    вердикт = null;
    notify();
  }

  /** Перейти к следующему образцу. */
  function next() {
    if (образец >= specimens.length - 1) return false;
    образец += 1;
    retry();
    return true;
  }

  /* ── Разметка ─────────────────────────────────────────── */

  function render() {
    холст.replaceChildren(...собрать());
  }

  function собрать() {
    const о = текущий();
    const части = [];

    if (specimens.length > 1) {
      части.push(метка(`Образец ${образец + 1} из ${specimens.length}`));
    }

    части.push(
      абзац(о.title, 'key__specimen-title'),
      абзац(о.description, 'key__specimen'),
    );

    if (путь.length) {
      const список = doc.createElement('ol');
      список.className = 'key__path';
      список.append(...путь.map((ш) => {
        const li = doc.createElement('li');
        li.textContent = ш.text;
        return li;
      }));
      части.push(метка('Путь по определителю'), список);
    }

    if (вердикт) {
      части.push(...собратьВердикт(о));
      return части;
    }

    const пара = couplets[узел];
    части.push(метка(пара.question ?? 'Выбери подходящее утверждение'));

    const выбор = doc.createElement('div');
    выбор.className = 'key__options';
    выбор.append(...пара.options.map((o, i) => {
      const btn = doc.createElement('button');
      btn.className = 'key__option';
      btn.setAttribute('type', 'button');
      btn.textContent = o.text;
      btn.addEventListener('click', () => pick(i));
      return btn;
    }));
    части.push(выбор);

    return части;
  }

  function собратьВердикт(о) {
    const части = [];
    const первая = (итоги.get(о.id)?.попыток ?? 0) <= 1;

    части.push(
      заметка(
        вердикт.ok,
        вердикт.ok
          ? `Определитель привёл к названию: ${вердикт.name}. Верно${первая ? '' : ', со второго захода'}.`
          : `Определитель привёл к названию: ${вердикт.name}. Но перед тобой не он. `
            + 'Значит, на каком-то шаге признак прочитан неверно — посмотри путь выше и найди, где именно.',
      ),
    );

    if (вердикт.ok && о.note) части.push(абзац(о.note, 'key__note'));

    if (!вердикт.ok) {
      части.push(кнопка('Пройти определитель заново', retry));
    } else if (образец < specimens.length - 1) {
      части.push(кнопка('Следующий образец', next));
    } else {
      const { correct, total } = getResult();
      части.push(
        абзац(
          // Без числа в этой фразе нарочно: «все 4 образцов» не согласуется,
          // а склонять числительные ради одной строки не стоит.
          correct === total
            ? 'Определены все образцы, и каждый — с первой попытки.'
            : `С первой попытки определено ${correct} из ${total}. Определитель не прощает невнимательности к признаку — в этом вся его польза.`,
          'key__score',
        ),
        кнопка('Начать сначала', reset, 'button button--quiet'),
      );
    }

    return части;
  }

  function метка(текст) {
    const p = doc.createElement('p');
    p.className = 'key__label';
    p.textContent = текст;
    return p;
  }

  function абзац(текст, className) {
    const p = doc.createElement('p');
    p.className = className;
    p.textContent = текст;
    return p;
  }

  function кнопка(текст, действие, className = 'button') {
    const btn = doc.createElement('button');
    btn.className = className;
    btn.setAttribute('type', 'button');
    btn.textContent = текст;
    btn.addEventListener('click', действие);
    return btn;
  }

  function заметка(ok, текст) {
    const блок = doc.createElement('div');
    блок.className = ok ? 'key__verdict key__verdict--ok' : 'key__verdict key__verdict--miss';
    const p = doc.createElement('p');
    p.textContent = текст;
    блок.append(p);
    return блок;
  }

  function getResult() {
    return {
      total: specimens.length,
      correct: specimens.filter((s) => итоги.get(s.id)?.ok).length,
      details: specimens.map((s) => ({
        id: s.id,
        ok: Boolean(итоги.get(s.id)?.ok),
        tries: итоги.get(s.id)?.попыток ?? 0,
      })),
    };
  }

  function reset() {
    образец = 0;
    итоги.clear();
    retry();
  }

  render();

  return {
    element,
    getResult,
    isComplete: () => образец === specimens.length - 1 && Boolean(вердикт?.ok),
    reset,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Точки входа для тестов и будущего управления с клавиатуры
    pick,
    retry,
    next,
    getSpecimen: () => текущий().id,
    getNode: () => узел,
    getVerdict: () => (вердикт ? { ...вердикт } : null),
  };
}

/**
 * Определитель обязан приводить к названию за конечное число шагов и по
 * любому пути. Сломанный определитель — это не неверный ответ, а тупик или
 * бесконечный круг: ученик не поймёт, что не так, и решит, что не понял тему.
 */
function проверить(couplets, specimens, start) {
  const ids = Object.keys(couplets);
  if (!ids.length) throw new Error('Определителю нужна хотя бы одна пара утверждений');
  if (!couplets[start]) throw new Error(`Определитель начинается с несуществующей пары «${start}»`);
  if (!specimens.length) throw new Error('Определителю нужен хотя бы один образец');

  const названия = new Set();

  for (const [id, пара] of Object.entries(couplets)) {
    const options = пара.options ?? [];
    if (options.length !== 2) {
      throw new Error(`Пара «${id}»: утверждений должно быть ровно два, найдено ${options.length}`);
    }
    for (const o of options) {
      if (!o.text) throw new Error(`Пара «${id}»: у утверждения нет текста`);
      if (o.name) названия.add(o.name);
      else if (!couplets[o.go]) {
        throw new Error(`Пара «${id}»: утверждение ведёт в несуществующую пару «${o.go}»`);
      }
    }
    const набор = new Set(options.map((o) => o.text.trim().toLowerCase()));
    if (набор.size !== options.length) {
      throw new Error(`Пара «${id}»: утверждения повторяются, выбрать между ними нельзя`);
    }
  }

  // Обход в глубину с пометкой пути: он и ловит круг, из которого не выйти.
  const серые = new Set();
  const чёрные = new Set();
  (function обойти(id) {
    if (чёрные.has(id)) return;
    if (серые.has(id)) throw new Error(`Определитель зациклен: пара «${id}» ведёт сама к себе`);
    серые.add(id);
    for (const o of couplets[id].options) if (o.go) обойти(o.go);
    серые.delete(id);
    чёрные.add(id);
  })(start);

  for (const id of ids) {
    if (!чёрные.has(id)) throw new Error(`Пара «${id}» недостижима: до неё не доводит ни один путь`);
  }

  for (const s of specimens) {
    if (!s.id || !s.title || !s.description) {
      throw new Error(`Образцу «${s.id ?? '(без номера)'}» не хватает названия или описания`);
    }
    if (!названия.has(s.answer)) {
      throw new Error(`Образец «${s.id}»: определитель никогда не приводит к ответу «${s.answer}»`);
    }
  }
}
