const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F-\u009F]/g;

export const MAX_EMAIL_LENGTH = 320;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeEmailInput(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.normalize("NFKC").replace(CONTROL_CHARS_REGEX, "").trim().toLowerCase();
}

export function isValidEmailInput(value: string) {
  return value.length > 0 && value.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(value);
}
