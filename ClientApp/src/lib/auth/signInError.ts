// Which `auth.*` message the login screen shows when a sign-in is refused.
//
// The server tells ONE case apart: a national id with no account at all comes
// back as `not_registered`, so someone who mistyped a digit of a fourteen-digit
// number is told that, instead of being left to retry the same number against
// the password.
//
// Everything else falls to the default — a wrong password, a disabled account,
// a refused master password, a dropped connection. They deliberately share one
// message: for a national id that DOES have an account, nothing here says which
// half was wrong.
import { ApiError } from '../api/http';

/** Server error code → the key under `auth.` in the translation files. */
const SIGN_IN_ERRORS: Record<string, string> = {
  not_registered: 'notRegistered',
};

const DEFAULT_SIGN_IN_ERROR = 'signInError';

export function signInErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return DEFAULT_SIGN_IN_ERROR;
  return SIGN_IN_ERRORS[error.code] ?? DEFAULT_SIGN_IN_ERROR;
}
