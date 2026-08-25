/**
 * Release-safe, non-fatal error reporting.
 * Native Crashlytics is unavailable in Expo Go, so every call is best-effort.
 * Never attach tokens, e-mail addresses or other credentials here.
 */
let crashlytics: any = null;

try {
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch {
  // Native module is intentionally optional in development clients.
}

type SafeAttribute = string | number | boolean | undefined | null;

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error('Unknown non-fatal error');
}

export function reportNonFatal(
  error: unknown,
  context: string,
  attributes: Record<string, SafeAttribute> = {},
): void {
  if (!crashlytics) return;

  try {
    const instance = crashlytics();
    const cleanAttributes = Object.fromEntries(
      Object.entries(attributes)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value).slice(0, 100)]),
    );

    instance.log(context.slice(0, 200));
    if (Object.keys(cleanAttributes).length > 0) {
      instance.setAttributes(cleanAttributes);
    }
    instance.recordError(toError(error), context.slice(0, 100));
  } catch {
    // Reporting must never break the user flow.
  }
}
