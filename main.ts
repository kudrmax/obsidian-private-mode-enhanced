/*
 * Private Mode plugin for Obsidian
 * Copyright 2025 Markus Moser
 * Licensed under the MIT License (http://opensource.org/licenses/MIT)
 */

import {
    addIcon,
    App,
    getAllTags,
    MarkdownView,
    Menu,
    Platform,
    Plugin,
    PluginSettingTab,
    Setting,
    setIcon,
    TFile,
    WorkspaceLeaf,
} from "obsidian";
import {cursorRevealExtension, WORDS_COUNT_ATTR} from "./cursor-reveal";
import {
    PRIVATE_ALWAYS_HARD_CHAR_CLASS,
    PRIVATE_ALWAYS_HARD_WORDS_CLASS,
    PRIVATE_ALWAYS_LEAF_CLASS,
    PRIVATE_ALWAYS_REVEAL_ALL_CLASS,
    PRIVATE_ALWAYS_REVEAL_ON_HOVER_CLASS,
    PRIVATE_LEAF_CLASS,
    privateAlwaysClassForState,
} from "./cursor-mode";
import {
    BlurState,
    BlurStateController,
    BlurTarget,
    classifyPrivacyTags,
    PrivacyKind,
} from "./privacy-state";
import {SecondaryRenderProtection} from "./secondary-render-controller";

enum Level {
    HidePrivate = "hide-private",
    RevealOnHover = "reveal-on-hover",
    RevealAll = "reveal-all",
    HardChar = "hard-char",
    HardWords = "hard-words",
}

function nextLevel(level: Level): Level {
    switch (level) {
        case Level.RevealAll:
            return Level.HidePrivate;
        case Level.HidePrivate:
            return Level.HardWords;
        case Level.HardWords:
            return Level.HardChar;
        case Level.HardChar:
            return Level.RevealAll;
        default:
            return Level.RevealAll;
    }
}

enum CssClass {
    RevealAll = "private-mode-reveal-all",
    RevealOnHover = "private-mode-reveal-on-hover",
    UnprotectedScreenshare = "private-mode-unprotected-screenshare",
    BlurLinksToo = "private-mode-blur-links-too",
    // должны совпадать с константами в cursor-mode.ts
    HardChar = "private-mode-hard-char",
    HardWords = "private-mode-hard-words",
}

interface PrivateModePluginSettings {
    currentScreenshareProtection: boolean;
    blurLinksToo: boolean;
    currentLevel: Level;
    blurEnabled: boolean;
    hardWordsCount: number;
}

const DEFAULT_SETTINGS: PrivateModePluginSettings = {
    currentScreenshareProtection:  true,
    blurLinksToo: true,
    currentLevel: Level.HidePrivate,
    blurEnabled: true,
    hardWordsCount: 1,
};

export default class PrivateModePlugin extends Plugin {
    statusBar!: HTMLElement;
    statusBarSpan!: HTMLSpanElement;
    settings!: PrivateModePluginSettings;
    private blurStateController!: BlurStateController<WorkspaceLeaf, Level>;
    private secondaryRenderProtection!: SecondaryRenderProtection;

