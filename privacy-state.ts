export interface BlurState<TLevel> {
    blurEnabled: boolean;
    level: TLevel;
}

export type PrivacyKind = "public" | "private" | "private-always";

function matchesTag(tag: string, rootTag: string): boolean {
    const normalizedTag = tag.replace(/^#/, "").toLowerCase();
    return normalizedTag === rootTag || normalizedTag.startsWith(`${rootTag}/`);
}

export function classifyPrivacyTags(tags: readonly string[]): PrivacyKind {
    if (tags.some((tag) => matchesTag(tag, "private-always"))) {
        return "private-always";
    }
    if (tags.some((tag) => matchesTag(tag, "private"))) {
        return "private";
    }
    return "public";
}

interface LocalBlurState<TLevel> extends BlurState<TLevel> {
    filePath: string;
}

export type BlurTarget<TLeaf extends object> =
    | {kind: "global"}
    | {kind: "private-always"; leaf: TLeaf; filePath: string};

export class BlurStateController<TLeaf extends object, TLevel> {
    private readonly globalState: BlurState<TLevel>;
    private readonly defaultLocalLevel: TLevel;
    private readonly nextLevel: (currentLevel: TLevel) => TLevel;
    private readonly leafStates = new WeakMap<TLeaf, LocalBlurState<TLevel>>();

    constructor(
        globalState: BlurState<TLevel>,
        defaultLocalLevel: TLevel,
        nextLevel: (currentLevel: TLevel) => TLevel,
    ) {
        this.globalState = globalState;
        this.defaultLocalLevel = defaultLocalLevel;
        this.nextLevel = nextLevel;
    }

    getState(target: BlurTarget<TLeaf>): Readonly<BlurState<TLevel>> {
        return this.toPublicState(this.getMutableState(target));
    }

    toggleBlur(target: BlurTarget<TLeaf>): void {
        const state = this.getMutableState(target);
        state.blurEnabled = !state.blurEnabled;
    }

    setLevel(target: BlurTarget<TLeaf>, level: TLevel): void {
        this.getMutableState(target).level = level;
    }

    cycleLevel(target: BlurTarget<TLeaf>): void {
        const state = this.getMutableState(target);
        state.level = this.nextLevel(state.level);
    }

    resetLeaf(leaf: TLeaf): void {
        this.leafStates.delete(leaf);
    }

    private getMutableState(target: BlurTarget<TLeaf>): BlurState<TLevel> {
        if (target.kind === "global") {
            return this.globalState;
        }

        const existingState = this.leafStates.get(target.leaf);
        if (existingState?.filePath === target.filePath) {
            return existingState;
        }

        const state: LocalBlurState<TLevel> = {
            filePath: target.filePath,
            blurEnabled: true,
            level: this.defaultLocalLevel,
        };
        this.leafStates.set(target.leaf, state);
        return state;
    }

    private toPublicState(state: BlurState<TLevel>): BlurState<TLevel> {
        return {
            blurEnabled: state.blurEnabled,
            level: state.level,
        };
    }
}
