/**
 * Трёхмерная модель животной клетки.
 *
 * Сцена строится кодом, а не грузится готовым файлом: так она весит
 * несколько килобайт вместо нескольких мегабайт, читается глазами и
 * правится по учебнику. Размеры и число органоидов схематичны — настоящая
 * животная клетка 10—30 мкм в поперечнике, и уместить в один кадр ядро и
 * рибосому в масштабе нельзя.
 *
 * `three.js` лежит в `js/vendor/` и подключается страницей: сайт не ходит
 * ни к одному чужому серверу, и на школьной сети, где закрыт cdnjs, модель
 * обязана открыться так же, как всё остальное.
 *
 * Здесь нет ни разметки страницы, ни кнопок — только сцена и то, чем ею
 * управляют. Подписи и карточка органоида живут на странице.
 */

/** Описания органоидов. Строение и функции — по учебнику Пасечника за 9 класс. */
export const ОРГАНОИДЫ = {
  membrane: {
    name: 'Плазматическая мембрана', short: 'Мембрана', color: '#a8386b',
    type: 'Поверхностный аппарат', size: 'толщина 7—10 нм',
    structure: 'Двойной слой липидов, в который встроены молекулы белков. Снаружи у животной клетки есть гликокаликс — слой углеводов, связанных с белками и липидами мембраны.',
    functions: [
      'Отделяет содержимое клетки от внешней среды',
      'Пропускает одни вещества и задерживает другие',
      'Переносит вещества внутрь и наружу, в том числе крупные частицы',
      'Принимает сигналы и обеспечивает связь между клетками',
    ],
  },
  cytoplasm: {
    name: 'Цитоплазма', short: 'Цитоплазма', color: '#3a5fa8',
    type: 'Внутренняя среда клетки', size: null,
    structure: 'Густой бесцветный раствор, основа которого вода. В нём лежат органоиды и включения — запасные вещества вроде капель жира и зёрен гликогена.',
    functions: [
      'Объединяет все части клетки в одно целое',
      'Служит средой, в которой идут биохимические реакции',
      'Переносит вещества и органоиды: цитоплазма движется',
    ],
  },
  nucleus: {
    name: 'Ядро', short: 'Ядро', color: '#4b3a9e',
    type: 'Двумембранная структура', size: 'диаметр 5—10 мкм',
    structure: 'Ядерная оболочка из двух мембран, пронизанная порами. Внутри кариоплазма, хроматин — ДНК вместе с белками — и одно или несколько ядрышек. Перед делением хроматин спирализуется, и тогда видны хромосомы.',
    functions: [
      'Хранит наследственную информацию в молекулах ДНК',
      'Управляет жизнедеятельностью клетки',
      'Передаёт наследственную информацию дочерним клеткам при делении',
    ],
  },
  nucleolus: {
    name: 'Ядрышко', short: 'Ядрышко', color: '#2b1f63',
    type: 'Структура ядра без мембраны', size: '1—5 мкм',
    structure: 'Плотное округлое тельце внутри ядра, мембраной не окружено. Состоит из РНК и белков.',
    functions: [
      'В ядрышках формируются рибосомы',
      'Готовые рибосомы выходят в цитоплазму через поры ядра',
    ],
  },
  rer: {
    name: 'Шероховатая ЭПС', short: 'Шероховатая ЭПС', color: '#3d8f5c',
    type: 'Одномембранный органоид', size: null,
    structure: 'Система канальцев и плоских цистерн, соединённая с наружной мембраной ядра. Поверхность усеяна рибосомами — отсюда и название.',
    functions: [
      'На сидящих на ней рибосомах синтезируются белки',
      'По каналам вещества переносятся дальше, в том числе к комплексу Гольджи',
      'Образует новые мембраны',
    ],
  },
  ser: {
    name: 'Гладкая ЭПС', short: 'Гладкая ЭПС', color: '#79ad63',
    type: 'Одномембранный органоид', size: 'трубочки 30—60 нм',
    structure: 'Сеть тонких ветвящихся трубочек без рибосом. Это продолжение шероховатой ЭПС: у них общая мембрана и общая полость, и на модели видно, как трубочки отходят от края её цистерн.',
    functions: [
      'Синтез углеводов и липидов',
      'Обезвреживание ядовитых веществ, особенно в клетках печени',
      'Запас ионов кальция в мышечных клетках',
    ],
  },
  ribosome: {
    name: 'Рибосомы', short: 'Рибосомы', color: '#b5761f',
    type: 'Органоид без мембраны', size: '20—30 нм',
    structure: 'Мелкие тельца из двух частей — большой и малой. Состоят из РНК и белков. Одни лежат в цитоплазме свободно, другие сидят на шероховатой ЭПС. В клетке их несколько миллионов.',
    functions: [
      'Собирают белок по записи, принесённой из ядра',
      'Свободные рибосомы работают на саму клетку, сидящие на ЭПС — в основном на вынос',
    ],
  },
  golgi: {
    name: 'Комплекс Гольджи', short: 'Комплекс Гольджи', color: '#c8621f',
    type: 'Одномембранный органоид', size: null,
    structure: 'Стопки уплощённых цистерн и пузырьки, которые от них отшнуровываются. Лежит обычно рядом с ядром.',
    functions: [
      'Накапливает и дорабатывает вещества, пришедшие из ЭПС',
      'Упаковывает их в пузырьки и отправляет по назначению или за пределы клетки',
      'Образует лизосомы',
    ],
  },
  mito: {
    name: 'Митохондрии', short: 'Митохондрии', color: '#b03b3b',
    type: 'Двумембранный органоид', size: '0,5—1 × 1—10 мкм',
    structure: 'Наружная мембрана гладкая, внутренняя собрана в складки — кристы. Внутри матрикс, а в нём собственная кольцевая ДНК и собственные рибосомы.',
    functions: [
      'Окисляют органические вещества с участием кислорода',
      'Запасают энергию, которой клетка живёт',
      'Могут делиться независимо от деления клетки',
    ],
  },
  lysosome: {
    name: 'Лизосомы', short: 'Лизосомы', color: '#8e2f77',
    type: 'Одномембранный органоид', size: '0,4—1 мкм',
    structure: 'Пузырьки под одной мембраной, внутри около пятидесяти видов пищеварительных ферментов. Образуются в комплексе Гольджи: пузырёк с ферментами отшнуровывается от крайней цистерны — на модели этот путь показан стрелкой.',
    functions: [
      'Расщепляют белки, жиры, углеводы и нуклеиновые кислоты',
      'Разбирают отслужившие органоиды',
      'Переваривают частицы, захваченные клеткой снаружи',
    ],
  },
  centrosome: {
    name: 'Клеточный центр', short: 'Клеточный центр', color: '#2f9d8d',
    type: 'Органоид без мембраны', size: 'центриоль 0,2 × 0,4 мкм',
    structure: 'Две центриоли, поставленные поперёк друг друга. Каждая — полый цилиндр из девяти троек микротрубочек. У животных есть, у высших растений нет.',
    functions: [
      'Образует веретено деления и делит генетический материал поровну',
      'Служит местом, откуда растут микротрубочки цитоскелета',
    ],
  },
  cytoskeleton: {
    name: 'Цитоскелет', short: 'Цитоскелет', color: '#6f7a6d',
    type: 'Структуры без мембран', size: 'микротрубочки 25 нм',
    structure: 'Сеть белковых нитей в цитоплазме: полые микротрубочки и более тонкие нити. На модели показаны микротрубочки, расходящиеся от клеточного центра.',
    functions: [
      'Держит форму клетки',
      'Перемещает органоиды и пузырьки внутри неё',
      'Участвует в движении клетки и в её делении',
    ],
  },
};