    async onload() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        const thisSettings = this.settings;
        const globalState: BlurState<Level> = {
            get blurEnabled() {
                return thisSettings.blurEnabled;
            },
            set blurEnabled(value: boolean) {
                thisSettings.blurEnabled = value;
            },
            get level() {
                return thisSettings.currentLevel;
            },
            set level(value: Level) {
                thisSettings.currentLevel = value;
            },
        };
        this.blurStateController = new BlurStateController(
            globalState,
            Level.HardChar,
            nextLevel,
        );
        this.statusBar = this.addStatusBarItem();
        this.statusBar.addClass("mod-clickable")
        this.statusBar.ariaLabel = "Toggle private mode"
        this.statusBar.setAttr("data-tooltip-position", "top")
        this.statusBar.onClickEvent((event) => {
            if (event.button != 0) {
                const currentState = this.getActiveBlurState();
                const menu = new Menu();
                menu.addItem((item) =>
                    item
                        .setTitle('Blur level 1 · show all')
                        .setIcon('ph--eye')
                        .setChecked(currentState.level == Level.RevealAll)
                        .onClick(() => this.setCurrentLevel(Level.RevealAll))
                );
                menu.addItem((item) =>
                    item
                        .setTitle('Blur level 2 · show one line')
                        .setIcon('ph--eye-closed')
                        .setChecked(currentState.level == Level.HidePrivate)
                        .onClick(() => this.setCurrentLevel(Level.HidePrivate))
                );
                menu.addItem((item) =>
                    item
                        .setTitle('Blur level 3 · show N words')
                        .setIcon('ph--eye-closed')
                        .setChecked(currentState.level == Level.HardWords)
                        .onClick(() => this.setCurrentLevel(Level.HardWords))
                );
                menu.addItem((item) =>
                    item
                        .setTitle('Blur level 4 · show one character')
                        .setIcon('ph--eye-closed')
                        .setChecked(currentState.level == Level.HardChar)
                        .onClick(() => this.setCurrentLevel(Level.HardChar))
                );
                menu.addItem((item) =>
                    item
                        .setTitle('Blur level · show on hover')
                        .setIcon('ph--eye-hand')
                        .setChecked(currentState.level == Level.RevealOnHover)
                        .onClick(() => this.setCurrentLevel(Level.RevealOnHover))
                );
                menu.addSeparator()
                menu.addItem((item) =>
                    item
                        .setTitle('Blur Links too')
                        .setIcon('ph--link')
                        .setChecked(this.settings.blurLinksToo)
                        .onClick(() => {
                            this.settings.blurLinksToo = !this.settings.blurLinksToo;
                            item.setChecked(this.settings.blurLinksToo)
                            this.updateGlobalRevealStyle();
                        })
                );
                menu.addItem((item) =>
                    item
                        .setTitle('Visibility when screensharing')
                        .setIcon('ph--screencast')
                        .setChecked(!this.settings.currentScreenshareProtection)
                        .onClick(() => {
                            this.settings.currentScreenshareProtection = !this.settings.currentScreenshareProtection;
                            item.setChecked(!this.settings.currentScreenshareProtection)
                            this.updateGlobalRevealStyle();
                        })
                );
                menu.showAtMouseEvent(event);
            } else {
                // left click
                if (event.altKey) {
                    this.settings.currentScreenshareProtection = !this.settings.currentScreenshareProtection;
                    this.updateGlobalRevealStyle();
                } else {
                    this.cycleCurrentLevel();
                }
            }
        });
        this.statusBarSpan = this.statusBar.createSpan( { text: "" });

        addIcon("ph--eye", eyeIcon);
        addIcon("ph--eye-hand", eyeHand);
        addIcon("ph--eye-closed", eyeClosedIcon);
        addIcon("ph--screencast", screencastIcon);
        addIcon("ph--link", linkIcon);

        this.addCommand({
            id: "toggle-blur",
            name: "Blur on/off",
            callback: () => this.toggleBlur(),
        });

        this.addCommand({
            id: "reveal-all",
            name: "Blur level 1 · show all",
            callback: () => this.setCurrentLevel(Level.RevealAll),
        });

        this.addCommand({
            id: "hide-private",
            name: "Blur level 2 · show one line",
            callback: () => this.setCurrentLevel(Level.HidePrivate),
        });

        this.addCommand({
            id: "hard-words",
            name: "Blur level 3 · show N words",
            callback: () => this.setCurrentLevel(Level.HardWords),
        });

        this.addCommand({
            id: "hard-char",
            name: "Blur level 4 · show one character",
            callback: () => this.setCurrentLevel(Level.HardChar),
        });

        this.addCommand({
            id: "reveal-on-hover",
            name: "Blur level · show on hover",
            callback: () => this.setCurrentLevel(Level.RevealOnHover),
        });

        this.addCommand({
            id: "cycle-mode",
            name: "Cycle blur level",
            callback: () => this.cycleCurrentLevel(),
        });

        this.addCommand({
            id: "toggle-screenshare-protection",
            name: "Toggle screenshare protection",
            callback: () => {
                this.settings.currentScreenshareProtection = !this.settings.currentScreenshareProtection
                this.updateGlobalRevealStyle();
            },
        })

