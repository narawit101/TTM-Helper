export const CACHE_KEYS = {
  userById: (userId: string) => `user:${userId}`,
  authThrottle: (email: string) => `auth:throttle:${email.toLowerCase()}`,
  refreshToken: (tokenId: string) => `refresh:${tokenId}`
};
