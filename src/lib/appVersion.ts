declare const __BUILD_HASH__: string;
export const APP_VERSION = typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "dev";