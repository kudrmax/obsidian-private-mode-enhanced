# CLAUDE.md — obsidian-private-mode-enhanced

Форк плагина Obsidian **Private Mode** (`markusmo3/obsidian-private-mode`), доработанный под себя.
Ставится в Obsidian через **BRAT** (beta-плагин), обновляется тоже через BRAT.

- **origin** (мой форк): `https://github.com/kudrmax/obsidian-private-mode-enhanced`
- **upstream** (оригинал): `https://github.com/markusmo3/obsidian-private-mode`
- Рабочая ветка: `master`
- id плагина: `private-mode-enhanced`

## Что делает плагин

Размывает (`filter: blur()`) весь `#private`-контент. Приватной считается заметка, у которой
среди тегов (frontmatter или inline) есть `#private` (или вложенный `#private/...`).
Приватность определяет **`main.ts`**: он читает теги через Obsidian API `getAllTags` и вешает
класс `private-mode-private-note` на **каждый приватный `.workspace-leaf`** (один лист = одна
заметка). CSS блюрит по этому классу (`.workspace-leaf.private-mode-private-note …`).

Гейт **per-leaf**, а не per-tab-group и не зависит от активной вкладки — поэтому корректно
работает в режиме наложенных вкладок (stacked tabs): каждый лист блюрится по своей приватности.
Раньше гейтом был `:has([data-link-tags*='#private'])` от стороннего плагина Supercharged Links,
но тот атрибут живёт только на **активной** вкладке — из-за чего в stacked блюрилась/раскрывалась
вся группа разом (это и был баг). Зависимость от Supercharged Links в детекте приватности убрана.

Отдельная фича «Blur Links too» (блюр **ссылок** на приватные заметки в сайдбарах: файловое
дерево, поиск, dataview) по-прежнему использует `[data-link-tags*='#private']` от Supercharged
Links — это другой механизм (`.private-mode-blur-links-too …` в `styles.scss`), к stacked-багу
отношения не имеет.

Уровни приватности (`enum Level` в `main.ts`). Команды и меню статус-бара названы по
схеме **«Blur level N»**, где N — сила блюра (1 слабее всего → 4 сильнее всего):

| Команда (name) | `enum Level` | Что видно |
|---|---|---|
| `Blur level 1 · show all` | `RevealAll` | всё видно (приватность выкл) |
| `Blur level 2 · show one line` | `HidePrivate` | в live preview видна **вся текущая строка** (активная `.cm-active` не блюрится); в reading view скрыто всё |
| `Blur level 3 · show N words` | `HardWords` | скрыто; на активной строке видно **последние N слов**, заканчивая словом у каретки — но только пока каретка **на слове** (внутри/на границе); за разделителем (пробел или знак препинания) строка размыта целиком (N — в настройках, дефолт 1 → одно слово) |
| `Blur level 4 · show one character` | `HardChar` | скрыто; на активной строке видно **только символ** слева от каретки |
| `Blur level · show on hover` | `RevealOnHover` | скрыто, раскрывается по наведению/выделению — **вне цикла** |
| `Blur on/off` | — | тумблер `blurEnabled`: временно показать всё, не теряя текущий уровень |

`Cycle blur level` перебирает **только 4 основных уровня** по кругу:
`RevealAll(1) → HidePrivate(2) → HardWords(3) → HardChar(4) → RevealAll`. `RevealOnHover`
в цикл не входит (заходя в цикл из него, попадаешь на level 1).

`N` для `HardWords` задаётся на вкладке настроек (`PrivateModeSettingTab`, `main.ts`),
хранится в `settings.hardWordsCount` (персист, дефолт 1). При `N=1` видно ровно одно
слово у каретки. Отдельного `HardWord`-режима больше нет — он слит в `HardWords` (N=1).
`words` режет строку на токены-слова по `/[\p{L}\p{N}_]+/gu` (буквы/цифры/`_`, юникод — ловит
кириллицу); пробелы **и любые знаки препинания** — разделители. Поэтому `foo.bar` — два слова:
при `N=1` у каретки `foo.‹каретка›bar` видно только `bar`. Слово раскрывается лишь пока каретка
примыкает к нему; на разделителе (`слово,‹каретка›`) строка размыта целиком.

## Архитектура

- **`styles.scss`** — базовый механизм. `#private`-элементы блюрятся; `$reveal-templates`
  снимают блюр под конкретные body-классы. Активная строка `.cm-active` разблюрена всегда
  (`"" ".cm-active"`) — это и есть «дыра», которую закрывают жёсткие режимы.
- **`cursor-reveal.ts`** — CM6 `ViewPlugin` для жёстких режимов. Размечает куски активной
  строки классом `private-mode-cursor-blur` (всё, кроме слова/буквы у каретки).
- **`main.ts`** — уровни, команды, body-классы, статус-бар, регистрация расширения.

### Два неочевидных решения (не сломать при рефакторинге)

1. **`filter: blur()` на родителе нельзя отменить у ребёнка.** Поэтому «показать слово, размыть
   остальную строку» реализовано инверсией: контейнер `.cm-active` НЕ блюрится, а blur вешается
   на span-куски *вокруг* слова/буквы. Размывать контейнер строки и «прорезать» дырку — нельзя.
