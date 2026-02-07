import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening (default: 5)
  successThreshold: number;    // Successes in half-open to close (default: 3)
  timeout: number;             // Ms before trying half-open (default: 30000)
  halfOpenMaxCalls: number;    // Max calls in half-open (default: 3)
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private halfOpenCalls = 0;
  private readonly logger = new Logger('CircuitBreaker');

  // Metrics
  private totalCalls = 0;
  private failedCalls = 0;
  private successfulCalls = 0;
  private rejectedCalls = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      halfOpenMaxCalls: 3,
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        this.rejectedCalls++;
        throw new Error(`Circuit breaker [${this.name}] is OPEN`);
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.rejectedCalls++;
        throw new Error(`Circuit breaker [${this.name}] half-open limit reached`);
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successfulCalls++;
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  private onFailure(): void {
    this.failedCalls++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failures >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime >= this.config.timeout
    );
  }

  private transitionTo(newState: CircuitState): void {
    this.logger.log(`Circuit [${this.name}]: ${this.state} -> ${newState}`);
    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenCalls = 0;
      this.successes = 0;
    }
  }

  getState(): CircuitState { return this.state; }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalCalls: this.totalCalls,
      failedCalls: this.failedCalls,
      successfulCalls: this.successfulCalls,
      rejectedCalls: this.rejectedCalls,
      failureRate: this.totalCalls > 0 ? this.failedCalls / this.totalCalls : 0,
    };
  }

  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.totalCalls = 0;
    this.failedCalls = 0;
    this.successfulCalls = 0;
    this.rejectedCalls = 0;
  }
}
