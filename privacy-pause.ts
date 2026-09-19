export const DEFAULT_PRIVATE_ALWAYS_PAUSE_MINUTES = 60;

const MILLISECONDS_PER_MINUTE = 60_000;
const MAX_TIMEOUT_MILLISECONDS = 2_147_483_647;

export function isValidPauseMinutes(value: number): boolean {
    return Number.isSafeInteger(value)
        && value > 0
        && Number.isSafeInteger(value * MILLISECONDS_PER_MINUTE);
}

export interface PauseScheduler {
    now(): number;
    schedule(callback: () => void, delayMs: number): number;
    cancel(handle: number): void;
}

export class PrivacyPause {
    private deadline: number | null = null;
    private timeout: number | null = null;

    constructor(
        private readonly scheduler: PauseScheduler,
        private readonly onExpire: () => void,
    ) {}

    get expiresAt(): number | null {
        return this.deadline;
    }

    start(minutes: number): void {
        this.dispose();
        const duration = isValidPauseMinutes(minutes)
            ? minutes
            : DEFAULT_PRIVATE_ALWAYS_PAUSE_MINUTES;
        this.deadline = this.scheduler.now() + duration * MILLISECONDS_PER_MINUTE;
        this.scheduleExpiration();
    }

    checkExpiration(): void {
        if (this.deadline === null || this.scheduler.now() < this.deadline) return;
        this.dispose();
        this.onExpire();
    }

    dispose(): void {
        if (this.timeout !== null) {
            this.scheduler.cancel(this.timeout);
            this.timeout = null;
        }
        this.deadline = null;
    }

    private scheduleExpiration(): void {
        if (this.deadline === null) return;
        const remaining = this.deadline - this.scheduler.now();
        this.timeout = this.scheduler.schedule(() => {
            this.timeout = null;
            this.checkExpiration();
            this.scheduleExpiration();
        }, Math.min(Math.max(remaining, 0), MAX_TIMEOUT_MILLISECONDS));
    }
}
