# Private-always Secondary Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `#private-always` note content visually blurred in every secondary representation while preserving the current global behavior for titles and the current leaf-local behavior in the note's own open tab.

**Architecture:** A pure policy decides whether a file/render pair needs permanent secondary protection. One controller applies a semantic class to Markdown render roots, hover popovers, and indexed results; CSS assigns permanent blur only to content descendants and routes title descendants through the existing global reveal state.

**Tech Stack:** TypeScript 4.7, Obsidian Plugin API, CodeMirror-independent DOM adapters, SCSS, Node test runner through `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-07-private-always-secondary-rendering-design.md`

## Global Constraints

- Protection is visual CSS blur only; do not remove or replace content in the DOM.
- The content of `#private-always` and nested `#private-always/...` notes is permanently blurred in secondary representations.
- Titles use existing global `#private` behavior and remain independent from a `#private-always` leaf's local state.
- Existing ordinary `#private` behavior must not change.
- Existing local commands and default hard-character behavior for an open `#private-always` leaf must not change.
- Use strict TypeScript types and lifecycle-managed Obsidian registrations.
- Do not run any git command.

---

### Task 1: Pure secondary-render policy and indexed-result path resolution

**Files:**
- Create: `secondary-render-protection.ts`
- Create: `secondary-render-protection.test.ts`

**Interfaces:**
- Consumes: `PrivacyKind` from `privacy-state.ts`.
- Produces: `RenderKind`, `shouldProtectSecondaryContent()`, `IndexedResultLocation`, and `resolveIndexedResultPath()`.

- [ ] **Step 1: Write failing policy tests**

```ts
test("only secondary private-always content gets permanent protection", () => {
    assert.equal(shouldProtectSecondaryContent("private-always", "secondary"), true);
    assert.equal(shouldProtectSecondaryContent("private-always", "direct-markdown-leaf"), false);
    assert.equal(shouldProtectSecondaryContent("private", "secondary"), false);
    assert.equal(shouldProtectSecondaryContent("public", "secondary"), false);
});
```

- [ ] **Step 2: Run the policy test and observe the missing-module failure**

Run: `npx tsx --test secondary-render-protection.test.ts`

Expected: FAIL because `secondary-render-protection.ts` does not exist.

- [ ] **Step 3: Implement the policy**

```ts
export type RenderKind = "direct-markdown-leaf" | "secondary";

export function shouldProtectSecondaryContent(
    privacyKind: PrivacyKind,
    renderKind: RenderKind,
): boolean {
    return privacyKind === "private-always" && renderKind === "secondary";
}
```

- [ ] **Step 4: Write failing indexed-result path tests**

```ts
test("an explicit indexed-result path wins", () => {
    assert.equal(resolveIndexedResultPath({
        explicitPath: "Secrets/Bank.md",
        directory: "/Ignored",
        title: "Ignored",
    }), "Secrets/Bank.md");
});

test("a core backlink title and directory form a Markdown path", () => {
    assert.equal(resolveIndexedResultPath({
        explicitPath: null,
        directory: "/Secrets",
        title: "Bank",
    }), "Secrets/Bank.md");
    assert.equal(resolveIndexedResultPath({
        explicitPath: null,
        directory: "/",
        title: "Bank",
    }), "Bank.md");
});

test("an incomplete indexed-result location stays unresolved", () => {
    assert.equal(resolveIndexedResultPath({
        explicitPath: null,
        directory: "/Secrets",
        title: "",
    }), null);
});
```

- [ ] **Step 5: Run the new path tests and observe assertion failures**

Run: `npx tsx --test secondary-render-protection.test.ts`

Expected: policy test passes and path tests fail because `resolveIndexedResultPath()` is not implemented.

- [ ] **Step 6: Implement normalized path resolution**

```ts
export interface IndexedResultLocation {
    explicitPath: string | null;
    directory: string;
    title: string;
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
```

- [ ] **Step 7: Run the focused and full unit suites**

Run: `npx tsx --test secondary-render-protection.test.ts`

Expected: all focused tests pass.

Run: `npm test`

Expected: all existing and new tests pass.

---

### Task 2: Lifecycle-managed secondary-render controller

**Files:**
- Modify: `secondary-render-protection.ts`
- Modify: `secondary-render-protection.test.ts`
- Modify: `main.ts`