/** Порядок в списке: от поверхности внутрь, как разбирают клетку на уроке. */
export const ГРУППЫ = [
  ['Поверхностный аппарат', ['membrane']],
  ['Цитоплазма', ['cytoplasm']],
  ['Ядро', ['nucleus', 'nucleolus']],
  ['Одномембранные органоиды', ['rer', 'ser', 'golgi', 'lysosome']],
  ['Двумембранные органоиды', ['mito']],
  ['Органоиды без мембран', ['ribosome', 'centrosome', 'cytoskeleton']],
];

/**
 * Собирает сцену на готовом полотне.
 *
 * `THREE` приходит снаружи: библиотека подключается страницей обычным
 * скриптом и кладётся в глобальную область, а этот модуль её не ищет —
 * так его можно позвать и из теста, подсунув заглушку.
 *
 * Возвращает то, чем сценой управляет страница: выбор органоида, кнопки,
 * положение подписей и остановку.
 */
export function создатьСцену({ THREE, canvas, stage, сниженнаяАнимация = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  const ДОМ = new THREE.Vector3(-19, 11, -19);
  camera.position.copy(ДОМ);

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 7;
  controls.maxDistance = 60;
  controls.enablePan = false;
  /*
    Колесо поначалу не трогается: модель стоит посреди страницы, и если она
    сразу ловит прокрутку, мимо неё не пролистать — страница встаёт колом, а
    ученик крутит колесо и не понимает, почему ничего не едет. Колесо
    достаётся модели только после того, как её взяли рукой, и возвращается
    странице, как только курсор ушёл.
  */
  controls.enableZoom = false;
  canvas.addEventListener('pointerdown', () => { controls.enableZoom = true; });
  canvas.addEventListener('pointerleave', () => { controls.enableZoom = false; });
  controls.autoRotate = !сниженнаяАнимация;
  controls.autoRotateSpeed = 0.55;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8476, 0.85));
  const свет1 = new THREE.DirectionalLight(0xffffff, 0.75);
  свет1.position.set(-12, 18, -6);
  scene.add(свет1);
  const свет2 = new THREE.DirectionalLight(0xfff4e4, 0.35);
  свет2.position.set(14, -6, 10);
  scene.add(свет2);

  const клетка = new THREE.Group();
  scene.add(клетка);

  /*
    Случайность здесь своя и с постоянным зерном: органоиды должны лежать
    одинаково при каждом открытии, иначе учитель не сможет сказать «смотри
    на митохондрию слева» — у соседа она окажется справа.
  */
  let зерно = 20260926;
  function random() {
    зерно |= 0;
    зерно = (зерно + 0x6d2b79f5) | 0;
    let t = Math.imul(зерно ^ (зерно >>> 15), 1 | зерно);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /*
    Клетка показана с вырезанной четвертью — иначе внутри ничего не видно.
    Сферы строятся от phi = 0 на три четверти оборота, и вырезанной остаётся
    та четверть, где x < 0 и z < 0. Всё, что должно быть видно в разрезе,
    туда и ставится.
  */
  const ФИ0 = 0;
  const ФИ = Math.PI * 1.5;
  function сфера(phi, theta, r) {
    return V(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
  }
  const вРазрезе = (p) => p.x < 0 && p.z < 0;
  function случайноеНаправление() {
    const u = random() * 2 - 1;
    const t = random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return V(s * Math.cos(t), u, s * Math.sin(t));
  }

  const реестр = {};
  for (const k of Object.keys(ОРГАНОИДЫ)) реестр[k] = { материалы: new Set(), якорь: null };
  const выбираемые = [];

  function материал(ключ, свойства) {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color: ОРГАНОИДЫ[ключ].color, roughness: 0.55, metalness: 0, transparent: true },
      свойства || {},
    ));
    m.userData.база = m.opacity;
    m.userData.глубина = m.depthWrite;
    реестр[ключ].материалы.add(m);
    return m;
  }
  function добавить(ключ, mesh, родитель) {
    mesh.userData.ключ = ключ;
    выбираемые.push(mesh);
    (родитель || клетка).add(mesh);
    return mesh;
  }

  /** Полосатая текстура: кристы митохондрий и тройки микротрубочек центриоли. */
  function полоски(фон, линия, сколько, волной) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = фон;
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = линия;
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (let i = 0; i < сколько; i += 1) {
      const x0 = ((i + 0.5) * 256) / сколько;
      g.beginPath();
      for (let y = 6; y <= 122; y += 4) {
        const x = x0 + (волной ? Math.sin(y * 0.12 + i) * 5 : 0);
        if (y === 6) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  // Занятые места: органоиды не должны налезать друг на друга и на ядро.
  const занято = [{ p: V(0, 0, 0), r: 3.7 }];
  const свободно = (p, r) => занято.every((o) => o.p.distanceTo(p) > o.r + r + 0.25);
  function поставить(rMin, rMax, r) {
    let p;
    for (let i = 0; i < 400; i += 1) {
      p = случайноеНаправление().multiplyScalar(rMin + (rMax - rMin) * random());
      if (свободно(p, r)) {
        занято.push({ p, r });
        return p;
      }
    }
    занято.push({ p, r });
    return p;
  }

  // ---------- мембрана и цитоплазма ----------
  const мембранаСнаружи = добавить('membrane', new THREE.Mesh(
    new THREE.SphereGeometry(10, 96, 64, ФИ0, ФИ),
    материал('membrane', { opacity: 0.34, side: THREE.DoubleSide, depthWrite: false, roughness: 0.35 }),
  ));
  const мембранаВнутри = добавить('membrane', new THREE.Mesh(
    new THREE.SphereGeometry(9.8, 96, 64, ФИ0, ФИ),
    материал('membrane', { opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  ));
  const мембранаЦеликом = добавить('membrane', new THREE.Mesh(
    new THREE.SphereGeometry(10, 96, 64),
    материал('membrane', { opacity: 0.5, side: THREE.FrontSide, depthWrite: false, roughness: 0.35 }),
  ));
  мембранаЦеликом.visible = false;
  const цитоплазма = добавить('cytoplasm', new THREE.Mesh(
    new THREE.SphereGeometry(9.7, 64, 48, ФИ0, ФИ),
    материал('cytoplasm', { opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  ));
  мембранаСнаружи.renderOrder = 5;
  мембранаВнутри.renderOrder = 5;
  мембранаЦеликом.renderOrder = 5;
  цитоплазма.renderOrder = 4;
  реестр.membrane.якорь = сфера(1.35 * Math.PI, 0.75, 10);
  реестр.cytoplasm.якорь = V(-5.2, -3.6, -6.2);

  // ---------- ядро ----------
  добавить('nucleus', new THREE.Mesh(new THREE.SphereGeometry(3.4, 64, 48, ФИ0, ФИ),
    материал('nucleus', { opacity: 0.9, side: THREE.DoubleSide })));
  добавить('nucleus', new THREE.Mesh(new THREE.SphereGeometry(3.15, 64, 48, ФИ0, ФИ),
    материал('nucleus', { opacity: 0.75, side: THREE.DoubleSide, color: '#6d5bd0' })));
  добавить('nucleus', new THREE.Mesh(new THREE.SphereGeometry(3.1, 48, 32, ФИ0, ФИ),
    материал('nucleus', { opacity: 0.18, side: THREE.DoubleSide, color: '#c9c0f5', depthWrite: false })));

  const пораГео = new THREE.TorusGeometry(0.13, 0.045, 6, 14);
  const пораМат = материал('nucleus', { color: '#3b2d85' });
  for (let i = 0; i < 70; i += 1) {
    const p = случайноеНаправление().multiplyScalar(3.42);
    if (вРазрезе(p)) continue;
    const m = new THREE.Mesh(пораГео, пораМат);
    m.position.copy(p);
    m.lookAt(V(0, 0, 0));
    добавить('nucleus', m);
  }
  const хроматинМат = материал('nucleus', { color: '#4b3a9e' });
  for (let i = 0; i < 9; i += 1) {
    let p = случайноеНаправление().multiplyScalar(1.2 + random() * 1.4);
    const точки = [p.clone()];
    for (let s = 0; s < 6; s += 1) {
      p = p.clone().add(случайноеНаправление().multiplyScalar(0.75));
      if (p.length() > 2.8) p.setLength(2.6);
      точки.push(p);
    }
    добавить('nucleus', new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(точки), 48, 0.055, 5), хроматинМат));
  }
  /*
    Подпись — у верхушки оболочки, а не на её боку: сбоку она оказывалась в
    двух пикселях от подписи митохондрии, и при малейшем повороте одна из
    двух пропадала. Здесь до ближайшей соседки двадцать пикселей.
  */
  реестр.nucleus.якорь = сфера(1.47 * Math.PI, 0.65, 3.7);

  const ядрышкоГео = new THREE.SphereGeometry(1.05, 40, 28);
  {
    const a = ядрышкоГео.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < a.count; i += 1) {
      v.fromBufferAttribute(a, i);
      v.multiplyScalar(1 + 0.09 * Math.sin(v.x * 6) * Math.sin(v.y * 5 + 1) * Math.cos(v.z * 6));
      a.setXYZ(i, v.x, v.y, v.z);
    }
    ядрышкоГео.computeVertexNormals();
  }
  const ядрышко = добавить('nucleolus', new THREE.Mesh(ядрышкоГео, материал('nucleolus', { roughness: 0.7 })));
  ядрышко.position.set(-1.05, 0.35, -1.0);
  реестр.nucleolus.якорь = ядрышко.position.clone().add(V(0, 0.9, 0));

  // ---------- шероховатая ЭПС ----------
  const рельеф = (d) => 0.16 * Math.sin(d.x * 6 + d.y * 8) * Math.cos(d.z * 6);
  const ЭПС = { ps: 0.5 * Math.PI, pl: 0.68 * Math.PI, ts: 0.55, tl: 1.95 };
  const шерохМат = материал('rer', { opacity: 0.82, side: THREE.DoubleSide });
  for (const r of [4.05, 4.7, 5.35]) {
    const g = new THREE.SphereGeometry(r, 72, 40, ЭПС.ps, ЭПС.pl, ЭПС.ts, ЭПС.tl);
    const a = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < a.count; i += 1) {
      v.fromBufferAttribute(a, i);
      const d = v.clone().normalize();
      v.copy(d.multiplyScalar(r + рельеф(d)));
      a.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    добавить('rer', new THREE.Mesh(g, шерохМат));
  }
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      занято.push({ p: сфера(ЭПС.ps + (ЭПС.pl * (i + 0.5)) / 5, ЭПС.ts + (ЭПС.tl * (j + 0.5)) / 5, 4.7), r: 1.0 });
    }
  }
  /*
    Подпись ставится к нижнему краю наружной цистерны. Место выбрано не на
    глаз: в исходном виде она проецировалась ровно в ту же точку экрана, что
    и подпись митохондрии, и одна из двух всегда пропадала.
  */
  реестр.rer.якорь = сфера(1.17 * Math.PI, 2.4, 5.5);

  // ---------- рибосомы: на ЭПС и свободные ----------
  const рибоГео = new THREE.SphereGeometry(0.075, 8, 6);
  const рибоМат = материал('ribosome', { roughness: 0.45 });
  const рибоТочки = [];
  for (const r of [4.05, 4.7, 5.35]) {
    for (let i = 0; i < 150; i += 1) {
      const phi = ЭПС.ps + random() * ЭПС.pl;
      const th = ЭПС.ts + 0.04 + random() * (ЭПС.tl - 0.08);
      const d = сфера(phi, th, 1);
      рибоТочки.push(d.clone().multiplyScalar(r + рельеф(d) + (random() < 0.5 ? 0.09 : -0.09)));
    }
  }
  let свободных = 0;
  while (свободных < 260) {
    const p = случайноеНаправление().multiplyScalar(3.9 + random() * 5.6);
    if (p.length() > 9.4) continue;
    рибоТочки.push(p);
    свободных += 1;
  }
  const рибоСетка = new THREE.InstancedMesh(рибоГео, рибоМат, рибоТочки.length);
  const матрица = new THREE.Matrix4();
  рибоТочки.forEach((p, i) => {
    матрица.makeTranslation(p.x, p.y, p.z);
    рибоСетка.setMatrixAt(i, матрица);
  });
  добавить('ribosome', рибоСетка);
  реестр.ribosome.якорь = рибоТочки[рибоТочки.length - 40];

  // ---------- гладкая ЭПС: сеть, продолжающая шероховатую ----------
  const гладкМат = материал('ser', { roughness: 0.45 });
  const ТЕТА = [1.0, 1.35, 1.7, 2.05, 2.4];
  const РАДИУСЫ0 = [4.05, 4.7, 5.35];
  const РАДИУСЫ = [4.35, 5.05, 5.75];
  const узлы = [];
  for (let i = 0; i < 5; i += 1) {
    узлы.push([]);
    for (let j = 0; j < ТЕТА.length; j += 1) {
      узлы[i].push([]);
      for (let k = 0; k < 3; k += 1) {
        let p;
        if (i === 0) {
          const d = сфера(ЭПС.ps + 0.01, ТЕТА[j], 1);
          p = d.multiplyScalar(РАДИУСЫ0[k] + рельеф(d));
        } else {
          p = сфера(ЭПС.ps - i * 0.08 * Math.PI, ТЕТА[j] + (random() - 0.5) * 0.2,
            РАДИУСЫ[k] + (random() - 0.5) * 0.35).add(случайноеНаправление().multiplyScalar(0.2));
        }
        узлы[i][j].push(p);
      }
    }
  }
  const сустав = new THREE.SphereGeometry(0.1, 10, 8);
  function трубка(a, b) {
    const середина = a.clone().add(b).multiplyScalar(0.5)
      .add(случайноеНаправление().multiplyScalar(a.distanceTo(b) * 0.15));
    добавить('ser', new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, середина, b]), 12, 0.07, 6), гладкМат));
  }
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < ТЕТА.length; j += 1) {
      for (let k = 0; k < 3; k += 1) {
        const p = узлы[i][j][k];
        if (i < 4 && (i === 0 || random() < 0.8)) трубка(p, узлы[i + 1][j][k]);
        if (i > 0) {
          if (j < ТЕТА.length - 1 && random() < 0.55) трубка(p, узлы[i][j + 1][k]);
          if (k < 2 && random() < 0.4) трубка(p, узлы[i][j][k + 1]);
          const m = добавить('ser', new THREE.Mesh(сустав, гладкМат));
          m.position.copy(p);
          занято.push({ p, r: 0.3 });
        }
      }
    }
  }
  реестр.ser.якорь = узлы[3][2][2].clone().add(V(0, 0.35, 0));

  // ---------- комплекс Гольджи ----------
  const гольджиОсь = сфера(1.32 * Math.PI, 1.0, 1).normalize();
  const гольджи = new THREE.Group();
  гольджи.position.copy(гольджиОсь.clone().multiplyScalar(3.9));
  гольджи.quaternion.setFromUnitVectors(V(0, 1, 0), гольджиОсь);
  клетка.add(гольджи);
  const гольджиМат = материал('golgi', { side: THREE.DoubleSide, roughness: 0.5 });
  [1.6, 1.95, 2.3, 2.65, 3.0].forEach((r, i) => {
    const m = добавить('golgi', new THREE.Mesh(
      new THREE.SphereGeometry(r, 48, 10, 0, Math.PI * 2, 0, (1.25 - i * 0.04) / r), гольджиМат), гольджи);
    m.scale.set(1, 1, 1.25);
  });
  const пузырёк = new THREE.SphereGeometry(0.17, 14, 10);
  for (let i = 0; i < 12; i += 1) {
    const a = random() * Math.PI * 2;
    const r = 1.3 + random() * 0.5;
    const m = добавить('golgi', new THREE.Mesh(пузырёк, гольджиМат), гольджи);
    m.position.set(Math.cos(a) * r, 1.8 + random() * 1.8, Math.sin(a) * r * 1.25);
  }
  занято.push({ p: гольджиОсь.clone().multiplyScalar(6.2), r: 2.1 });
  реестр.golgi.якорь = гольджиОсь.clone().multiplyScalar(7.1);
  гольджи.updateMatrixWorld(true);

  // ---------- лизосома, отшнуровывающаяся от Гольджи ----------
  const кОбзору = ДОМ.clone().normalize();
  let поперёк = гольджиОсь.clone().cross(кОбзору).normalize();
  const кЗрителю = кОбзору.clone().sub(гольджиОсь.clone().multiplyScalar(кОбзору.dot(гольджиОсь))).normalize();
  поперёк.add(кЗрителю.multiplyScalar(0.35)).normalize();
  const вМестные = гольджи.quaternion.clone().invert();
  const вбок = поперёк.applyQuaternion(вМестные);
  вбок.y = 0;
  вбок.normalize();
  const вглубь = V(0, 1, 0).cross(вбок).normalize();
  const точка = (l, h, s) => вбок.clone().multiplyScalar(l).add(V(0, h, 0)).add(вглубь.clone().multiplyScalar(s || 0));
  const путь = new THREE.CatmullRomCurve3([
    точка(1.15, 2.95), точка(1.9, 3.35, 0.1), точка(2.7, 3.5, 0.25), точка(3.3, 3.35, 0.35),
  ]);
  const лизоМат = материал('lysosome', { roughness: 0.35 });
  const почка = new THREE.SphereGeometry(0.33, 20, 14);
  const п1 = добавить('lysosome', new THREE.Mesh(почка, лизоМат), гольджи);
  п1.position.copy(путь.getPoint(0));
  п1.scale.setScalar(0.85);
  const п2 = добавить('lysosome', new THREE.Mesh(почка, лизоМат), гольджи);
  п2.position.copy(путь.getPoint(0.5));
  const п3 = добавить('lysosome', new THREE.Mesh(почка, лизоМат), гольджи);
  п3.position.copy(путь.getPoint(1));

  const стрелкаМат = материал('lysosome', { opacity: 0.75, color: '#b34a9c' });
  const дуга = new THREE.CatmullRomCurve3([0.08, 0.3, 0.55, 0.8, 0.92].map((t) => путь.getPoint(t).add(V(0, 0.55, 0))));
  добавить('lysosome', new THREE.Mesh(new THREE.TubeGeometry(дуга, 40, 0.04, 6), стрелкаМат), гольджи);
  const наконечник = добавить('lysosome', new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 14), стрелкаМат), гольджи);
  наконечник.position.copy(дуга.getPoint(1));
  наконечник.quaternion.setFromUnitVectors(V(0, 1, 0), дуга.getTangent(1).normalize());
  наконечник.position.add(дуга.getTangent(1).normalize().multiplyScalar(0.15));

  const бегунок = добавить('lysosome', new THREE.Mesh(почка, лизоМат), гольджи);
  бегунок.visible = !сниженнаяАнимация;
  гольджи.updateMatrixWorld(true);
  реестр.lysosome.якорь = гольджи.localToWorld(путь.getPoint(1).add(V(0, 0.9, 0)));

  // ---------- клеточный центр и цитоскелет ----------
  const центрП = сфера(1.2 * Math.PI, 0.28, 4.7);
  const центр = new THREE.Group();
  центр.position.copy(центрП);
  клетка.add(центр);
  const центрМат = материал('centrosome', { map: полоски('#2f9d8d', '#14564f', 9, false), color: '#ffffff' });
  const цилиндр = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 18, 1, true);
  const крышка = new THREE.CircleGeometry(0.2, 18);
  const ц1 = добавить('centrosome', new THREE.Mesh(цилиндр, центрМат), центр);
  const ц2 = добавить('centrosome', new THREE.Mesh(цилиндр, центрМат), центр);
  ц2.rotation.z = Math.PI / 2;
  ц2.position.set(0.35, -0.45, 0);
  const торец = материал('centrosome', { color: '#14564f', side: THREE.DoubleSide });
  for (const [ц, y] of [[ц1, 0.4], [ц1, -0.4], [ц2, 0.4], [ц2, -0.4]]) {
    const k = добавить('centrosome', new THREE.Mesh(крышка, торец), ц);
    k.position.y = y;
    k.rotation.x = Math.PI / 2;
  }
  занято.push({ p: центрП.clone(), r: 1.1 });
  // Подпись поднята выше самих центриолей: ниже она сходилась с подписью
  // лизосомы, которая лежит прямо под клеточным центром.
  реестр.centrosome.якорь = центрП.clone().add(V(0, 1.3, 0));

  const трубочкиМат = материал('cytoskeleton', { opacity: 0.55, roughness: 0.6 });
  let якорьТрубочки = null;
  for (let i = 0; i < 18; i += 1) {
    const конец = случайноеНаправление().multiplyScalar(9.35);
    const середина = центрП.clone().add(конец).multiplyScalar(0.5);
    if (середина.length() < 5) середина.setLength(5.2);
    const кривая = new THREE.QuadraticBezierCurve3(центрП.clone(), середина, конец);
    добавить('cytoskeleton', new THREE.Mesh(new THREE.TubeGeometry(кривая, 36, 0.038, 5), трубочкиМат));
    if (!якорьТрубочки && вРазрезе(кривая.getPoint(0.7))) якорьТрубочки = кривая.getPoint(0.7);
  }
  реестр.cytoskeleton.якорь = якорьТрубочки || V(-6, 4, -5);

  // ---------- митохондрии ----------
  const митоМат = материал('mito', { map: полоски('#c14a46', '#8e2422', 11, true), color: '#ffffff', roughness: 0.5 });
  const митоГео = new THREE.SphereGeometry(1, 40, 24);
  for (let i = 0; i < 8; i += 1) {
    const p = поставить(5.2, 8.3, 1.25);
    const m = добавить('mito', new THREE.Mesh(митоГео, митоМат));
    m.position.copy(p);
    m.scale.set(1.15, 0.44, 0.44);
    m.quaternion.setFromUnitVectors(V(1, 0, 0), случайноеНаправление());
    if (!реестр.mito.якорь || (вРазрезе(p) && !вРазрезе(реестр.mito.якорь))) {
      реестр.mito.якорь = p.clone().add(V(0, 0.6, 0));
    }
  }

  // ---------- одиночные лизосомы ----------
  /*
    Подпись переезжает с отшнуровывающейся лизосомы на одиночную: у Гольджи
    и без неё тесно — там сходились сразу три подписи, и «Лизосомы» из них
    пропадали. Берётся самая нижняя из тех, что попали в разрез: вокруг неё
    пусто.
  */
  let одиночная = null;
  let простор = -1;
  const тесно = [центрП, гольджи.position];
  for (let i = 0; i < 5; i += 1) {
    const r = 0.32 + random() * 0.14;
    const m = добавить('lysosome', new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), лизоМат));
    m.position.copy(поставить(4.6, 8.8, r));
    if (!вРазрезе(m.position)) continue;
    const свобода = Math.min(...тесно.map((т) => т.distanceTo(m.position)));
    if (свобода > простор) {
      простор = свобода;
      одиночная = m.position.clone();
    }
  }
  if (одиночная) реестр.lysosome.якорь = одиночная.add(V(0, 0.6, 0));

  // ---------- управление ----------
  let выбран = null;

  /**
   * Выбранный органоид виден в полную силу, остальные гаснут. Мембрана и
   * цитоплазма гаснут слабее: погаси их совсем — и органоид повиснет в
   * пустоте, непонятно где.
   */
  function применитьВыбор() {
    for (const ключ of Object.keys(реестр)) {
      const свой = !выбран || выбран === ключ;
      for (const m of реестр[ключ].материалы) {
        const база = m.userData.база;
        let прозрачность = свой ? база : база * (ключ === 'membrane' || ключ === 'cytoplasm' ? 0.35 : 0.1);
        if (выбран === 'cytoplasm' && ключ === 'cytoplasm') прозрачность = 0.32;
        m.opacity = прозрачность;
        m.depthWrite = свой ? m.userData.глубина : false;
        if (выбран === ключ) {
          m.emissive.set(m.map ? '#ffffff' : m.color);
          m.emissiveIntensity = m.map ? 0.12 : 0.28;
        } else {
          m.emissive.set('#000000');
        }
      }
    }
  }

  const луч = new THREE.Raycaster();
  const точкаЭкрана = new THREE.Vector2();
  /** Мембрана и цитоплазма закрывают собой всё: они уступают тому, что за ними. */
  const ПРОЗРАЧНЫЕ = { membrane: 1, cytoplasm: 1 };
  function виденЛи(o) {
    let у = o;
    while (у) {
      if (!у.visible) return false;
      у = у.parent;
    }
    return true;
  }
  function подКурсором(cx, cy) {
    const r = canvas.getBoundingClientRect();
    точкаЭкрана.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    луч.setFromCamera(точкаЭкрана, camera);
    const попадания = луч.intersectObjects(выбираемые.filter((m) => m.visible && виденЛи(m)), false);
    if (!попадания.length) return null;
    const годное = попадания.find((h) => !ПРОЗРАЧНЫЕ[h.object.userData.ключ]);
    return (годное || попадания[0]).object.userData.ключ;
  }

  let разрез = true;
  let кадр = null;
  let наВыбор = () => {};

  function шаг(t) {
    controls.update();
    if (бегунок.visible) {
      const u = ((t || 0) % 5000) / 5000;
      бегунок.position.copy(путь.getPoint(u));
      бегунок.scale.setScalar(u < 0.15 ? 0.3 + (u / 0.15) * 0.7 : 1);
    }
    renderer.render(scene, camera);
    кадр = requestAnimationFrame(шаг);
  }
  кадр = requestAnimationFrame(шаг);

  return {
    ОРГАНОИДЫ,
    выбрать(ключ) {
      выбран = ключ ?? null;
      применитьВыбор();
      наВыбор(выбран);
    },
    выбранный: () => выбран,
    приВыборе(fn) { наВыбор = fn; },
    подКурсором,
    разрезВключён: () => разрез,
    переключитьРазрез() {
      разрез = !разрез;
      мембранаСнаружи.visible = разрез;
      мембранаВнутри.visible = разрез;
      цитоплазма.visible = разрез;
      мембранаЦеликом.visible = !разрез;
      return разрез;
    },
    автоповоротВключён: () => controls.autoRotate,
    переключитьАвтоповорот() {
      controls.autoRotate = !controls.autoRotate;
      return controls.autoRotate;
    },
    остановитьАвтоповорот() {
      if (!controls.autoRotate) return false;
      controls.autoRotate = false;
      return true;
    },
    /*
      Возврат — средствами самих OrbitControls. Своя расстановка камеры тут не
      работает: при включённом сглаживании `update()` пересчитывает положение
      из своего внутреннего состояния и затирает присвоенное руками — кнопка
      «Вид сначала» возвращала почти туда, но не туда.
    */
    сброс() {
      controls.reset();
    },
    подогнать(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < 520 ? 48 : 38;
      camera.updateProjectionMatrix();
    },
    /**
     * Куда поставить подпись органоида: точка якоря, спроецированная на экран.
     *
     * Матрицы обновляются здесь же, а не берутся готовыми от отрисовки:
     * подписи живут в разметке страницы и считаются своим циклом, который
     * может успеть раньше первого кадра. Тогда камера ещё не обращена, и
     * проекция даёт бессмыслицу — подписи просто не появлялись.
     */
    местоПодписи(ключ, w, h) {
      const якорь = реестр[ключ]?.якорь;
      if (!якорь) return null;
      camera.updateMatrixWorld();
      клетка.updateMatrixWorld();
      const v = якорь.clone().applyMatrix4(клетка.matrixWorld).project(camera);
      if (v.z > 1) return null;
      // `z` — глубина от 0 до 1: по ней страница решает, какая подпись важнее,
      // когда две налезают друг на друга. Ближняя к зрителю важнее.
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, z: v.z };
    },
    остановить() {
      if (кадр !== null) cancelAnimationFrame(кадр);
      кадр = null;
      controls.dispose();
      renderer.dispose();
    },
  };
}
