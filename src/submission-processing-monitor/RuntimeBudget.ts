const DEFAULT_SAFETY_MARGIN_MS = 2 * 60 * 1000; // 2 minutes

export interface RuntimeBudgetOptions {
  /** @default 120_000 (2 minutes) */
  safetyMarginMs?: number;
}

/**
 * Wraps a Lambda's context.getRemainingTimeInMillis() with a safety margin before the hard
 * timeout, so scanning code can stop on a page/batch boundary instead of getting killed mid-call.
 */
export class RuntimeBudget {
  private readonly safetyMarginMs: number;

  constructor(private readonly getRemainingTimeInMillis: () => number, options: RuntimeBudgetOptions = {}) {
    this.safetyMarginMs = options.safetyMarginMs ?? DEFAULT_SAFETY_MARGIN_MS;
  }

  hasTimeRemaining(): boolean {
    return this.getRemainingTimeInMillis() > this.safetyMarginMs;
  }

  /** For logging - how much time is left on the Lambda invocation, not adjusted for the safety margin. */
  remainingMs(): number {
    return this.getRemainingTimeInMillis();
  }
}
