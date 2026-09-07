import assert from "node:assert/strict";
import test from "node:test";

test("a new private-always leaf starts blurred at the hard-char level", async () => {
    const {BlurStateController} = await import("./privacy-state.ts");
    const globalState = {blurEnabled: false, level: "reveal-all"};
    const controller = new BlurStateController<object, string>(
        globalState,
        "hard-char",
        () => "reveal-all",
    );
    const leaf = {};

    const state = controller.getState({kind: "private-always", leaf, filePath: "Secret.md"});

    assert.deepEqual(state, {blurEnabled: true, level: "hard-char"});
});

test("toggling a private-always leaf does not change global state", async () => {
    const {BlurStateController} = await import("./privacy-state.ts");
    const globalState = {blurEnabled: false, level: "reveal-all"};
    const controller = new BlurStateController<object, string>(
        globalState,
        "hard-char",
        () => "reveal-all",
    );
    const leaf = {};
    const target = {kind: "private-always" as const, leaf, filePath: "Secret.md"};

    controller.toggleBlur(target);

    assert.deepEqual(controller.getState(target), {blurEnabled: false, level: "hard-char"});
    assert.deepEqual(globalState, {blurEnabled: false, level: "reveal-all"});
});

test("setting a private-always level does not change global level", async () => {
    const {BlurStateController} = await import("./privacy-state.ts");
    const globalState = {blurEnabled: true, level: "hide-private"};
    const controller = new BlurStateController<object, string>(
        globalState,
        "hard-char",
        () => "reveal-all",
    );
    const leaf = {};
    const target = {kind: "private-always" as const, leaf, filePath: "Secret.md"};

    controller.setLevel(target, "hard-words");

    assert.deepEqual(controller.getState(target), {blurEnabled: true, level: "hard-words"});
    assert.deepEqual(globalState, {blurEnabled: true, level: "hide-private"});
});

test("cycling a private-always level uses only its local level", async () => {
    const {BlurStateController} = await import("./privacy-state.ts");
    const globalState = {blurEnabled: true, level: "hide-private"};
    const controller = new BlurStateController<object, string>(
        globalState,
        "hard-char",
        (level) => level === "hard-char" ? "reveal-all" : "hide-private",
    );
    const leaf = {};
    const target = {kind: "private-always" as const, leaf, filePath: "Secret.md"};

    controller.cycleLevel(target);

    assert.deepEqual(controller.getState(target), {blurEnabled: true, level: "reveal-all"});
    assert.deepEqual(globalState, {blurEnabled: true, level: "hide-private"});
});

test("resetting a leaf forgets its private-always state", async () => {
    const {BlurStateController} = await import("./privacy-state.ts");
    const controller = new BlurStateController<object, string>(
        {blurEnabled: false, level: "reveal-all"},
        "hard-char",
        () => "reveal-all",
    );
    const leaf = {};
    const target = {kind: "private-always" as const, leaf, filePath: "Secret.md"};
    controller.toggleBlur(target);
    controller.setLevel(target, "hide-private");

    controller.resetLeaf(leaf);

    assert.deepEqual(controller.getState(target), {blurEnabled: true, level: "hard-char"});
});

test("private-always tags take priority over private tags", async () => {
    const {classifyPrivacyTags} = await import("./privacy-state.ts");

    assert.equal(classifyPrivacyTags(["#private", "#private-always"]), "private-always");
    assert.equal(classifyPrivacyTags(["#private-always/banking"]), "private-always");
    assert.equal(classifyPrivacyTags(["#private/work"]), "private");
    assert.equal(classifyPrivacyTags(["#private-always-ish"]), "public");
});

test("two leaves of the same private-always file keep independent state", async () => {
    const {BlurStateController} = await import("./privacy-state.ts");
    const controller = new BlurStateController<object, string>(
        {blurEnabled: true, level: "hide-private"},
        "hard-char",
        () => "reveal-all",
    );
    const firstTarget = {kind: "private-always" as const, leaf: {}, filePath: "Secret.md"};
    const secondTarget = {kind: "private-always" as const, leaf: {}, filePath: "Secret.md"};

    controller.toggleBlur(firstTarget);

    assert.equal(controller.getState(firstTarget).blurEnabled, false);
    assert.equal(controller.getState(secondTarget).blurEnabled, true);
});

test("opening another file in a leaf resets its private-always state", async () => {
    const {BlurStateController} = await import("./privacy-state.ts");
    const controller = new BlurStateController<object, string>(
        {blurEnabled: true, level: "hide-private"},
        "hard-char",
        () => "reveal-all",
    );
    const leaf = {};
    const firstTarget = {kind: "private-always" as const, leaf, filePath: "First.md"};
    const secondTarget = {kind: "private-always" as const, leaf, filePath: "Second.md"};
    controller.toggleBlur(firstTarget);
    controller.setLevel(firstTarget, "reveal-all");

    assert.deepEqual(
        controller.getState(secondTarget),
        {blurEnabled: true, level: "hard-char"},
    );
});
