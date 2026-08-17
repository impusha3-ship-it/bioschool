import { shuffle } from './engine.js';
import { loadFigure, parseSvg } from '../ui/figure.js';

/**
 * «Проведи работу» — виртуальная лабораторная.
 *
 * Отличается от остальных механик тем, что проверяет не знание, а порядок
 * действий: на каждом шаге ученик выбирает, что делать дальше, и неверный
 * выбор показывает последствие — треснувшее стекло, складку через всё поле
 * зрения, высохшую кожицу. В кабинете такое последствие стоит препарата и
 * урока, здесь — ничего.
 *
 * Поэтому неверный выбор не заканчивает работу: вариант отпадает, объяснение
 * остаётся на виду, и шаг проходится снова. В счёт идут шаги, взятые с первой
 * попытки, — но пройти работу до конца можно всегда. Ученик, у которого
 * лаборатория закрылась на третьем шаге, не увидит результата, а увидеть его
 * и есть цель: у большинства это единственная возможность посмотреть, чем
 * кончается работа.
 *
 * Этап с оборудованием необязателен. Там, где он есть, лишние приборы берутся
 * из соседних работ: узнавать прибор среди похожих труднее, чем среди случайных.
 */
export function createLabGame(config, { document: doc = globalThis.document, random = Math.random } = {}) {
  const stages = config.stages ?? [];
  if (!stages.length) throw new Error('Игре «lab» нужен хотя бы один шаг работы');

  for (const stage of stages) {
    const верные = (stage.options ?? []).filter((o) => o.ok);
    if (верные.length !== 1) {
      throw new Error(`Шаг «${stage.id}»: верным должен быть ровно один вариант, найдено ${верные.length}`);
    }
    for (const o of stage.options) {
      if (!o.ok && !o.result) {
        throw new Error(`Шаг «${stage.id}»: у неверного варианта нет последствия`);
      }
    }
  }

  const набор = config.equipment ?? null;
  const listeners = new Set();

  /* Стол собирается до работы, поэтому это отдельный этап, а не нулевой шаг. */
  const надо = new Set(набор?.need ?? []);
  const наСтоле = new Set();
  let наборПроверен = false;
  let наборСразу = false;

  let шаг = набор ? -1 : 0;          // -1 — идёт сбор оборудования
  const промахи = new Map();          // id шага → сколько неверных выборов
  const пройдено = [];                // тексты того, что уже сделано

  // Что ученик уже отверг на текущем шаге. Хранится, чтобы объяснение
  // последствия оставалось на виду, а не пропадало при перерисовке.
  const отклонённые = new Map();

  const element = doc.createElement('div');
  element.className = 'game game--lab';

  const холст = doc.createElement('div');
  холст.className = 'lab-run';

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

  /* ── Оборудование ─────────────────────────────────────── */

  const порядокНабора = набор
    ? shuffle([...(набор.need ?? []), ...(набор.extra ?? [])], random)
    : [];

  function собратьНабор() {
    const части = [];

    // Заголовок капсом — только короткая метка этапа. Целое предложение капсом
    // на телефоне занимает три строки и читается хуже, чем обычным письмом.
    части.push(
      подзаголовок('Оборудование'),
      абзац(набор.prompt ?? 'Собери на стол то, что понадобится в работе.', 'lab-run__prompt'),
    );

    const полка = doc.createElement('div');
    полка.className = 'game__bank';
    полка.append(
      ...порядокНабора
        .filter((имя) => !наСтоле.has(имя))
        .map((имя) => чип(имя, () => { наСтоле.add(имя); notify(); })),
    );

    const стол = doc.createElement('div');
    стол.className = 'lab-run__table';
    const подпись = doc.createElement('p');
    подпись.className = 'lab-run__table-title';
    подпись.textContent = наСтоле.size ? 'На столе' : 'На столе пока пусто';
    стол.append(подпись);
    стол.append(
      ...[...наСтоле].map((имя) =>
        чип(имя, наборПроверен ? null : () => { наСтоле.delete(имя); notify(); }, знакНабора(имя)),
      ),
    );

    части.push(полка, стол);

    if (!наборПроверен) {
      части.push(кнопка('Всё собрал', () => {
        наборПроверен = true;
        наборСразу = надо.size === наСтоле.size && [...надо].every((и) => наСтоле.has(и));
        notify();
      }));
    } else {
      const забыто = [...надо].filter((и) => !наСтоле.has(и));
      части.push(
        разбор(
          наборСразу,
          наборСразу
            ? 'Стол собран верно — всё нужное на месте, лишнего нет.'
            : разборНабора(забыто),
        ),
      );
      части.push(кнопка('Начать работу', () => { шаг = 0; notify(); }));
    }

    return части;
  }

  function разборНабора(забыто) {
    const лишнее = [...наСтоле].filter((и) => !надо.has(и));
    const строки = [];
    if (забыто.length) строки.push(`Не хватает: ${забыто.join(', ')}.`);
    if (лишнее.length) строки.push(`Лишнее на столе: ${лишнее.join(', ')}.`);
    // Работу не запираем: увидеть, чем она кончается, важнее, чем наказать
    // за неверно собранный стол.
    строки.push('Работу это не остановит: считаем, что недостающее взяли, а лишнее убрали.');
    return строки.join(' ');
  }

  function знакНабора(имя) {
    if (!наборПроверен) return null;
    return надо.has(имя) ? 'ok' : 'miss';
  }

  /* ── Ход работы ───────────────────────────────────────── */

  function собратьХод() {
    const части = [];

    if (пройдено.length) {
      const сделано = doc.createElement('ol');
      сделано.className = 'lab-run__done';
      сделано.append(...пройдено.map((текст) => {
        const li = doc.createElement('li');
        li.textContent = текст;
        return li;
      }));
      части.push(подзаголовок('Что уже сделано'), сделано);
    }

    if (шаг >= stages.length) {
      части.push(...собратьИтог());
      return части;
    }

    const текущий = stages[шаг];
    части.push(
      подзаголовок(`Шаг ${шаг + 1} из ${stages.length}`),
      абзац(текущий.prompt, 'lab-run__prompt'),
    );

    const выбор = doc.createElement('div');
    выбор.className = 'lab-run__options';
    выбор.append(
      ...(текущий.options ?? []).map((o) => вариант(текущий, o)),
    );
    части.push(выбор);

    const отвергнутые = отклонённые.get(текущий.id) ?? [];
    for (const o of отвергнутые) части.push(разбор(false, o.result));

    return части;
  }

  function вариант(stage, option) {
    const отвергнут = (отклонённые.get(stage.id) ?? []).includes(option);
    const btn = doc.createElement('button');
    btn.className = отвергнут ? 'lab-run__option lab-run__option--out' : 'lab-run__option';
    btn.setAttribute('type', 'button');
    btn.textContent = option.text;
    if (отвергнут) btn.setAttribute('disabled', 'true');
    else btn.addEventListener('click', () => выбрать(stage, option));
    return btn;
  }

  function выбрать(stage, option) {
    if (option.ok) {
      пройдено.push(stage.result ?? option.text);
      шаг += 1;
      notify();
      return true;
    }
    const список = отклонённые.get(stage.id) ?? [];
    if (!список.includes(option)) список.push(option);
    отклонённые.set(stage.id, список);
    промахи.set(stage.id, (промахи.get(stage.id) ?? 0) + 1);
    notify();
    return false;
  }

  /* ── Итог ─────────────────────────────────────────────── */

  function собратьИтог() {
    const части = [подзаголовок('Работа выполнена')];

    if (config.outcome?.text) {
      части.push(абзац(config.outcome.text, 'lab-run__outcome'));
    }

    if (config.outcome?.figure) {
      части.push(картинка(config.outcome.figure, config.outcome.caption));
    }

    const { correct, total } = getResult();
    части.push(
      абзац(
        // Без числа: «все 4 шагов» не согласуется, а число шагов у работ разное.
        correct === total
          ? 'Все шаги пройдены с первой попытки.'
          : `Шагов с первой попытки: ${correct} из ${total}. Остальные разобраны по ходу — это и есть то, ради чего работу проводят.`,
        'lab-run__score',
      ),
    );

    части.push(кнопка('Пройти заново', reset, 'button button--quiet'));
    return части;
  }

  /**
   * Схема результата вставляется тем же путём, что и в конспекте: инлайновым
   * узлом с классом `figure__svg`. Без этого класса цвета к ней не применятся
   * и она останется чёрным силуэтом.
   */
  function картинка(src, caption) {
    const рамка = doc.createElement('figure');
    рамка.className = 'figure lab-run__figure';
    const место = doc.createElement('div');
    место.className = 'figure__holder';
    рамка.append(место);

    loadFigure(src)
      .then((text) => {
        const svg = parseSvg(text);
        if (!svg) return;
        svg.setAttribute('class', 'figure__svg');
        место.append(svg);
      })
      .catch(() => {
        const miss = doc.createElement('p');
        miss.className = 'figure__missing';
        miss.textContent = 'Схема не загрузилась.';
        место.append(miss);
      });

    if (caption) {
      const подпись = doc.createElement('figcaption');
      подпись.className = 'figure__caption';
      подпись.textContent = caption;
      рамка.append(подпись);
    }
    return рамка;
  }

  /* ── Мелочи разметки ──────────────────────────────────── */

  function подзаголовок(текст) {
    const h = doc.createElement('p');
    h.className = 'lab-run__step-title';
    h.textContent = текст;
    return h;
  }

  function абзац(текст, className) {
    const p = doc.createElement('p');
    p.className = className;
    p.textContent = текст;
    return p;
  }

  function чип(текст, действие, знак = null) {
    const btn = doc.createElement('button');
    btn.className = знак ? `game__chip game__chip--${знак}` : 'game__chip';
    btn.setAttribute('type', 'button');
    btn.textContent = текст;
    if (действие) btn.addEventListener('click', действие);
    else btn.setAttribute('disabled', 'true');
    return btn;
  }

  function кнопка(текст, действие, className = 'button') {
    const btn = doc.createElement('button');
    btn.className = className;
    btn.setAttribute('type', 'button');
    btn.textContent = текст;
    btn.addEventListener('click', действие);
    return btn;
  }

  function разбор(ok, текст) {
    const блок = doc.createElement('div');
    блок.className = ok ? 'lab-run__note lab-run__note--ok' : 'lab-run__note lab-run__note--miss';
    const p = doc.createElement('p');
    p.textContent = текст;
    блок.append(p);
    return блок;
  }

  function render() {
    холст.replaceChildren(...(шаг < 0 ? собратьНабор() : собратьХод()));
  }

  function getResult() {
    const details = stages.map((s, index) => ({
      id: s.id,
      ok: index < шаг && !промахи.get(s.id),
      misses: промахи.get(s.id) ?? 0,
    }));
    return {
      total: stages.length,
      correct: details.filter((d) => d.ok).length,
      details,
    };
  }

  function reset() {
    наСтоле.clear();
    наборПроверен = false;
    наборСразу = false;
    отклонённые.clear();
    промахи.clear();
    пройдено.length = 0;
    шаг = набор ? -1 : 0;
    notify();
  }

  render();

  return {
    element,
    getResult,
    isComplete: () => шаг >= stages.length,
    reset,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Точки входа для тестов и будущего управления с клавиатуры
    putOnTable: (имя) => { наСтоле.add(имя); notify(); },
    checkEquipment: () => {
      наборПроверен = true;
      наборСразу = надо.size === наСтоле.size && [...надо].every((и) => наСтоле.has(и));
      notify();
      return наборСразу;
    },
    startWork: () => { шаг = 0; notify(); },
    choose: (stageId, optionText) => {
      const stage = stages.find((s) => s.id === stageId);
      const option = stage?.options.find((o) => o.text === optionText);
      if (!stage || !option || stages[шаг] !== stage) return false;
      return выбрать(stage, option);
    },
    getStep: () => шаг,
  };
}