**Interfaces:**
- Consumes: `App`, `Component`, `HoverParent`, `MarkdownView`, `TFile`, `WorkspaceLeaf`, and `(file: TFile) => PrivacyKind`.
- Produces: `PRIVATE_ALWAYS_SECONDARY_RENDER_CLASS` and `SecondaryRenderProtection` with `protectMarkdownRender()`, `refresh()`, and lifecycle cleanup.

- [ ] **Step 1: Add failing direct-versus-secondary render tests**

Use a small `ClosestElement` fake whose `closest()` returns literal sentinels. Assert these cases through a pure `classifyRenderKind()` helper:

```ts
test("a matching top-level Markdown leaf is a direct render", () => {
    assert.equal(classifyRenderKind({
        sourcePath: "Secret.md",
        containingLeafPath: "Secret.md",
        nestedInSecondaryContainer: false,
    }), "direct-markdown-leaf");
});

test("an embed in the matching leaf is still secondary", () => {
    assert.equal(classifyRenderKind({
        sourcePath: "Secret.md",
        containingLeafPath: "Secret.md",
        nestedInSecondaryContainer: true,
    }), "secondary");
});
```

- [ ] **Step 2: Run the focused test and observe the missing-export failure**

Run: `npx tsx --test secondary-render-protection.test.ts`

Expected: FAIL because `classifyRenderKind()` is not exported.

- [ ] **Step 3: Implement render-kind classification**

```ts
export interface RenderLocation {
    sourcePath: string;
    containingLeafPath: string | null;
    nestedInSecondaryContainer: boolean;
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
```

- [ ] **Step 4: Implement `SecondaryRenderProtection`**

The component must:

```ts
export const PRIVATE_ALWAYS_SECONDARY_RENDER_CLASS =
    "private-mode-private-always-secondary-render";

export class SecondaryRenderProtection extends Component {
    constructor(
        private readonly app: App,
        private readonly getPrivacyKind: (file: TFile) => PrivacyKind,
    ) {
        super();
    }

    protectMarkdownRender(el: HTMLElement, sourcePath: string): void;
    refresh(root?: ParentNode): void;
}
```

Implementation details:

- `protectMarkdownRender()` resolves `sourcePath` through `vault.getAbstractFileByPath()` and ignores non-files.
- The closest matching Markdown leaf is resolved by comparing each leaf's `.workspace-leaf` element with `el.closest(".workspace-leaf")`.
- `.hover-popover`, `.markdown-embed`, `.internal-embed`, and `.canvas-node` ancestors make a render secondary even inside a matching leaf.
- The closest hover/embed/canvas/preview root stores the source path in `data-private-mode-source-path` and receives or loses the semantic class through the pure policy.
- A single `MutationObserver` watches added nodes, classifies newly-created hover popovers before paint, refreshes new indexed results, and forgets disconnected roots.
- A `hover-link` listener resolves the target with `metadataCache.getFirstLinkpathDest(linktext, sourcePath)`. It marks the next popover as private-always regardless of the source surface.
- Every `refresh()` reclassifies stored render roots and all `.search-result` nodes.
- `onunload()` disconnects the observer and removes plugin-owned classes and data attributes.

- [ ] **Step 5: Register the controller in `main.ts`**

Add one plugin-owned child and one Markdown postprocessor:

```ts
this.secondaryRenderProtection = this.addChild(
    new SecondaryRenderProtection(this.app, (file) => this.getFilePrivacyKind(file)),
);

this.registerMarkdownPostProcessor((el, context) => {
    this.secondaryRenderProtection.protectMarkdownRender(el, context.sourcePath);
});
```

Call `secondaryRenderProtection.refresh()` from the existing workspace refresh path so layout and metadata changes update visible secondary renders.

- [ ] **Step 6: Build before styling and verify the integration compiles**

Run: `npm run build`

Expected: exit code 0.

---

### Task 3: Permanent content blur and global title behavior

**Files:**
- Modify: `styles.scss`

**Interfaces:**
- Consumes: `.private-mode-private-always-secondary-render` from Task 2 and existing body/leaf reveal classes.
- Produces: permanent secondary-content blur plus globally-controlled title blur.

- [ ] **Step 1: Record the live failing hover-preview behavior**

With `tmp private` open, Cmd-hover its `tmp private always` backlink result and inspect the resulting `.popover.hover-popover`:

```js
const preview = document.querySelector(".popover.hover-popover");
const body = preview?.querySelector(
    ".markdown-preview-sizer > :not(.mod-header, .markdown-preview-pusher)",
);
getComputedStyle(body).filter;
```

Expected before styling: `none`.

- [ ] **Step 2: Add global-title selectors**

Extend the existing global selector loop so `.inline-title` and embed titles inside a classified secondary render use the same body-level reveal classes as ordinary `#private` content. Add indexed-result titles under the existing `private-mode-blur-links-too` gate.

```scss
"" ".private-mode-private-always-secondary-render .inline-title" 1,
".private-mode-blur-links-too" ".private-mode-private-always-secondary-render .search-result-file-title" 1,
```

- [ ] **Step 3: Add final permanent-content rules after every reveal rule**

```scss
$private-always-secondary-content-selectors: (
    ".private-mode-private-always-secondary-render .markdown-preview-sizer > :not(.mod-header, .markdown-preview-pusher)" 1,
    ".private-mode-private-always-secondary-render .metadata-property" 1,
    ".private-mode-private-always-secondary-render .search-result-file-match" 1,
    ".private-mode-private-always-secondary-render :is(img, video, svg, canvas)" 4,
);

@each $selector, $multiplier in $private-always-secondary-content-selectors {
    body #{$selector} {
        filter: blur(calc(var(--blur-level) * #{$multiplier})) !important;
    }
}
```

Keep controls and title containers outside these selectors.

- [ ] **Step 4: Build and deploy the plugin artifacts**

Run: `npm run build`

Expected: exit code 0.

Copy `main.js`, `styles.css`, and `manifest.json` to the active vault plugin directory, then disable and enable `private-mode-enhanced` through the Obsidian CLI.

- [ ] **Step 5: Run the live RED-to-GREEN regression**

Repeat Step 1.

Expected after implementation: `blur(8px)` for text content and `blur(32px)` for images.

Toggle local blur and every local level in the open `tmp private always` leaf, then repeat the external preview check.

Expected: the external preview content remains blurred in every state.

Disable global blur and repeat the check.

Expected: the preview title follows the global state while its content remains blurred.

---

### Task 4: Indexed excerpts, documentation, and complete verification

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Test: `secondary-render-protection.test.ts`

**Interfaces:**
- Consumes: the policy, controller, marker, and CSS from Tasks 1–3.
- Produces: documented behavior and verified production artifacts.

- [ ] **Step 1: Verify backlink result classification without optional-plugin attributes**

Temporarily evaluate the core title/path fallback against the live `tmp private always` backlink result after ignoring `data-link-path`.

Expected: `tmp private always.md` resolves and only `.search-result-file-match` has permanent blur; `.search-result-file-title` follows the global state.

- [ ] **Step 2: Verify embed behavior**

Use the existing test vault or a recoverable temporary root note containing `![[Always private Note]]`.

Expected: embedded content stays blurred across every global and local mode, while opening the note gives control back to the destination leaf's local state.

Close the temporary note and move it to the macOS Trash with `trash`.

- [ ] **Step 3: Document the invariant**

Add concise text to `README.md` and `CLAUDE.md` stating that `#private-always` content is always blurred in hover previews, embeds, and indexed excerpts; titles retain global behavior; direct open tabs retain local behavior.

- [ ] **Step 4: Run complete automated verification**

Run: `npm test`

Expected: zero failed tests.

Run: `npm run build`

Expected: exit code 0.

Run: `npx eslint --no-cache main.ts cursor-reveal.ts cursor-mode.ts privacy-state.ts secondary-render-protection.ts cursor-mode.test.ts privacy-state.test.ts secondary-render-protection.test.ts`

Expected: exit code 0 and no output.

- [ ] **Step 5: Verify the deployed artifacts and runtime**

Compare `main.js`, `styles.css`, and `manifest.json` byte-for-byte with the active vault plugin copies.

Run: `obsidian dev:errors`

Expected: no error from `private-mode-enhanced`. Report errors from unrelated plugins separately instead of hiding them.

- [ ] **Step 6: Request code review and resolve every Critical or Important finding**

The reviewer checks the approved matrix, permanent-content cascade, title isolation, lifecycle cleanup, and ordinary `#private` regressions without using git commands.
