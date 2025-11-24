import { getKey } from "@/application/services/secrets";

let secretValues: any = null;

export async function loadSecrets() {
  secretValues = {
    JWT_SECRET: await getKey("JWT_SECRET"),
    PEPPER: await getKey("PEPPER"),
    DOMAIN: await getKey("DOMAIN"),
    CLIENT_DOMAIN: await getKey("CLIENT_DOMAIN"),
    client_id: await getKey("GITHUB_CLIENT_ID"),
    client_secret: await getKey("GITHUB_CLIENT_ID"),
    redirect_uri: await getKey("GITHUB_RED_URL"),
    redirectUri: await getKey("RED_URL_PRD"),
    google_state: await getKey("GOOGLE_STATE"),
    githubClientId: await getKey("GITHUB_CLIENT_ID"),
    githubRedirectUrl: await getKey("GITHUB_RED_URL"),
    githubState: await getKey("GITHUB_STATE"),
    FRONTEND_URL: await getKey("FRONTEND_URL"),
    domain: await getKey("DOMAIN"),
    Mail_email: await getKey("Mail_email"),
    Mail_password: await getKey("Mail_password"),
  };
}

export function getSecrets() {
  if (!secretValues) {
    throw new Error("Secrets not loaded yet");
  }
  return secretValues;
}
