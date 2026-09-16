import * as rest from '../api/firebase-rest.js';
import { SCHOOL_ID } from '../firebase-config.js';
import { combineScore } from './questions.js';

const ROOT = `schools/${SCHOOL_ID}`;

/**
 * Код ошибки «вход на этом устройстве больше не действует».
 *
 * Привязка входа у ученика одна: вход под тем же именем на другом устройстве
 * переписывает её, и здесь база перестаёт пускать к своим работам, хотя
 * сайт по-прежнему считает, что ученик вошёл. Лечится повторным входом.
 */
export const ВХОД_УСТАРЕЛ = 'вход-устарел';

const отказ = (error) => /Доступ запрещён/.test(error?.message ?? '');

function входУстарел() {
  const error = new Error(
    'Похоже, под твоим именем входили на другом устройстве, и вход здесь больше не действует. ' +
      'Войди заново — работа ещё не сдана, и после входа её можно будет отправить.',
  );
  error.code = ВХОД_УСТАРЕЛ;
  return error;
}

/**
 * Сдача домашней работы и всё вокруг неё.
 *
 * Главное правило: **в журнал идёт первая попытка**. Дальше тренироваться
 * можно сколько угодно, но оценка уже поставлена. Это условие держится не
 * на интерфейсе, а на правилах базы — ученик физически не может переписать
 * уже сданную работу, а не просто не видит кнопки.
 *
 * Поэтому повторные прохождения пишутся не в работу, а в свой прогресс:
 * туда ученику писать можно, и оценку это не трогает.
 */
export function createHomework({ api = rest, now = () => Date.now() } = {}) {
  /** Что назначено классу. */
  async function loadAssignments(classId) {
    if (!classId) return {};
    return (await api.dbGet(`${ROOT}/assignments/${classId}`)) ?? {};
  }

  /**
   * Уже сданные работы ученика. Читаются только свои.
   *
   * Отказ здесь бывает ровно по одной причине — привязка входа уже не наша,
   * — и молча считать его «ничего не сдано» нельзя: страница предложит
   * сдать, а база откажет.
   */
  async function loadSubmissions(studentId, token) {
    if (!studentId || !token) return {};
    try {
      return (await api.dbGet(`${ROOT}/submissions/${studentId}`, { token })) ?? {};
    } catch (error) {
      if (отказ(error)) throw входУстарел();
      throw error;
    }
  }

  /** Собирает работу в то, что уйдёт в базу. */
  function buildSubmission({ gameResult, questionResult, answers, open, dueAt }) {
    const итог = combineScore({ game: gameResult, questions: questionResult });
    const submittedAt = now();
    return {
      attempt: 1,
      submittedAt,
      isLate: Boolean(dueAt) && submittedAt > dueAt,
      correct: итог.correct,
      total: итог.total,
      percent: итог.percent,
      answers: answers ?? {},
      open: open ?? {},
    };
  }

  /**
   * Сдаёт работу. Если она уже сдана, база откажет — и это правильный ответ,
   * а не сбой: переписывать оценку нельзя.
   *
   * Но база отказывает и по другим причинам, а ответ у неё один. Поэтому
   * после отказа причина выясняется: до 16 сентября любой отказ назывался
   * «уже сдана», и ученик с устаревшим входом не мог понять, что ему делать.
   */
  async function submit({ studentId, classId, lessonId, token, ...работа }) {
    const тело = buildSubmission(работа);
    try {
      await api.dbPut(`${ROOT}/submissions/${studentId}/${lessonId}`, тело, { token });
    } catch (error) {
      if (отказ(error)) throw await причинаОтказа({ studentId, classId, lessonId, token });
      throw error;
    }
    return тело;
  }

  /** Почему база не приняла работу: по порядку правил сдачи. */
  async function причинаОтказа({ studentId, classId, lessonId, token }) {
    let сданная;
    try {
      сданная = await api.dbGet(`${ROOT}/submissions/${studentId}/${lessonId}`, { token });
    } catch (error) {
      return отказ(error) ? входУстарел() : error;
    }

    if (сданная) {
      return new Error('Эта работа уже сдана. Переписать её нельзя, но потренироваться можно сколько угодно.');
    }

    const назначение = classId
      ? await api.dbGet(`${ROOT}/assignments/${classId}/${lessonId}`).catch(() => null)
      : null;
    if (назначение && !назначение.isOpen) {
      return new Error('Учитель закрыл это задание, сдать его сейчас нельзя.');
    }

    return new Error('Сайт не смог сдать работу. Выйди, войди заново и попробуй ещё раз; если не выйдет — скажи учителю.');
  }

  /** Повторное прохождение: в оценку не идёт, но виден прогресс. */
  async function recordPractice({ studentId, lessonId, token, correct, total }) {
    if (!studentId || !token) return null;
    const запись = { at: now(), correct, total };
    try {
      await api.dbPut(`${ROOT}/progress/${studentId}/practice/${lessonId}`, запись, { token });
    } catch {
      // Тренировка — не то, ради чего стоит показывать ошибку.
      return null;
    }
    return запись;
  }

  return { loadAssignments, loadSubmissions, buildSubmission, submit, recordPractice };
}