2. **Приватность определяет `main.ts` (по тегам), а разметку — CSS по классу.** `main.ts`
   в `updatePrivateLeaves()` читает теги заметки (`getAllTags`) и вешает класс
   `private-mode-private-note` на её `.workspace-leaf`. `cursor-reveal.ts` про приватность
   по-прежнему НЕ знает — размечает куски строки всегда; блюрить их решает CSS по тому же
   классу. **Почему не CSS-`:has`:** единственный DOM-сигнал приватности (`data-link-tags`)
   даёт Supercharged Links и только на активной вкладке — в stacked tabs этого не хватает
   (см. «Что делает плагин»). Поэтому детект вынесен в JS через `metadataCache`. Класс
   обновляется по событиям `active-leaf-change` / `layout-change` / `metadataCache.changed|resolved`.
3. **`ViewPlugin` не видит смену body-класса** (реагирует только на CM-транзакции). После смены
   уровня `updateGlobalRevealStyle()` вызывает `refreshCursorRevealDecorations()` — пустой
   `dispatch({})` во все markdown-редакторы форсит пересбор декораций.

### Подводные грабли

- `enum CssClass` — строковый; **computed-значения запрещены** (нельзя `= SOME_CONST`). Только
  строковые литералы. Значения `HardChar`/`HardWords` должны совпадать с константами в `cursor-reveal.ts`.
- **`N` для `HardWords` передаётся в `cursor-reveal.ts` через `document.body.dataset.privateModeWordsCount`**
  (ключ `WORDS_COUNT_ATTR`), а НЕ импортом настроек — расширение остаётся независимым от `main.ts`,
  как и режимы через body-классы. `main.ts` выставляет атрибут в `setClassToDocumentBody()`.
- Жёсткие режимы работают только в редакторе (в reading view нет каретки → ведут себя как `HidePrivate`).
- `currentLevel` **персистится**: `updateGlobalRevealStyle()` → `saveSettings()`, а `onload`
  мержит `loadData()` поверх `DEFAULT_SETTINGS`. Дефолт при первом запуске — `HidePrivate`
  (level 2). (Прежняя заметка «не персистится» была ошибочной.)

## Сборка

```bash
npm install          # один раз
npm run build        # tsc -noEmit + esbuild (production) + sass styles.scss styles.css
```

`main.js` и `styles.css` — артефакты сборки, в git **не коммитятся** (см. `.gitignore`),
только прикладываются к GitHub-релизу.

### Локальный тест без релиза

```bash
DST=~/Obsidian/.obsidian/plugins/private-mode-enhanced
cp main.js styles.css manifest.json "$DST/"
obsidian plugin:disable id=private-mode-enhanced
obsidian plugin:enable  id=private-mode-enhanced   # перечитать плагин
obsidian dev:errors                                # проверить консоль
```

## Релиз (воспроизводимый, через GitHub Actions)

Релиз собирает CI (`.github/workflows/release.yml`) при **push тега**. Руками zip не собирать.

1. Поднять версию в трёх местах на одно значение (semver: фича → minor, фикс → patch):
   `manifest.json`, `package.json`, и новая запись в `versions.json` (`"X.Y.Z": "<minAppVersion>"`).
2. Закоммитить, создать и запушить тег с точным именем версии:
   ```bash
   git commit -am "feat: <описание>"
   git tag X.Y.Z          # имя тега = версии, без префикса v
   git push origin master --tags
   ```
3. Workflow соберёт плагин и опубликует релиз с `main.js` / `manifest.json` / `styles.css`.
4. Проверить, что CI **на форке** прошёл и релиз создан (см. ловушку ниже), затем
   в Obsidian обновить через BRAT → «Check for updates».

### Проблемы решаем в корень, не обходим

**Во время релиза (и вообще) нельзя «обходить» сбой — надо найти и устранить причину.**
Если CI будто не стартовал / релиза нет — это повод диагностировать, а НЕ собирать
релиз руками локально (`gh release create`, ручной zip и т.п.). Ручная сборка — обход,
который маскирует настоящую проблему и даёт неповторяемый артефакт.

**Ловушка №1 — `gh` смотрит на upstream, а не на форк.** В репо два remote
(`origin` = форк `kudrmax/...`, `upstream` = `markusmo3/obsidian-private-mode`). Если
`gh` default repo стоит на upstream, то `gh run list` / `gh release list` показывают CI
и релизы **апстрима**, а не форка — легко сделать ложный вывод «CI не запускался».
Проверить и починить:
```bash
gh repo set-default --view                              # должно быть kudrmax/obsidian-private-mode-enhanced
gh repo set-default kudrmax/obsidian-private-mode-enhanced
gh run list --limit 5                                    # теперь прогоны ФОРКА
gh release view <версия> --json tagName,assets           # подтвердить ассеты
```

**Ловушка №2 — реальная заморозка Actions.** Только если после починки default repo
прогонов форка действительно нет: GitHub может замораживать Actions на форке, пока их
вручную не включат в UI (Settings → Actions), и требовать write-права workflow.

Тег должен быть уникальным (унаследованные от upstream теги уже заняты).
