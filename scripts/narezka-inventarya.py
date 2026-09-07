# -*- coding: utf-8 -*-
"""
Нарезает значки инвентаря из уже нарисованных схем.

Рисовать приборы заново незачем: они уже есть в схемах уроков, взяты из
открытых наборов и сведены к трём ступеням светлоты (см. `.d-eq-*` и
`.d-mic-*` в base.css). Нарезка сохраняет и вид, и лицензию: это те же самые
пути, только каждый в своём файле и со своим тесным viewBox.

Границы прямоугольников замерены в браузере через getBBox + getCTM: в самом
файле у групп стоят transform, и координаты путей о конечном размере ничего
не говорят.
"""
import io
import os
import re

ВЫХОД = 'img/bio'

# Пятёрка приборов из «Что стоит на столе в кабинете». Индексы — номера
# прямых детей svg, границы — в единицах viewBox исходника.
СТОЛ = [
    ('inv-probirka.svg', 1, (23.48, 26.08, 6.92, 45.76), 'Пробирка'),
    ('inv-menzurka.svg', 5, (20.48, 82.08, 12.88, 45.80), 'Мензурка'),
    ('inv-chashka-petri.svg', 9, (8.12, 140.92, 37.56, 40.04), 'Чашка Петри'),
    ('inv-vesy.svg', 13, (8.56, 194.12, 37.52, 45.56), 'Весы'),
    ('inv-termometr.svg', 17, (20.60, 255.04, 12.72, 37.20), 'Термометр'),
]

ШАПКА = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<!--\n'
    '  {название} — значок инвентаря для сбора стола в лабораторной работе.\n'
    '  Нарезан из «{источник}» скриптом scripts/narezka не глядя на цвет:\n'
    '  цвета приходят из темы через классы {классы}.\n'
    '-->\n'
)


def дети(body):
    """Прямые дети корня: (тег, начало, конец)."""
    глубина = 0
    kids = []
    i = 0
    while i < len(body):
        if body[i] == '<' and i + 1 < len(body) and body[i + 1] not in '/!?':
            конец = body.index('>', i)
            сам = body[конец - 1] == '/'
            if глубина == 0:
                kids.append([re.match(r'<([a-zA-Z]+)', body[i:]).group(1), i, None])
            if not сам:
                глубина += 1
            elif глубина == 0:
                kids[-1][2] = конец + 1
            i = конец + 1
            continue
        if body[i:i + 2] == '</':
            конец = body.index('>', i)
            глубина -= 1
            if глубина == 0 and kids:
                kids[-1][2] = конец + 1
            i = конец + 1
            continue
        i += 1
    return kids


def тело(путь):
    s = io.open(путь, encoding='utf-8').read()
    начало = s.index('>', s.index('<svg')) + 1
    return s, s[начало:s.rindex('</svg>')]


def записать(имя, содержимое, рамка, название, источник, классы, поля=2.0):
    x, y, w, h = рамка
    x -= поля
    y -= поля
    w += поля * 2
    h += поля * 2
    шапка = ШАПКА.format(название=название, источник=источник, классы=классы)
    svg = (
        f'{шапка}<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{x:.2f} {y:.2f} {w:.2f} {h:.2f}" '
        f'role="img" aria-label="{название}">\n'
        f'{содержимое.strip()}\n</svg>\n'
    )
    io.open(os.path.join(ВЫХОД, имя), 'w', encoding='utf-8', newline='\n').write(svg)
    print(f'  {имя}  viewBox="{x:.2f} {y:.2f} {w:.2f} {h:.2f}"')


print('из laboratornoe-oborudovanie.svg:')
_, body = тело(os.path.join(ВЫХОД, 'laboratornoe-oborudovanie.svg'))
kids = дети(body)
for имя, индекс, рамка, название in СТОЛ:
    тег, a, b = kids[индекс]
    assert тег == 'g', f'{имя}: ожидалась группа, а это {тег}'
    записать(имя, body[a:b], рамка, название,
             'laboratornoe-oborudovanie.svg', 'd-eq-*')

print('из put-vody-v-rastenii.svg:')
_, body = тело(os.path.join(ВЫХОД, 'put-vody-v-rastenii.svg'))
kids = дети(body)
# Одно стекло даёт пустую трапецию, по которой стакан не узнать: воду
# приходится брать вместе с ним.
куски = []
for тег, a, b in kids:
    голова = body[a:body.index('>', a) + 1]
    if 'class="d-glass"' in голова or 'class="d-water"' in голова:
        куски.append(body[a:b])
assert len(куски) == 2, f'ожидались стекло и вода, найдено {len(куски)}'
записать('inv-stakan.svg', '\n'.join(куски), (100, 166, 96, 76), 'Стакан',
         'put-vody-v-rastenii.svg', 'd-glass и d-water')

print('из mikroskop-chasti.svg:')
s, body = тело(os.path.join(ВЫХОД, 'mikroskop-chasti.svg'))
kids = дети(body)
куски = []
for тег, a, b in kids:
    frag = body[a:b]
    голова = frag[:frag.index('>') + 1]
    # Луч света и выносные линии к подписям — часть схемы, а не прибора.
    if 'd-mic-beam' in голова or 'd-mic-none' in голова:
        continue
    куски.append(frag)
записать('inv-mikroskop.svg', '\n'.join(куски), (10, 47, 482, 750), 'Микроскоп',
         'mikroskop-chasti.svg', 'd-mic-*', поля=12.0)
