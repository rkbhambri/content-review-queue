import { Injectable } from '@nestjs/common';

/**
 * Indirection over the system clock. Production uses the real time, while tests
 * can swap in a controllable clock to exercise the 20-minute expiry window
 * deterministically (no real waiting).
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }

  /** Convenience: a Date `minutes` into the future from "now". */
  inMinutes(minutes: number): Date {
    return new Date(this.now().getTime() + minutes * 60_000);
  }
}
