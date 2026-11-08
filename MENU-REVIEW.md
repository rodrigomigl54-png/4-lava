# MENU-REVIEW — провера јеловника

**Статус: ИЗВЛАЧЕЊЕ ЗАУСТАВЉЕНО — фотографије су премале.**

Свих 9 фотографија јеловника (`raw/menu/page-01.jpg … page-09.jpg`, са Google мапа) има само **112×112 px**.
Обрађене су скриптом `scripts/enhance-menu.py` (увећање ×6 Lanczos, уклањање шума, CLAHE, изоштравање, adaptive threshold → `raw/menu/enhanced/`),
и прегледане ручно и OCR-ом (tesseract `srp_latn`). OCR не даје ништа употребљиво; ручно се могу прочитати само наслови страна
и делимично страна са десертима (page-09). Цене и називи на осталим странама **нису читљиви** — по упутству, ништа није измишљено.

➡ **Потребне су веће фотографије** (оригинали са телефона или „Download“ из Google мапа у пуној величини, бар ~1000 px по краћој ивици, свака страна посебно, што равније).

## Шта се види на фотографијама

| Фајл | Страна (наслов — приближно, са сличице) | Читљиво |
|---|---|---|
| page-01.jpg | Karta pića | само наслов |
| page-02.jpg | Specijaliteti kuće | наслов; ставке и цене нечитљиве |
| page-03.jpg | Roštilj | само наслов |
| page-04.jpg | Kuvana jela / Jela po porudžbini | наслови; ставке нечитљиве |
| page-05.jpg | Obrok salate | само наслов |
| page-06.jpg | Paste | само наслов |
| page-07.jpg | Karta pića (2. страна) | само наслов |
| page-08.jpg | Doručak (+ друга страна) | само наслов |
| page-09.jpg | Desserti (крупан план) | делимично — види доле |

## Тренутни садржај menu.json (seed + десерти)

| Категорија | Назив | Цена | verify | Извор | Напомена |
|---|---|---|---|---|---|
| Доручак | Карловачки доручак | — | true | seed (бриф) |  |
| Доручак | Гибаница са киселим млеком | — | true | seed (бриф) |  |
| Доручак | Уштипци | — | true | seed (бриф) |  |
| Чорбе | Рибља чорба | — | true | seed (бриф) |  |
| Кувана јела | Јунећи гулаш | — | true | seed (бриф) |  |
| Кувана јела | Овчији гулаш | — | true | seed (бриф) |  |
| Јела по поруџбини | Телетина испод сача | — | true | seed (бриф) | preorderHours (24 h) is an assumption – TODO_VERIFY with the owner. |
| Јела по поруџбини | Јагњетина испод сача | — | true | seed (бриф) | preorderHours (24 h) is an assumption – TODO_VERIFY with the owner. |
| Јела по поруџбини | Печење | — | true | seed (бриф) | Type of roast and preorderHours TODO_VERIFY. |
| Јела по поруџбини | Дивљач | — | true | seed (бриф) | Which game dish and preorderHours TODO_VERIFY. |
| Специјалитети куће | Коленица у сосу од рена | — | true | seed (бриф) |  |
| Роштиљ | Wine country burger | — | true | seed (бриф) | Category (grill vs. specialities) TODO_VERIFY. |
| Риба | Шаран | — | true | seed (бриф) |  |
| Пасте | Таљателе са пилетином и пармезаном | — | true | seed (бриф) |  |
| Оброк салате и прилози | Ајвар | — | true | seed (бриф) |  |
| Десерти | Чоколадна торта са бадемима и малинама | 420 | true | page-09.jpg | Price read from a 112 px photo (page-09) – verify. |
| Десерти | Шненокле | 360 | true | page-09.jpg | Price read from a 112 px photo (page-09) – verify; printed name may include extra words. |
| Десерти | Палачинке | 290 / 380 | true | page-09.jpg | Two prices 290 / 380 – meaning (size/filling) unreadable, verify. |
| Десерти | Катина штрудла с маком | 310 | true | page-09.jpg | Price read from a 112 px photo (page-09) – verify. |
| Десерти | Катин куглоф | 310 | true | page-09.jpg | Price read from a 112 px photo (page-09) – verify. |
| Карта пића | Турска кафа | — | true | seed (бриф) |  |
| Карта пића | Еспресо | — | true | seed (бриф) |  |
| Карта пића | Бермет | — | true | seed (бриф) |  |

## Нечитљиве / несигурне линије (нису унете у menu.json)

- page-09: прва ставка (вероватно „…kolač sa … i preljevom od višnje“) — назив и цена одсечени.
- page-09: „Kremšnit“ (?) — цена изгледа као 330, **несигурно**.
- page-09: испод „Šnenokle“ стоји додатак („po porudžbini“?) — нечитљиво.
- page-09: испод „Palačinke“ опис пуњења — нечитљиво; значење две цене (290 / 380) непознато.
- page-09: испод „Katin kuglof“ кратак опис — нечитљиво.
- Све остале стране: ставке и цене нечитљиве.

## Изабрана подешавања (origin / tags / featured / preorder)

- `featured: true` (Специјалитети куће): Карловачки доручак, Гибаница, Уштипци, Јунећи и Овчији гулаш, Коленица у сосу од рена, Телетина и Јагњетина испод сача — по брифу.
- `preorder: true` (Испод сача / Јела по поруџбини): Телетина и Јагњетина испод сача, Печење, Дивљач — `preorderHours: 24` је **претпоставка** (TODO_VERIFY).
- `origin: vienna`: Јунећи гулаш, Коленица у сосу од рена, Еспресо и сви десерти (шненокле, палачинке, штрудла, куглоф, торта — бечка посластичарска традиција).
- `origin: istanbul`: Ајвар, Турска кафа. Остало: `home`.
- `fasting`: Рибља чорба, Шаран, Ајвар.
- Wine country burger је привремено у „Роштиљ“ — потврдити категорију.
