export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://frimee.es";

export const APP_LOGIN_URL = `${APP_URL}/login`;
export const APP_REGISTER_URL = `${APP_URL}/register`;
// Enters the app as a guest with a demo trip, no sign-up (fremee/src/app/invitado).
export const APP_GUEST_URL = `${APP_URL}/invitado`;
