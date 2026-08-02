export default () => {
  // Validate that critical secrets are set (strict check moved to main.ts bootstrap)
  // This file returns undefined for missing secrets — the bootstrap validates and fails early.

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
      // NOTE: No fallback defaults! Must be set via environment variables.
      // The bootstrap process in main.ts validates these are present and
      // fails with a clear error if they are not.
      accessSecret: process.env.JWT_ACCESS_SECRET,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || '30', 10),
    },

    loginSecurity: {
      maxFailedAttempts: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS || '5', 10),
      lockoutDurationMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '30', 10),
    },

    security: {
      hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000', 10), // 1 year
      hstsIncludeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
      // CSP directives — customize for your deployment
      cspDirectives: process.env.CSP_DIRECTIVES || "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';",
    },

    // ======================================================================
    // SECURITY WARNING: Never hardcode secrets in config files.
    // All secrets (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATABASE_URL,
    // STRIPE_SECRET_KEY, etc.) MUST be set via environment variables or
    // a .env file that is NOT committed to version control.
    // ======================================================================
  };
};
