import { Container, getContainer } from '@cloudflare/containers';

export class NepaApi extends Container {
  defaultPort = 4000;
  sleepAfter = '15m';
  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = {
      MONGO_URL: env.MONGO_URL, JWT_SECRET: env.JWT_SECRET, CORS_ORIGIN: env.CORS_ORIGIN || '*',
      SMTP_HOST: env.SMTP_HOST, SMTP_PORT: env.SMTP_PORT, SMTP_SECURE: env.SMTP_SECURE,
      SMTP_USER: env.SMTP_USER, SMTP_PASS: env.SMTP_PASS, SMTP_FROM: env.SMTP_FROM,
      RESEND_API_KEY: env.RESEND_API_KEY, RESEND_FROM: env.RESEND_FROM,
      GMAIL_OAUTH_CLIENT_ID: env.GMAIL_OAUTH_CLIENT_ID,
      GMAIL_OAUTH_CLIENT_SECRET: env.GMAIL_OAUTH_CLIENT_SECRET,
      GMAIL_OAUTH_REFRESH_TOKEN: env.GMAIL_OAUTH_REFRESH_TOKEN,
      GMAIL_FROM: env.GMAIL_FROM,
      TURN_KEY_ID: env.TURN_KEY_ID, TURN_API_TOKEN: env.TURN_API_TOKEN,
      TURN_URL: env.TURN_URL, TURN_USERNAME: env.TURN_USERNAME, TURN_CREDENTIAL: env.TURN_CREDENTIAL,
      SEED_USERNAME: env.SEED_USERNAME, SEED_EMAIL: env.SEED_EMAIL, SEED_PASSWORD: env.SEED_PASSWORD,
    };
  }
}

export default {
  fetch: (req, env) => getContainer(env.NEPA_API).fetch(req),
};
