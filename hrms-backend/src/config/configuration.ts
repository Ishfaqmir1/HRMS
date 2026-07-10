export default () => {
  // Warn if JWT secrets are using development fallbacks
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.warn(
      '⚠️  WARNING: JWT secrets not set via environment variables. ' +
      'Using development fallbacks. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in production.',
    );
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    corsOrigin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],

    database: {
      url: process.env.DATABASE_URL,
    },

    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },

    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_in_production',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_production',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    },

    // ======================================================================
    // SECURITY WARNING: Never hardcode secrets in config files.
    // All secrets (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATABASE_URL,
    // STRIPE_SECRET_KEY, etc.) MUST be set via environment variables or
    // a .env file that is NOT committed to version control.
    // ======================================================================
  };
};
