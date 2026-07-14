/*
 * Private Mode plugin for Obsidian — hard blur cursor-reveal extension
 * Licensed under the MIT License (http://opensource.org/licenses/MIT)
 *
 * В "жёстких" режимах (char / words) активная строка приватной заметки
 * остаётся размытой целиком, кроме последней буквы или N слов у каретки
 * (N — из настроек, дефолт 1 → одно слово). Слово раскрывается только пока
 * каретка стоит НА слове (внутри/на границе); пробелы и знаки препинания
 * разделяют слова, поэтому за разделителем строка размыта целиком.
 *
 * Расширение НЕ знает, приватна ли заметка: оно лишь размечает куски
 * активной строки классом `private-mode-cursor-blur`. Решение "блюрить или
 * нет" принимает CSS по тому же per-leaf классу `.private-mode-private-note`,
 * который `main.ts` вешает на приватные листья. Так сохраняется полная консистентность.
 */

import {RangeSetBuilder} from "@codemirror/state";
import {Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate,} from "@codemirror/view";

export const CURSOR_BLUR_CLASS = "private-mode-cursor-blur";
export const HARD_CHAR_BODY_CLASS = "private-mode-hard-char";
export const HARD_WORDS_BODY_CLASS = "private-mode-hard-words";
// ключ в document.body.dataset — сколько слов у каретки оставлять чёткими (режим words)
export const WORDS_COUNT_ATTR = "privateModeWordsCount";

type HardMode = "char" | "words" | null;

function currentHardMode(): HardMode {
    if (document.body.classList.contains(HARD_CHAR_BODY_CLASS)) return "char";
    if (document.body.classList.contains(HARD_WORDS_BODY_CLASS)) return "words";
    return null;
}

function buildDecorations(view: EditorView): DecorationSet {
    const mode = currentHardMode();
    if (!mode) return Decoration.none;

    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);

    // диапазон, который остаётся ЧЁТКИМ (не размывается)
    let revealFrom = pos;
    let revealTo = pos;

    if (mode === "char") {
        // char: только символ слева от каретки
        revealFrom = Math.max(line.from, pos - 1);
        revealTo = pos;
    } else {
        // words: N слов, заканчивая словом у каретки
        let n = parseInt(document.body.dataset[WORDS_COUNT_ATTR] ?? "");
        if (isNaN(n) || n < 1) n = 1;

        // токены строки в АБСОЛЮТНЫХ координатах документа.
        // Слово = буквы/цифры/подчёркивание (юникод — ловит кириллицу);
        // пробелы И любые знаки препинания считаются разделителями.
        const tokens: { from: number; to: number }[] = [];
        const re = /[\p{L}\p{N}_]+/gu;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line.text)) !== null) {
            tokens.push({from: line.from + m.index, to: line.from + m.index + m[0].length});
        }

        // anchor: слово, к которому примыкает каретка (внутри или ровно на границе).
        // Если каретка на разделителе (пробел / знак препинания / пустая строка) — anchor нет.
        const anchorIdx = tokens.findIndex((t) => t.from <= pos && pos <= t.to);

        if (anchorIdx === -1) {
            // каретка не на слове → вся строка размыта
            revealFrom = line.from;
            revealTo = line.from;
        } else {
            const anchor = tokens[anchorIdx];
            revealTo = anchor.to;                                  // anchor всегда содержит pos
            revealFrom = tokens[Math.max(0, anchorIdx - (n - 1))].from;
        }
    }

    const builder = new RangeSetBuilder<Decoration>();
    const blur = Decoration.mark({class: CURSOR_BLUR_CLASS});
    // размываем куски активной строки ДО и ПОСЛЕ чёткого диапазона
    if (revealFrom > line.from) {
        builder.add(line.from, revealFrom, blur);
    }
    if (revealTo < line.to) {
        builder.add(revealTo, line.to, blur);
    }
    return builder.finish();
}

export const cursorRevealExtension = ViewPlugin.fromClass(
    class {
        deco: DecorationSet;

        constructor(view: EditorView) {
            this.deco = buildDecorations(view);
        }

        // Пересобираем на любой ViewUpdate: buildDecorations дёшев (одна строка),
        // а это гарантирует реакцию и на смену режима через пустой dispatch.
        update(update: ViewUpdate) {
            this.deco = buildDecorations(update.view);
        }
    },
    {
        decorations: (v) => v.deco,
    }
);
