import {
    App,
    Component,
    HoverParent,
    MarkdownView,
    TFile,
    WorkspaceLeaf,
} from "obsidian";
import type {Events} from "obsidian";
import {PrivacyKind} from "./privacy-state";
import {
    classifyRenderKind,
    normalizeHoverLinkEvent,
    PendingHoverRegistry,
    resolveIndexedResultPath,
    shouldProtectSecondaryContent,
} from "./secondary-render-protection";

export const PRIVATE_ALWAYS_SECONDARY_RENDER_CLASS =
    "private-mode-private-always-secondary-render";

const SOURCE_PATH_ATTRIBUTE = "data-private-mode-source-path";
const SOURCE_PATH_DATA_KEY = "privateModeSourcePath";
const SECONDARY_CONTAINER_SELECTOR =
    ".hover-popover, .markdown-embed, .internal-embed, .canvas-node";
const RENDER_ROOT_SELECTOR =
    `${SECONDARY_CONTAINER_SELECTOR}, .markdown-preview-view`;
const INDEXED_RESULT_SELECTOR = ".search-result";
const HOVER_PENDING_TIMEOUT_MS = 2_000;

export class SecondaryRenderProtection extends Component {
    private observer: MutationObserver | null = null;
    private readonly pendingHovers = new PendingHoverRegistry<
        HoverParent,
        HTMLElement
    >((parent) => parent.hoverPopover?.hoverEl ?? null);
    private readonly pendingHoverTimeouts = new Map<HoverParent, number>();

    constructor(
        private readonly app: App,
        private readonly getPrivacyKind: (file: TFile) => PrivacyKind,
    ) {
        super();
    }

