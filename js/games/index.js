import { createSortGame } from './sort.js';
import { createMatchGame } from './match.js';
import { createOrderGame } from './order.js';
import { createLabelGame } from './label.js';
import { createLabGame } from './lab.js';

const REGISTRY = {
  sort: createSortGame,
  match: createMatchGame,
  order: createOrderGame,
  label: createLabelGame,
  lab: createLabGame,
};

export const KNOWN_GAME_TYPES = Object.keys(REGISTRY);

/** Создаёт игру по конфигу из файла урока. */
export function createGame(config, options = {}) {
  const make = REGISTRY[config?.type];
  if (!make) throw new Error(`Неизвестный тип игры: ${config?.type ?? '(не указан)'}`);
  return make(config, options);
}
