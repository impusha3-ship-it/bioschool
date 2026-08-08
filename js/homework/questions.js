/**
 * Проверка ответов домашнего задания.
 *
 * Здесь нет ни DOM, ни сети — только правила проверки, потому что это то
 * место, где ошибка не падает с исключением, а молча ставит ученику неверную
 * оценку. Такое обязано проверяться без браузера.
 *
 * Типы вопросов:
 *   choice — один верный из нескольких
 *   multi  — несколько верных, засчитывается только полное совпадение
 *   short  — короткий ответ словом, сверяется мягко
 *   open   — развёрнутый ответ, автоматически не проверяется вообще
 */

/**
 * Приводит короткий ответ к виду, в котором его можно сравнивать.
 *
 * Ребёнок пишет «Клетка», «клетка », «клётка» — и во всех трёх случаях
 * знает ответ. Придираться к регистру, пробелам и букве «ё» здесь значит
 * снижать оценку за скорость печати, а не за незнание биологии.
 */
export function normalizeShort(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Вопросы этих типов проверяются сами; остальное смотрит учитель. */
export const AUTO_TYPES = ['choice', 'multi', 'short'];

export function isAuto(question) {
  return AUTO_TYPES.includes(question?.type);
}

/** Проверяет один ответ. Возвращает null для вопросов, которые не проверяются сами. */
export function checkAnswer(question, answer) {
  if (!isAuto(question)) return null;

  if (question.type === 'choice') {
    const ok = Number.isInteger(answer) && answer === question.correct;
    return { id: question.id, ok, got: answer ?? null };
  }

  if (question.type === 'multi') {
    const выбрано = Array.isArray(answer) ? [...new Set(answer)].sort((a, b) => a - b) : [];
    const верно = [...new Set(question.correct ?? [])].sort((a, b) => a - b);
    // Частично верный ответ не засчитывается: иначе выгодно отметить всё подряд.
    const ok = выбрано.length === верно.length && выбрано.every((v, i) => v === верно[i]);
    return { id: question.id, ok, got: выбрано };
  }

  const дано = normalizeShort(answer);
  const годные = (question.answers ?? []).map(normalizeShort).filter(Boolean);
  return { id: question.id, ok: дано !== '' && годные.includes(дано), got: String(answer ?? '').trim() };
}

/**
 * Считает автоматическую часть работы.
 * Развёрнутые вопросы в total не входят — их баллы ставит учитель отдельно.
 */
export function scoreQuestions(questions = [], answers = {}) {
  const details = questions
    .filter(isAuto)
    .map((q) => checkAnswer(q, answers[q.id]));

  return {
    total: details.length,
    correct: details.filter((d) => d.ok).length,
    details,
  };
}

/** Развёрнутые вопросы — то, что придётся читать учителю. */
export function openQuestions(questions = []) {
  return questions.filter((q) => q.type === 'open');
}

/**
 * Собирает итог работы: игра плюс вопросы.
 * Развёрнутые ответы сюда не входят — на момент сдачи их ещё никто не смотрел.
 */
export function combineScore({ game = null, questions = null } = {}) {
  const correct = (game?.correct ?? 0) + (questions?.correct ?? 0);
  const total = (game?.total ?? 0) + (questions?.total ?? 0);
  return {
    correct,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
  };
}

/** Ориентировочная отметка. Пороги вынесены наружу: у учителя они свои. */
export function grade(percent, пороги = { five: 85, four: 70, three: 50 }) {
  if (percent >= пороги.five) return 5;
  if (percent >= пороги.four) return 4;
  if (percent >= пороги.three) return 3;
  return 2;
}
