import { SetMetadata } from '@nestjs/common';

export const SKIP_SUCCESS_WRAPPER_KEY = 'skipSuccessWrapper';

/** Bypass the global JSON success envelope (used for the SSE stream). */
export const SkipSuccessWrapper = () =>
  SetMetadata(SKIP_SUCCESS_WRAPPER_KEY, true);
