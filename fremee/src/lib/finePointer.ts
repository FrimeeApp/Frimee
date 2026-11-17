/**
 * Mouse or trackpad (not a touch screen). On phones, focusing a field when a sheet opens makes
 * iOS Safari scroll the sheet for the keyboard and the field ends up hidden: there the user taps it.
 */
export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}
