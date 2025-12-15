import { emailQueue } from "../queues/index";
import type { EmailJobData } from "../types/jobs";
import { emailTemplates } from "@/application/utils/emailTemplates";

export const enqueueEmailJob = async (payload: EmailJobData) => {
  console.log("[enqueueEmailJob] Adding email job to queue:", payload);
  try {
    await emailQueue.add("emails", payload, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });
    console.log(
      "[enqueueEmailJob] Job added successfully:",
      payload.templateType
    );
  } catch (err) {
    console.error("[enqueueEmailJob] Failed to add job:", err);
  }
};

// 1. Email Verification Code (Signup)
export const enqueueVerifyEmail = async (
  email: string,
  name: string,
  code: string
) => {
  console.log("[enqueueVerifyEmail] Called with:", { email, name, code });
  const { subject, message } = emailTemplates.verifyEmail({ name, code });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "verifyEmail",
  });
};

// 2. Welcome Email
export const enqueueWelcomeEmail = async (email: string, name: string) => {
  console.log("[enqueueWelcomeEmail] Called with:", { email, name });
  const { subject, message } = emailTemplates.welcome({ name, email });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "welcome",
  });
};

// 3. Simple Login Alert
export const enqueueLoginAlertEmail = async (
  email: string,
  username: string
) => {
  console.log("[enqueueLoginAlertEmail] Called with:", { email, username });
  const { subject, message } = emailTemplates.loginAlert({
    username,
    timestamp: new Date().toLocaleString(),
  });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "loginAlert",
  });
};

// 4. Password Reset Code
export const enqueuePasswordResetEmail = async (
  email: string,
  username: string,
  code: string
) => {
  console.log("[enqueuePasswordResetEmail] Called with:", {
    email,
    username,
    code,
  });
  const { subject, message } = emailTemplates.passwordReset({ username, code });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "passwordReset",
  });
};

// 5. Password Changed Alert (Simple)
export const enqueuePasswordChangedAlert = async (
  email: string,
  username: string
) => {
  console.log("[enqueuePasswordChangedAlert] Called with:", {
    email,
    username,
  });
  const { subject, message } = emailTemplates.passwordChangedAlert({
    username,
    timestamp: new Date().toLocaleString(),
  });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "passwordChangedAlert",
  });
};

// 6. Password Changed Alert (Detailed)
export const enqueuePasswordChangedDetailed = async (
  email: string,
  params: {
    username: string;
    timezone: string;
    city: string;
    ip: string;
    userAgent: string;
  }
) => {
  console.log("[enqueuePasswordChangedDetailed] Called with:", {
    email,
    ...params,
  });
  const { subject, message } = emailTemplates.passwordChangedDetailed({
    username: params.username,
    email,
    timestamp: new Date().toISOString(),
    timezone: params.timezone || "unknown",
    city: params.city || "unknown",
    ip: params.ip,
    userAgent: params.userAgent || "",
  });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "passwordChangedDetailed",
  });
};

// 7. Email Change Verification Code
export const enqueueEmailChangeVerification = async (
  email: string,
  name: string,
  code: string
) => {
  console.log("[enqueueEmailChangeVerification] Called with:", {
    email,
    name,
    code,
  });
  const { subject, message } = emailTemplates.emailChangeVerification({
    name,
    code,
  });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "emailChangeVerification",
  });
};

// 8. GitHub Login Alert
export const enqueueSecurityLoginGithub = async (
  email: string,
  params: {
    username: string;
    name: string;
    city: string;
    country: string;
    ip: string;
    userAgent: string;
  }
) => {
  console.log("[enqueueSecurityLoginGithub] Called with:", {
    email,
    ...params,
  });
  const { subject, message } = emailTemplates.securityLoginGithub({
    username: params.username,
    name: params.name,
    email,
    timestamp: new Date().toLocaleString(),
    city: params.city || "Unknown",
    country: params.country || "",
    ip: params.ip,
    userAgent: params.userAgent || "Unknown",
  });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "securityLoginGithub",
  });
};

// 9. Google Login Alert
export const enqueueSecurityLoginGoogle = async (
  email: string,
  params: {
    username: string;
    name: string;
    city: string;
    country: string;
    ip: string;
    userAgent: string;
  }
) => {
  console.log("[enqueueSecurityLoginGoogle] Called with:", {
    email,
    ...params,
  });
  const { subject, message } = emailTemplates.securityLoginGoogle({
    username: params.username,
    name: params.name,
    email,
    timestamp: new Date().toLocaleString(),
    city: params.city || "Unknown",
    country: params.country || "",
    ip: params.ip,
    userAgent: params.userAgent || "Unknown",
  });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "securityLoginGoogle",
  });
};

// 10. Email/Password Login Alert (Detailed)
export const enqueueSecurityLoginEmail = async (
  email: string,
  params: {
    username: string;
    name: string;
    city: string;
    country: string;
    ip: string;
    userAgent: string;
  }
) => {
  console.log("[enqueueSecurityLoginEmail] Called with:", { email, ...params });
  const { subject, message } = emailTemplates.securityLoginEmail({
    username: params.username,
    name: params.name,
    email,
    timestamp: new Date().toLocaleString(),
    city: params.city || "Unknown",
    country: params.country || "",
    ip: params.ip,
    userAgent: params.userAgent || "Unknown",
  });
  await enqueueEmailJob({
    to: email,
    subject,
    message,
    templateType: "securityLoginEmail",
  });
};
