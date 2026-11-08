// On client-side navigation, a parallel route slot keeps showing what it had when the new URL
// has no match in it (default.tsx only applies on a full page load). Without this, opening a
// plan as an overlay and then going to e.g. /calendar changed the URL but left the plan, chat
// included, on top. Any route other than the intercepted ones beside it (more specific, so
// they still win) now empties the slot and closes the overlay.
//
// scripts/build-mobile.mjs moves this folder out for the static export, like the
// intercepted routes: the app does not use the overlay.
export default function CloseModalSlot() {
  return null;
}
