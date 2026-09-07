export const PRIVATE_LEAF_CLASS = "private-mode-private-note";
export const PRIVATE_ALWAYS_LEAF_CLASS = "private-mode-private-always-note";
export const PRIVATE_ALWAYS_REVEAL_ALL_CLASS = "private-mode-always-reveal-all";
export const PRIVATE_ALWAYS_REVEAL_ON_HOVER_CLASS = "private-mode-always-reveal-on-hover";
export const PRIVATE_ALWAYS_HARD_CHAR_CLASS = "private-mode-always-hard-char";
export const PRIVATE_ALWAYS_HARD_WORDS_CLASS = "private-mode-always-hard-words";
export const GLOBAL_HARD_CHAR_CLASS = "private-mode-hard-char";
export const GLOBAL_HARD_WORDS_CLASS = "private-mode-hard-words";

export type HardMode = "char" | "words" | null;

interface ClassList {
    contains(className: string): boolean;
}

interface PrivateAlwaysModeState {
    blurEnabled: boolean;
    level: string;
}

export function privateAlwaysClassForState(state: PrivateAlwaysModeState): string | null {
    if (!state.blurEnabled || state.level === "reveal-all") {
        return PRIVATE_ALWAYS_REVEAL_ALL_CLASS;
    }
    if (state.level === "reveal-on-hover") {
        return PRIVATE_ALWAYS_REVEAL_ON_HOVER_CLASS;
    }
    if (state.level === "hard-char") {
        return PRIVATE_ALWAYS_HARD_CHAR_CLASS;
    }
    if (state.level === "hard-words") {
        return PRIVATE_ALWAYS_HARD_WORDS_CLASS;
    }
    return null;
}

export function resolveHardMode(bodyClasses: ClassList, leafClasses: ClassList | null): HardMode {
    if (leafClasses?.contains(PRIVATE_ALWAYS_LEAF_CLASS)) {
        if (leafClasses.contains(PRIVATE_ALWAYS_HARD_CHAR_CLASS)) return "char";
        if (leafClasses.contains(PRIVATE_ALWAYS_HARD_WORDS_CLASS)) return "words";
        return null;
    }
    if (bodyClasses.contains(GLOBAL_HARD_CHAR_CLASS)) return "char";
    if (bodyClasses.contains(GLOBAL_HARD_WORDS_CLASS)) return "words";
    return null;
}