        this.registerEditorExtension(cursorRevealExtension);
        this.addSettingTab(new PrivateModeSettingTab(this.app, this));
        this.secondaryRenderProtection = this.addChild(
            new SecondaryRenderProtection(this.app, (file) => this.getFilePrivacyKind(file)),
        );
        this.registerMarkdownPostProcessor((el, context) => {
            this.secondaryRenderProtection.protectMarkdownRender(el, context.sourcePath);
        });

        this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateWorkspaceRevealStyle()));
        this.registerEvent(this.app.workspace.on("file-open", () => this.updateWorkspaceRevealStyle()));
        this.registerEvent(this.app.workspace.on("layout-change", () => this.updateWorkspaceRevealStyle()));
        this.registerEvent(this.app.metadataCache.on("changed", () => this.updateWorkspaceRevealStyle()));
        this.registerEvent(this.app.metadataCache.on("resolved", () => this.updateWorkspaceRevealStyle()));

        this.app.workspace.onLayoutReady(() => {
            this.updateGlobalRevealStyle();
        });
    }

    private getActiveBlurTarget(): BlurTarget<WorkspaceLeaf> {
        const leaf = this.app.workspace.activeLeaf;
        if (!(leaf?.view instanceof MarkdownView) || !leaf.view.file) {
            return {kind: "global"};
        }
        if (this.getFilePrivacyKind(leaf.view.file) !== "private-always") {
            return {kind: "global"};
        }
        return {
            kind: "private-always",
            leaf,
            filePath: leaf.view.file.path,
        };
    }

    private getActiveBlurState(): Readonly<BlurState<Level>> {
        return this.blurStateController.getState(this.getActiveBlurTarget());
    }

    private toggleBlur(): void {
        const target = this.getActiveBlurTarget();
        this.blurStateController.toggleBlur(target);
        this.updateAfterBlurStateChange(target);
    }

    private setCurrentLevel(level: Level): void {
        const target = this.getActiveBlurTarget();
        this.blurStateController.setLevel(target, level);
        this.updateAfterBlurStateChange(target);
    }

    private cycleCurrentLevel(): void {
        const target = this.getActiveBlurTarget();
        this.blurStateController.cycleLevel(target);
        this.updateAfterBlurStateChange(target);
    }

    private updateAfterBlurStateChange(target: BlurTarget<WorkspaceLeaf>): void {
        if (target.kind === "global") {
            this.updateGlobalRevealStyle();
            return;
        }
        this.updateWorkspaceRevealStyle();
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getFilePrivacyKind(file: TFile): PrivacyKind {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return "public";
        return classifyPrivacyTags(getAllTags(cache) ?? []);
    }

    updatePrivateLeaves(): void {
        this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
            const file = (leaf.view instanceof MarkdownView) ? leaf.view.file : null;
            const privacyKind = file ? this.getFilePrivacyKind(file) : "public";
            const leafEl = leaf.view.containerEl.closest<HTMLElement>(".workspace-leaf");
            if (!leafEl) {
                this.blurStateController.resetLeaf(leaf);
                return;
            }
            leafEl.classList.toggle(PRIVATE_LEAF_CLASS, privacyKind !== "public");
            leafEl.classList.toggle(PRIVATE_ALWAYS_LEAF_CLASS, privacyKind === "private-always");
            leafEl.removeClass(
                PRIVATE_ALWAYS_REVEAL_ALL_CLASS,
                PRIVATE_ALWAYS_REVEAL_ON_HOVER_CLASS,
                PRIVATE_ALWAYS_HARD_CHAR_CLASS,
                PRIVATE_ALWAYS_HARD_WORDS_CLASS,
            );

            if (privacyKind !== "private-always" || !file) {
                this.blurStateController.resetLeaf(leaf);
                return;
            }

            const state = this.blurStateController.getState({
                kind: "private-always",
                leaf,
                filePath: file.path,
            });
            this.setPrivateAlwaysLeafClass(leafEl, state);
        });
    }

    private setPrivateAlwaysLeafClass(leafEl: HTMLElement, state: Readonly<BlurState<Level>>): void {
        const modeClass = privateAlwaysClassForState(state);
        if (modeClass) {
            leafEl.addClass(modeClass);
        }
    }

    updateGlobalRevealStyle(): void {
        void this.saveSettings();
        this.removeAllClasses();
        this.setClassToDocumentBody();
        this.updateWorkspaceRevealStyle();

        if (Platform.isDesktopApp) {
            window.require("electron").remote.getCurrentWindow().setContentProtection(this.settings.currentScreenshareProtection)
        }
    }

    private updateWorkspaceRevealStyle(): void {
        this.updatePrivateLeaves();
        this.secondaryRenderProtection.refresh();
        this.updateStatusBarIcon();
        this.refreshCursorRevealDecorations();
    }

    // ViewPlugin реагирует на CM-транзакции, а не на смену body-класса.
    // Форсим пересбор декораций пустым dispatch во все markdown-редакторы.
    refreshCursorRevealDecorations(): void {
        this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
            if (leaf.view instanceof MarkdownView) {
                leaf.view.editor.transaction({});
            }
        });
    }

    removeAllClasses() {
        document.body.removeClass(
            CssClass.RevealAll,
            CssClass.RevealOnHover,
            CssClass.UnprotectedScreenshare,
            CssClass.BlurLinksToo,
            CssClass.HardChar,
            CssClass.HardWords
        );
    }

    setClassToDocumentBody() {
        document.body.dataset[WORDS_COUNT_ATTR] = String(this.settings.hardWordsCount);
        if (!this.settings.currentScreenshareProtection) {
            document.body.classList.add(CssClass.UnprotectedScreenshare)
        }
        if (this.settings.blurLinksToo) {
            document.body.classList.add(CssClass.BlurLinksToo)
        }
        if (!this.settings.blurEnabled) {
            document.body.classList.add(CssClass.RevealAll);
            return;
        }
        switch (this.settings.currentLevel) {
            case Level.HidePrivate:
                break;
            case Level.RevealOnHover:
                document.body.classList.add(CssClass.RevealOnHover);
                break;
            case Level.RevealAll:
                document.body.classList.add(CssClass.RevealAll);
                break;
            case Level.HardChar:
                document.body.classList.add(CssClass.HardChar);
                break;
            case Level.HardWords:
                document.body.classList.add(CssClass.HardWords);
                break;
        }
    }

    private updateStatusBarIcon(): void {
        const state = this.getActiveBlurState();
        if (!state.blurEnabled || state.level === Level.RevealAll) {
            setIcon(this.statusBarSpan, "ph--eye");
            return;
        }
        if (state.level === Level.RevealOnHover) {
            setIcon(this.statusBarSpan, "ph--eye-hand");
            return;
        }
        setIcon(this.statusBarSpan, "ph--eye-closed");
    }

}

class PrivateModeSettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: PrivateModePlugin) {
        super(app, plugin);
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        new Setting(containerEl)
            .setName("Words to keep clear (blur level 3)")
            .setDesc("How many last words (ending at the word under the cursor) stay sharp. 1 = just the current word.")
            .addSlider((s) =>
                s
                    .setLimits(1, 15, 1)
                    .setValue(this.plugin.settings.hardWordsCount)
                    .setDynamicTooltip()
                    .onChange((v) => {
                        this.plugin.settings.hardWordsCount = v;
                        // saveSettings + обновит dataset + пересбор декораций
                        this.plugin.updateGlobalRevealStyle();
                    })
            );
    }
}

// https://icon-sets.iconify.design/ph/eye-closed/
const eyeClosedIcon = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 256"><path fill="currentColor" d="M228 175a8 8 0 0 1-10.92-3l-19-33.2A123.2 123.2 0 0 1 162 155.46l5.87 35.22a8 8 0 0 1-6.58 9.21a8.4 8.4 0 0 1-1.29.11a8 8 0 0 1-7.88-6.69l-5.77-34.58a133 133 0 0 1-36.68 0l-5.77 34.58A8 8 0 0 1 96 200a8.4 8.4 0 0 1-1.32-.11a8 8 0 0 1-6.58-9.21l5.9-35.22a123.2 123.2 0 0 1-36.06-16.69L39 172a8 8 0 1 1-13.94-8l20-35a153.5 153.5 0 0 1-19.3-20a8 8 0 1 1 12.46-10c16.6 20.54 45.64 45 89.78 45s73.18-24.49 89.78-45a8 8 0 1 1 12.44 10a153.5 153.5 0 0 1-19.3 20l20 35a8 8 0 0 1-2.92 11"/></svg>`;

