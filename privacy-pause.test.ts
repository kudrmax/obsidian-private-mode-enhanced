import assert from "node:assert/strict";
import test from "node:test";
import {BlurStateController} from "./privacy-state";
import {
    DEFAULT_PRIVATE_ALWAYS_PAUSE_MINUTES,
    isValidPauseMinutes,
    PauseScheduler,
    PrivacyPause,
} from "./privacy-pause";

const MINUTE = 60_000;

class TestScheduler implements PauseScheduler {
    time = 0;
    private nextHandle = 0;
    readonly scheduled = new Map<number, {at: number; callback: () => void}>();

    now(): number {
        return this.time;
    }

    schedule(callback: () => void, delayMs: number): number {
        const handle = ++this.nextHandle;
        this.scheduled.set(handle, {at: this.time + delayMs, callback});
        return handle;
    }

    cancel(handle: number): void {
        this.scheduled.delete(handle);
    }

    advance(duration: number): void {
        this.time += duration;
        for (const [handle, task] of [...this.scheduled]) {
            if (task.at > this.time) continue;
            this.scheduled.delete(handle);
            task.callback();
        }
    }
}

test("the default pause expires once after 60 minutes", () => {
    const scheduler = new TestScheduler();
    let expirations = 0;
    const pause = new PrivacyPause(scheduler, () => expirations++);

    pause.start(DEFAULT_PRIVATE_ALWAYS_PAUSE_MINUTES);
    scheduler.advance(59 * MINUTE);
    assert.equal(expirations, 0);
    assert.equal(pause.expiresAt, 60 * MINUTE);
    scheduler.advance(MINUTE);
    assert.equal(expirations, 1);
    assert.equal(pause.expiresAt, null);
    assert.equal(scheduler.scheduled.size, 0);
    pause.checkExpiration();
    assert.equal(expirations, 1);
});

test("repeating the command restarts the configured duration without an old timer expiring", () => {
    const scheduler = new TestScheduler();
    let expirations = 0;
    const pause = new PrivacyPause(scheduler, () => expirations++);

    pause.start(5);
    scheduler.advance(4 * MINUTE);
    pause.start(10);
    scheduler.advance(MINUTE);
    assert.equal(expirations, 0);
    assert.equal(pause.expiresAt, 14 * MINUTE);
    assert.equal(scheduler.scheduled.size, 1);
    scheduler.advance(9 * MINUTE);
    assert.equal(expirations, 1);
});

test("waking after the deadline restores protection even if the timeout was suspended", () => {
    const scheduler = new TestScheduler();
    let expirations = 0;
    const pause = new PrivacyPause(scheduler, () => expirations++);

    pause.start(1);
    scheduler.time = 2 * MINUTE;
    pause.checkExpiration();
    assert.equal(expirations, 1);
    assert.equal(scheduler.scheduled.size, 0);
    assert.equal(pause.expiresAt, null);
});

test("disposing the session cancels its timer and a new session starts protected", () => {
    const scheduler = new TestScheduler();
    let expirations = 0;
    const pause = new PrivacyPause(scheduler, () => expirations++);

    pause.start(60);
    pause.dispose();
    scheduler.advance(60 * MINUTE);
    assert.equal(expirations, 0);
    assert.equal(pause.expiresAt, null);
    assert.equal(new PrivacyPause(scheduler, () => expirations++).expiresAt, null);
});

test("long durations do not overflow the browser timeout limit", () => {
    const scheduler = new TestScheduler();
    let expirations = 0;
    const pause = new PrivacyPause(scheduler, () => expirations++);
    const duration = 60_000 * MINUTE;

    pause.start(60_000);
    assert.equal([...scheduler.scheduled.values()][0].at, 2_147_483_647);
    scheduler.advance(2_147_483_647);
    assert.equal(expirations, 0);
    scheduler.advance(duration - 2_147_483_647);
    assert.equal(expirations, 1);
});

test("pause settings accept positive whole minutes and reject invalid persisted values", () => {
    assert.equal(isValidPauseMinutes(1), true);
    assert.equal(isValidPauseMinutes(90), true);
    for (const invalid of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
        assert.equal(isValidPauseMinutes(invalid), false);
        const pause = new PrivacyPause(new TestScheduler(), () => {});
        pause.start(invalid);
        assert.equal(pause.expiresAt, 60 * MINUTE);
    }
});

test("a pause reveals existing and newly opened always tabs, and expiry restores HardChar everywhere", () => {
    const globalState = {blurEnabled: false, level: "reveal-all"};
    const controller = new BlurStateController<object, string>(globalState, "hard-char", () => "hide-private");
    const scheduler = new TestScheduler();
    const pause = new PrivacyPause(scheduler, () => controller.setPrivateAlwaysPaused(false));
    const first = {kind: "private-always" as const, leaf: {}, filePath: "Secret.md"};
    const second = {kind: "private-always" as const, leaf: {}, filePath: "Secret.md"};
    const openedDuringPause = {kind: "private-always" as const, leaf: {}, filePath: "Another.md"};
    controller.toggleBlur(first);
    controller.setLevel(first, "reveal-all");
    controller.setLevel(second, "hard-words");

    pause.start(5);
    controller.setPrivateAlwaysPaused(true);
    for (const target of [first, second, openedDuringPause]) {
        controller.toggleBlur(target);
        controller.setLevel(target, "hard-words");
        controller.cycleLevel(target);
        assert.equal(controller.getState(target).blurEnabled, false);
    }
    assert.deepEqual(globalState, {blurEnabled: false, level: "reveal-all"});
    controller.toggleBlur({kind: "global"});
    controller.setLevel({kind: "global"}, "hide-private");
    scheduler.advance(5 * MINUTE);

    for (const target of [first, second, openedDuringPause]) {
        assert.deepEqual(controller.getState(target), {blurEnabled: true, level: "hard-char"});
    }
    assert.deepEqual(globalState, {blurEnabled: true, level: "hide-private"});
    controller.toggleBlur(first);
    assert.equal(controller.getState(first).blurEnabled, false);
    assert.equal(controller.getState(second).blurEnabled, true);
});