    onload(): void {
        const workspaceEvents: Events = this.app.workspace;
        this.registerEvent(workspaceEvents.on("hover-link", (...data: unknown[]) => {
            const event = normalizeHoverLinkEvent(data[0]);
            if (event && isHoverParent(event.hoverParent)) {
                this.handleHoverLink(
                    event.hoverParent,
                    event.linktext,
                    event.sourcePath,
                );
            }
        }));

        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "attributes") {
                    const result = (mutation.target as Element)
                        .closest<HTMLElement>(INDEXED_RESULT_SELECTOR);
                    if (result) {
                        this.refreshIndexedResult(result);
                    }
                    continue;
                }
                for (const node of Array.from(mutation.addedNodes)) {
                    if (!(node instanceof Element)) continue;
                    this.protectAddedHoverPopover(node);
                    this.refresh(node);
                    const containingResult = node.closest<HTMLElement>(INDEXED_RESULT_SELECTOR);
                    if (containingResult) {
                        this.refreshIndexedResult(containingResult);
                    }
                }
            }
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-path", "data-file-path", "data-link-path"],
        });
        this.refresh();
    }

    protectMarkdownRender(el: HTMLElement, sourcePath: string): void {
        const renderRoot = el.closest<HTMLElement>(RENDER_ROOT_SELECTOR) ?? el;
        const file = this.getFile(sourcePath);
        if (!file) {
            this.clearRenderRoot(renderRoot);
            return;
        }

        const renderKind = classifyRenderKind({
            sourcePath: file.path,
            containingLeafPath: this.getContainingMarkdownLeafPath(el),
            nestedInSecondaryContainer: el.closest(SECONDARY_CONTAINER_SELECTOR) !== null,
        });
        this.setRenderRootProtection(renderRoot, file, renderKind);
    }

    refresh(root: ParentNode = document): void {
        for (const renderRoot of elementsMatching(
            root,
            `[${SOURCE_PATH_ATTRIBUTE}]`,
        )) {
            this.refreshStoredRenderRoot(renderRoot);
        }
        for (const result of elementsMatching(root, INDEXED_RESULT_SELECTOR)) {
            this.refreshIndexedResult(result);
        }
    }

    onunload(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.clearPendingHovers();
        for (const root of Array.from(document.querySelectorAll<HTMLElement>(
            `.${PRIVATE_ALWAYS_SECONDARY_RENDER_CLASS}, [${SOURCE_PATH_ATTRIBUTE}]`,
        ))) {
            this.clearRenderRoot(root);
        }
    }

    private handleHoverLink(
        hoverParent: HoverParent,
        linktext: string,
        sourcePath: string,
    ): void {
        const file = this.app.metadataCache.getFirstLinkpathDest(
            linktext,
            sourcePath,
        );
        if (!file || this.getPrivacyKind(file) !== "private-always") {
            this.clearPendingHover(hoverParent);
            return;
        }

        this.clearPendingHover(hoverParent);
        this.pendingHovers.set(hoverParent, file.path);
        this.pendingHoverTimeouts.set(hoverParent, window.setTimeout(
            () => this.clearPendingHover(hoverParent),
            HOVER_PENDING_TIMEOUT_MS,
        ));

        const popover = hoverParent.hoverPopover?.hoverEl;
        if (popover) {
            this.protectCurrentHoverPopover(popover);
        }
    }

    private protectAddedHoverPopover(root: Element): void {
        for (const popover of elementsMatching(root, ".hover-popover")) {
            this.protectPendingHoverPopover(popover);
        }
    }

    private protectPendingHoverPopover(popover: HTMLElement): void {
        const pendingPath = this.pendingHovers.takeForElement(popover);
        if (!pendingPath) return;

        this.protectHoverPopover(popover, pendingPath);
        this.clearPendingHoverTimeoutForElement(popover);
    }

    private protectCurrentHoverPopover(popover: HTMLElement): void {
        const pendingPath = this.pendingHovers.getForElement(popover);
        if (!pendingPath) return;
        this.protectHoverPopover(popover, pendingPath);
    }

    private protectHoverPopover(popover: HTMLElement, path: string): void {
        const file = this.getFile(path);
        if (file) {
            this.setRenderRootProtection(popover, file, "secondary");
        }
    }

    private refreshStoredRenderRoot(root: HTMLElement): void {
        const sourcePath = root.dataset[SOURCE_PATH_DATA_KEY];
        if (!sourcePath) {
            this.clearRenderRoot(root);
            return;
        }
        const file = this.getFile(sourcePath);
        if (!file) {
            this.clearRenderRoot(root);
            return;
        }

        const secondaryContainer = root.closest<HTMLElement>(
            SECONDARY_CONTAINER_SELECTOR,
        );
        const renderRoot = secondaryContainer ?? root;
        if (renderRoot !== root) {
            this.clearRenderRoot(root);
        }

        const renderKind = classifyRenderKind({
            sourcePath: file.path,
            containingLeafPath: this.getContainingMarkdownLeafPath(renderRoot),
            nestedInSecondaryContainer: secondaryContainer !== null,
        });
        this.setRenderRootProtection(renderRoot, file, renderKind);
    }

    private refreshIndexedResult(result: HTMLElement): void {
        const resolvedPath = resolveIndexedResultPath({
            explicitPath: this.getExplicitIndexedResultPath(result),
            directory: result.querySelector<HTMLElement>(".search-result-file-path")
                ?.textContent ?? "",
            title: result.querySelector<HTMLElement>(
                ".search-result-file-title .tree-item-inner, .search-result-file-title",
            )?.textContent ?? "",
        });
        const sourcePath = resolvedPath ?? result.dataset[SOURCE_PATH_DATA_KEY] ?? null;
        if (!sourcePath) return;

        const file = this.getFile(sourcePath);
        if (!file) {
            this.clearRenderRoot(result);
            return;
        }
        this.setRenderRootProtection(result, file, "secondary");
    }

    private getExplicitIndexedResultPath(result: HTMLElement): string | null {
        const pathSelector = "[data-path], [data-file-path], [data-link-path]";
        const title = result.querySelector<HTMLElement>(".search-result-file-title");
        const pathElement = result.matches(pathSelector)
            ? result
            : title?.matches(pathSelector)
                ? title
                : title?.querySelector<HTMLElement>(pathSelector);
        return pathElement?.dataset.path
            ?? pathElement?.dataset.filePath
            ?? pathElement?.dataset.linkPath
            ?? null;
    }

    private setRenderRootProtection(
        root: HTMLElement,
        file: TFile,
        renderKind: "direct-markdown-leaf" | "secondary",
    ): void {
        root.dataset[SOURCE_PATH_DATA_KEY] = file.path;
        root.classList.toggle(
            PRIVATE_ALWAYS_SECONDARY_RENDER_CLASS,
            shouldProtectSecondaryContent(this.getPrivacyKind(file), renderKind),
        );
    }

    private getContainingMarkdownLeafPath(el: Element): string | null {
        const containingLeafEl = el.closest<HTMLElement>(".workspace-leaf");
        if (!containingLeafEl) return null;

        const leaf = this.app.workspace.getLeavesOfType("markdown").find(
            (candidate) => this.getWorkspaceLeafElement(candidate) === containingLeafEl,
        );
        if (!(leaf?.view instanceof MarkdownView)) return null;
        return leaf.view.file?.path ?? null;
    }

    private getWorkspaceLeafElement(leaf: WorkspaceLeaf): HTMLElement | null {
        return leaf.view.containerEl.closest<HTMLElement>(".workspace-leaf");
    }

    private getFile(path: string): TFile | null {
        const abstractFile = this.app.vault.getAbstractFileByPath(path);
        return abstractFile instanceof TFile ? abstractFile : null;
    }

    private clearRenderRoot(root: HTMLElement): void {
        root.classList.remove(PRIVATE_ALWAYS_SECONDARY_RENDER_CLASS);
        root.removeAttribute(SOURCE_PATH_ATTRIBUTE);
    }

    private clearPendingHover(hoverParent: HoverParent): void {
        this.pendingHovers.delete(hoverParent);
        const timeout = this.pendingHoverTimeouts.get(hoverParent);
        if (timeout !== undefined) {
            window.clearTimeout(timeout);
            this.pendingHoverTimeouts.delete(hoverParent);
        }
    }

    private clearPendingHoverTimeoutForElement(popover: HTMLElement): void {
        for (const [hoverParent, timeout] of this.pendingHoverTimeouts) {
            if (hoverParent.hoverPopover?.hoverEl !== popover) continue;
            window.clearTimeout(timeout);
            this.pendingHoverTimeouts.delete(hoverParent);
            return;
        }
    }

    private clearPendingHovers(): void {
        this.pendingHovers.clear();
        for (const timeout of this.pendingHoverTimeouts.values()) {
            window.clearTimeout(timeout);
        }
        this.pendingHoverTimeouts.clear();
    }
}

function isHoverParent(value: object): value is HoverParent {
    return "hoverPopover" in value;
}

function elementsMatching(root: ParentNode, selector: string): HTMLElement[] {
    const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (root instanceof HTMLElement && root.matches(selector)) {
        elements.unshift(root);
    }
    return elements;
}
