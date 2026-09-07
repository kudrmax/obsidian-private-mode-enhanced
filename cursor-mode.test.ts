import assert from "node:assert/strict";
import test from "node:test";

function classList(...values: string[]): {contains(value: string): boolean} {
    return {contains: (value) => values.includes(value)};
}

test("a private-always leaf hard mode overrides the global hard mode", async () => {
    const {
        resolveHardMode,
    } = await import("./cursor-mode.ts");

    const mode = resolveHardMode(
        classList("private-mode-hard-words"),
        classList("private-mode-private-always-note", "private-mode-always-hard-char"),
    );

    assert.equal(mode, "char");
});

test("a non-hard private-always leaf ignores the global hard mode", async () => {
    const {resolveHardMode} = await import("./cursor-mode.ts");

    const mode = resolveHardMode(
        classList("private-mode-hard-words"),
        classList("private-mode-private-always-note"),
    );

    assert.equal(mode, null);
});

test("a regular leaf uses the global hard mode", async () => {
    const {resolveHardMode} = await import("./cursor-mode.ts");

    const mode = resolveHardMode(classList("private-mode-hard-words"), classList());

    assert.equal(mode, "words");
});

test("private-always state maps to a leaf-local CSS mode", async () => {
    const {privateAlwaysClassForState} = await import("./cursor-mode.ts");

    assert.equal(
        privateAlwaysClassForState({blurEnabled: false, level: "hard-char"}),
        "private-mode-always-reveal-all",
    );
    assert.equal(
        privateAlwaysClassForState({blurEnabled: true, level: "reveal-all"}),
        "private-mode-always-reveal-all",
    );
    assert.equal(
        privateAlwaysClassForState({blurEnabled: true, level: "reveal-on-hover"}),
        "private-mode-always-reveal-on-hover",
    );
    assert.equal(
        privateAlwaysClassForState({blurEnabled: true, level: "hard-char"}),
        "private-mode-always-hard-char",
    );
    assert.equal(
        privateAlwaysClassForState({blurEnabled: true, level: "hard-words"}),
        "private-mode-always-hard-words",
    );
    assert.equal(privateAlwaysClassForState({blurEnabled: true, level: "hide-private"}), null);
});
