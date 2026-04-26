export const APP_NAME = "Frimee";
export const APP_DESCRIPTION = "Organiza planes, viajes y grupos";

export const APP_ICON_PATHS = {
  primary: "/logo_app_frimee.png",
  appleTouch: "/apple-touch-icon.png",
  icon192: "/icon-192.png",
  icon512: "/icon-512.png",
} as const;

export const APP_DEEP_LINK_SCHEME = "fremee";
export const APP_AUTH_CALLBACK_PATH = "/auth/callback";
export const APP_AUTH_CALLBACK_URI = `${APP_DEEP_LINK_SCHEME}://${APP_AUTH_CALLBACK_PATH.replace(/^\//, "")}`;

export const DEFAULT_LIVEKIT_URL = "wss://frimee-zxm2er85.livekit.cloud";
export const DEFAULT_SUPABASE_PROFILE_IMAGES_BUCKET = "profile-images";

export const DEFAULT_PLAN_COVER_IMAGE = {
  mobile: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=400&q=60",
  desktop: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=70",
} as const;