// https://icon-sets.iconify.design/ph/hand-eye/
const eyeHand = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 256"><path fill="currentColor" d="M188 88a27.75 27.75 0 0 0-12 2.71V60a28 28 0 0 0-41.36-24.6A28 28 0 0 0 80 44v6.71A27.75 27.75 0 0 0 68 48a28 28 0 0 0-28 28v76a88 88 0 0 0 176 0v-36a28 28 0 0 0-28-28m12 64a72 72 0 0 1-144 0V76a12 12 0 0 1 24 0v36a8 8 0 0 0 16 0V44a12 12 0 0 1 24 0v60a8 8 0 0 0 16 0V60a12 12 0 0 1 24 0v60a8 8 0 0 0 16 0v-4a12 12 0 0 1 24 0Zm-60 16a12 12 0 1 1-12-12a12 12 0 0 1 12 12m-12-40c-36.52 0-54.41 34.94-55.16 36.42a8 8 0 0 0 0 7.16C73.59 173.06 91.48 208 128 208s54.41-34.94 55.16-36.42a8 8 0 0 0 0-7.16C182.41 162.94 164.52 128 128 128m0 64c-20.63 0-33.8-16.52-38.7-24c4.9-7.48 18.07-24 38.7-24s33.81 16.53 38.7 24c-4.9 7.48-18.07 24-38.7 24"/></svg>`;

// https://icon-sets.iconify.design/ph/eye/
const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 256"><path fill="currentColor" d="M247.31 124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57 61.26 162.88 48 128 48S61.43 61.26 36.34 86.35C17.51 105.18 9 124 8.69 124.76a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 194.74 93.12 208 128 208s66.57-13.26 91.66-38.34c18.83-18.83 27.3-37.61 27.65-38.4a8 8 0 0 0 0-6.5M128 192c-30.78 0-57.67-11.19-79.93-33.25A133.5 133.5 0 0 1 25 128a133.3 133.3 0 0 1 23.07-30.75C70.33 75.19 97.22 64 128 64s57.67 11.19 79.93 33.25A133.5 133.5 0 0 1 231.05 128c-7.21 13.46-38.62 64-103.05 64m0-112a48 48 0 1 0 48 48a48.05 48.05 0 0 0-48-48m0 80a32 32 0 1 1 32-32a32 32 0 0 1-32 32"/></svg>`;

// https://icon-sets.iconify.design/ph/screencast/
const screencastIcon = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 256"><path fill="currentColor" d="M232 56v144a16 16 0 0 1-16 16h-72a8 8 0 0 1 0-16h72V56H40v40a8 8 0 0 1-16 0V56a16 16 0 0 1 16-16h176a16 16 0 0 1 16 16M32 184a8 8 0 0 0 0 16a8 8 0 0 1 8 8a8 8 0 0 0 16 0a24 24 0 0 0-24-24m0-32a8 8 0 0 0 0 16a40 40 0 0 1 40 40a8 8 0 0 0 16 0a56.06 56.06 0 0 0-56-56m0-32a8 8 0 0 0 0 16a72.08 72.08 0 0 1 72 72a8 8 0 0 0 16 0a88.1 88.1 0 0 0-88-88"/></svg>`;

// https://icon-sets.iconify.design/ph/link/
const linkIcon = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 256"><path fill="currentColor" d="M240 88.23a54.43 54.43 0 0 1-16 37L189.25 160a54.27 54.27 0 0 1-38.63 16h-.05A54.63 54.63 0 0 1 96 119.84a8 8 0 0 1 16 .45A38.62 38.62 0 0 0 150.58 160a38.4 38.4 0 0 0 27.31-11.31l34.75-34.75a38.63 38.63 0 0 0-54.63-54.63l-11 11A8 8 0 0 1 135.7 59l11-11a54.65 54.65 0 0 1 77.3 0a54.86 54.86 0 0 1 16 40.23m-131 97.43l-11 11A38.4 38.4 0 0 1 70.6 208a38.63 38.63 0 0 1-27.29-65.94L78 107.31a38.63 38.63 0 0 1 66 28.4a8 8 0 0 0 16 .45A54.86 54.86 0 0 0 144 96a54.65 54.65 0 0 0-77.27 0L32 130.75A54.62 54.62 0 0 0 70.56 224a54.28 54.28 0 0 0 38.64-16l11-11a8 8 0 0 0-11.2-11.34"/></svg>`;
