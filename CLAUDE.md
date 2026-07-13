# CLAUDE.md — obsidian-private-mode-enhanced

Форк плагина Obsidian **Private Mode** (`markusmo3/obsidian-private-mode`), доработанный под себя.
Ставится в Obsidian через **BRAT** (beta-плагин), обновляется тоже через BRAT.

- **origin** (мой форк): `https://github.com/kudrmax/obsidian-private-mode-enhanced`
- **upstream** (оригинал): `https://github.com/markusmo3/obsidian-private-mode`
- Рабочая ветка: `master`
- id плагина: `private-mode-enhanced`

## Что делает плагин

Размывает (`filter: blur()`) весь `#private`-контент. Приватной считается заметка, где
где-либо есть тег/ссылка `#private` — CSS-гейт `:has(.is-active [data-link-tags*='#private'])`.

Уровни приватности (`enum Level` в `main.ts`). Команды и меню статус-бара названы по
схеме **«Blur level N»**, где N — сила блюра (1 слабее всего → 4 сильнее всего):

| Команда (name) | `enum Level` | Что видно |
|---|---|---|
| `Blur level 1 · show all` | `RevealAll` | всё видно (приватность выкл) |
| `Blur level 2 · show one line` | `HidePrivate` | в live preview видна **вся текущая строка** (активная `.cm-active` не блюрится); в reading view скрыто всё |
| `Blur level 3 · show N words` | `HardWords` | скрыто; на активной строке видно **последние N слов**, заканчивая словом у каретки (N — в настройках, дефолт 1 → одно слово) |
| `Blur level 4 · show one character` | `HardChar` | скрыто; на активной строке видно **только символ** слева от каретки |
| `Blur level · show on hover` | `RevealOnHover` | скрыто, раскрывается по наведению/выделению — **вне цикла** |
| `Blur on/off` | — | тумблер `blurEnabled`: временно показать всё, не теряя текущий уровень |

`Cycle blur level` перебирает **только 4 основных уровня** по кругу:
`RevealAll(1) → HidePrivate(2) → HardWords(3) → HardChar(4) → RevealAll`. `RevealOnHover`
в цикл не входит (заходя в цикл из него, попадаешь на level 1).

`N` для `HardWords` задаётся на вкладке настроек (`PrivateModeSettingTab`, `main.ts`),
хранится в `settings.hardWordsCount` (персист, дефолт 1). При `N=1` виден ровно один
слово у каретки. Отдельного `HardWord`-режима больше нет — он слит в `HardWords` (N=1).
`words` режет строку по пробелам (`\S+`), поэтому `foo.bar` при N=1 остаётся чётким целиком.

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
2. **Приватность определяет CSS, а не JS.** `cursor-reveal.ts` не проверяет, приватна ли заметка —
   размечает куски всегда. Блюрить их или нет решает тот же `:has([data-link-tags*='#private'])`
   в `styles.scss`. Не тащить сюда `metadataCache`/`TFile` — сломает консистентность.
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
4. В Obsidian обновить через BRAT → «Check for updates».

> На форке GitHub может замораживать Actions, пока их вручную не включат в UI репо
> (Settings → Actions), и требовать write-права workflow. Если CI не стартовал на push тега —
> проверить это. Тег должен быть уникальным (унаследованные от upstream теги уже заняты).
