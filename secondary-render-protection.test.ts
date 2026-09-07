import assert from "node:assert/strict";
import test from "node:test";

test("a hover-link payload without sourcePath uses the vault root", async () => {
    const {normalizeHoverLinkEvent} = await import("./secondary-render-protection.ts");
    const hoverParent = {hoverPopover: null};

    assert.deepEqual(normalizeHoverLinkEvent({
        event: {},
        source: "backlink",
        hoverParent,
        targetEl: {},
        linktext: "Secret.md",
        state: {},
    }), {
        hoverParent,
        linktext: "Secret.md",
        sourcePath: "",
    });
});

test("clearing one hover parent does not clear another pending preview", async () => {
    const {PendingHoverRegistry} = await import("./secondary-render-protection.ts");
    const privatePopover = {};
    const publicPopover = {};
    const privateParent = {hoverPopover: {hoverEl: privatePopover}};
    const publicParent = {hoverPopover: {hoverEl: publicPopover}};
    const registry = new PendingHoverRegistry<
        typeof privateParent,
        typeof privatePopover
    >((parent) => parent.hoverPopover?.hoverEl ?? null);

    registry.set(privateParent, "Secret.md");
    registry.delete(publicParent);

    assert.equal(registry.takeForElement(privatePopover), "Secret.md");
});

test("a pending hover path is consumed only by its own popover", async () => {
    const {PendingHoverRegistry} = await import("./secondary-render-protection.ts");
    const privatePopover = {};
    const unrelatedPopover = {};
    const privateParent = {hoverPopover: {hoverEl: privatePopover}};
    const registry = new PendingHoverRegistry<
        typeof privateParent,
        typeof privatePopover
    >((parent) => parent.hoverPopover?.hoverEl ?? null);

    registry.set(privateParent, "Secret.md");

    assert.equal(registry.takeForElement(unrelatedPopover), null);
    assert.equal(registry.getForElement(privatePopover), "Secret.md");
    assert.equal(registry.getForElement(privatePopover), "Secret.md");
    assert.equal(registry.takeForElement(privatePopover), "Secret.md");
    assert.equal(registry.takeForElement(privatePopover), null);
});

test("a matching top-level Markdown leaf is a direct render", async () => {
    const {classifyRenderKind} = await import("./secondary-render-protection.ts");

    assert.equal(classifyRenderKind({
        sourcePath: "Secret.md",
        containingLeafPath: "Secret.md",
        nestedInSecondaryContainer: false,
    }), "direct-markdown-leaf");
});

test("an embed in the matching leaf is still secondary", async () => {
    const {classifyRenderKind} = await import("./secondary-render-protection.ts");

    assert.equal(classifyRenderKind({
        sourcePath: "Secret.md",
        containingLeafPath: "Secret.md",
        nestedInSecondaryContainer: true,
    }), "secondary");
});

test("only secondary private-always content gets permanent protection", async () => {
    const {shouldProtectSecondaryContent} = await import("./secondary-render-protection.ts");

    assert.equal(shouldProtectSecondaryContent("private-always", "secondary"), true);
    assert.equal(shouldProtectSecondaryContent("private-always", "direct-markdown-leaf"), false);
    assert.equal(shouldProtectSecondaryContent("private", "secondary"), false);
    assert.equal(shouldProtectSecondaryContent("public", "secondary"), false);
});

test("an explicit indexed-result path wins", async () => {
    const {resolveIndexedResultPath} = await import("./secondary-render-protection.ts");

    assert.equal(resolveIndexedResultPath({
        explicitPath: "Secrets/Bank.md",
        directory: "/Ignored",
        title: "Ignored",
    }), "Secrets/Bank.md");
});

test("a core backlink title and directory form a Markdown path", async () => {
    const {resolveIndexedResultPath} = await import("./secondary-render-protection.ts");

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

test("an incomplete indexed-result location stays unresolved", async () => {
    const {resolveIndexedResultPath} = await import("./secondary-render-protection.ts");

    assert.equal(resolveIndexedResultPath({
        explicitPath: null,
        directory: "/Secrets",
        title: "",
    }), null);
});

test("an indexed-result path trims whitespace", async () => {
    const {resolveIndexedResultPath} = await import("./secondary-render-protection.ts");

    assert.equal(resolveIndexedResultPath({
        explicitPath: "  Secrets/Bank.md  ",
        directory: " /Ignored/ ",
        title: " Ignored ",
    }), "Secrets/Bank.md");
    assert.equal(resolveIndexedResultPath({
        explicitPath: null,
        directory: " /Secrets/ ",
        title: " Bank ",
    }), "Secrets/Bank.md");
});

test("an indexed-result title with a Markdown extension is not duplicated", async () => {
    const {resolveIndexedResultPath} = await import("./secondary-render-protection.ts");

    assert.equal(resolveIndexedResultPath({
        explicitPath: null,
        directory: "/Secrets",
        title: "Bank.md",
    }), "Secrets/Bank.md");
});
