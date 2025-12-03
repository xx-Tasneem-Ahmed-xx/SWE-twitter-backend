import { getKeys } from "@/application/services/secrets";

let secretValues: Secrets | null = null;

const SECRET_KEYS = [
  "PORT",
  "JWT_SECRET",
  "PEPPER",
  "DOMAIN",
  "CLIENT_DOMAIN",
  "GITHUB_CLIENT_ID",
  "GITHUB_RED_URL",
  "RED_URL_PRD",
  "GOOGLE_STATE",
  "FRONTEND_URL",
  "Mail_email",
  "Mail_password",
  "BULLMQ_REDIS_HOST",
  "BULLMQ_REDIS_PORT",
  "REDIS_PASSWORD",
  "RED_URL",
  "NODE_ENV",
  "DEBUG",
  "REDIS_SECRET_CACHE_KEY",
  "FIREBASE_KEY_PATH",
  "GROQ_API_KEY",
  "COOKIE_DOMAIN",
] as const;

type SecretKey = (typeof SECRET_KEYS)[number];

interface Secrets {
  PORT: String;
  JWT_SECRET: string;
  PEPPER: string;
  DOMAIN: string;
  CLIENT_DOMAIN: string;
  COOKIE_DOMAIN: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  redirectUri: string;
  google_state: string;
  githubClientId: string;
  githubRedirectUrl: string;
  githubState: string;
  FRONTEND_URL: string;
  domain: string;
  Mail_email: string;
  Mail_password: string;
  BULLMQ_REDIS: {
    HOST: string;
    PORT: number;
    PASSWORD: string;
  };
  REDIS_URL: string;
  NODE_ENV: string;
  DEBUG: string;
  REDIS_SECRET_CACHE_KEY: string;
  FIREBASE_KEY_PATH: string;
  GROQ_API_KEY: string;
}

export async function loadSecrets() {
  const keys = await getKeys<Record<SecretKey, string>>(SECRET_KEYS);

  secretValues = {
    PORT: keys.PORT!,
    JWT_SECRET: keys.JWT_SECRET!,
    PEPPER: keys.PEPPER!,
    DOMAIN: keys.DOMAIN!,
    CLIENT_DOMAIN: keys.CLIENT_DOMAIN!,
    COOKIE_DOMAIN: keys.COOKIE_DOMAIN!,
    client_id: keys.GITHUB_CLIENT_ID!,
    client_secret: keys.GITHUB_CLIENT_ID!,
    redirect_uri: keys.GITHUB_RED_URL!,
    redirectUri: keys.RED_URL_PRD!,
    google_state: keys.GOOGLE_STATE!,
    githubClientId: keys.GITHUB_CLIENT_ID!,
    githubRedirectUrl: keys.GITHUB_RED_URL!,
    githubState: keys.GOOGLE_STATE!,
    FRONTEND_URL: keys.FRONTEND_URL!,
    domain: keys.DOMAIN!,
    Mail_email: keys.Mail_email!,
    Mail_password: keys.Mail_password!,
    BULLMQ_REDIS: {
      HOST: keys.BULLMQ_REDIS_HOST!,
      PORT: Number(keys.BULLMQ_REDIS_PORT!),
      PASSWORD: keys.REDIS_PASSWORD!,
    },
    REDIS_URL: keys.RED_URL!,
    NODE_ENV: keys.NODE_ENV!,
    DEBUG: keys.DEBUG!,
    REDIS_SECRET_CACHE_KEY: keys.REDIS_SECRET_CACHE_KEY!,
    FIREBASE_KEY_PATH: keys.FIREBASE_KEY_PATH!,
    GROQ_API_KEY: keys.GROQ_API_KEY!,
  } as Secrets;
}

export function getSecrets(): Secrets {
  if (!secretValues) {
    throw new Error("Secrets not loaded yet");
  }
  return secretValues;
}
