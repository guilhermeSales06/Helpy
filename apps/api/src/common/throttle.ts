// Attempts allowed per IP in one minute. Only login and register use them.
export const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
export const REGISTER_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
