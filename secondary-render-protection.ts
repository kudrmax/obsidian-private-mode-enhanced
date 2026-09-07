import type {PrivacyKind} from "./privacy-state";

export type RenderKind = "direct-markdown-leaf" | "secondary";

export interface IndexedResultLocation {
    explicitPath: string | null;
    directory: string;
    title: string;
}

export interface RenderLocation {
    sourcePath: string;
    containingLeafPath: string | null;
    nestedInSecondaryContainer: boolean;
}

export interface NormalizedHoverLinkEvent {
    hoverParent: object;
    linktext: string;
    sourcePath: string;
}

export class PendingHoverRegistry<
    TParent extends object,
    TElement extends object,
> {
    private readonly paths = new Map<TParent, string>();

    constructor(
        private readonly getElement: (parent: TParent) => TElement | null,
    ) {}

    set(parent: TParent, path: string): void {
        this.paths.set(parent, path);
    }

    delete(parent: TParent): void {
        this.paths.delete(parent);
    }

    getForElement(element: TElement): string | null {
        for (const [parent, path] of this.paths) {
            if (this.getElement(parent) === element) return path;
        }
        return null;
    }

    takeForElement(element: TElement): string | null {
        for (const [parent, path] of this.paths) {
            if (this.getElement(parent) !== element) continue;
            this.paths.delete(parent);
            return path;
        }
        return null;
    }

    clear(): void {
        this.paths.clear();
    }
}

export function normalizeHoverLinkEvent(value: unknown): NormalizedHoverLinkEvent | null {
    if (typeof value !== "object" || value === null) return null;
    const event = value as Record<string, unknown>;
    if (
        typeof event.hoverParent !== "object" ||
        event.hoverParent === null ||
        typeof event.linktext !== "string" ||
        (event.sourcePath !== undefined && typeof event.sourcePath !== "string")
    ) {
        return null;
    }
    return {
        hoverParent: event.hoverParent,
        linktext: event.linktext,
        sourcePath: event.sourcePath ?? "",
    };
}

export function classifyRenderKind(location: RenderLocation): RenderKind {
    if (
        !location.nestedInSecondaryContainer &&
        location.containingLeafPath === location.sourcePath
    ) {
        return "direct-markdown-leaf";
    }
    return "secondary";
}

export function shouldProtectSecondaryContent(
    privacyKind: PrivacyKind,
    renderKind: RenderKind,
): boolean {
    return privacyKind === "private-always" && renderKind === "secondary";
}

export function resolveIndexedResultPath(location: IndexedResultLocation): string | null {
    const explicitPath = location.explicitPath?.trim();
    if (explicitPath) return explicitPath;

    const title = location.title.trim();
    if (!title) return null;

    const filename = title.endsWith(".md") ? title : `${title}.md`;
    const directory = location.directory.trim().replace(/^\/+|\/+$/g, "");
    return directory ? `${directory}/${filename}` : filename;
}
