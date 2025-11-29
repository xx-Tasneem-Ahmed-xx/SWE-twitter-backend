import { getKey } from "@/application/services/secrets";

let secretValues: any = null;

export async function loadSecrets() {
  secretValues = {
    JWT_SECRET: await getKey("JWT_SECRET"),
    PEPPER: await getKey("PEPPER"),
    DOMAIN: await getKey("DOMAIN"),
    CLIENT_DOMAIN: await getKey("CLIENT_DOMAIN"),
    //google
    client_id: await getKey("CLIENT_ID"),
    client_secret: await getKey("CLIENT_SECRET"),
    redirect_uri: await getKey("RED_URL_PRD"),
    google_state: await getKey("GOOGLE_STATE"),
    //github
    redirectUri: await getKey("GITHUB_RED_URL"),
    GITHUB_CLIENT_SECRET: await getKey("GITHUB_CLIENT_SECRET"),
    githubClientId: await getKey("GITHUB_CLIENT_ID"),
    
    githubState: await getKey("GITHUB_STATE"),
//github front
  GITHUB_RED_URL_FRONT: await getKey("GITHUB_RED_URL_FRONT"),
    GITHUB_SECRET_FRONT: await getKey("GITHUB_SECRET_FRONT"),
    GITHUB_CLIENT_ID_FRONT: await getKey("GITHUB_CLIENT_ID_FRONT"),
//
    FRONTEND_URL: await getKey("FRONTEND_URL"),
    domain: await getKey("DOMAIN"),
    Mail_email: await getKey("Mail_email"),
    Mail_password: await getKey("Mail_password"),
    BULLMQ_REDIS: {
      HOST: await getKey("BULLMQ_REDIS_HOST"),
      PORT: Number(await getKey("BULLMQ_REDIS_PORT")),
      PASSWORD: await getKey("REDIS_PASSWORD"),
    },
    REDIS_URL: await getKey("RED_URL"),
    NODE_ENV: await getKey("NODE_ENV"),
    DEBUG: await getKey("DEBUG"),
    REDIS_SECRET_CACHE_KEY: await getKey("REDIS_SECRET_CACHE_KEY"),
    FIREBASE_KEY_PATH: await getKey("FIREBASE_KEY_PATH"),
  };
}

export function getSecrets() {
  if (!secretValues) {
    throw new Error("Secrets not loaded yet");
  }
  return secretValues;
}
