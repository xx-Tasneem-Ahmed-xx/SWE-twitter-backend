// utils/emailTemplates.ts

interface VerifyEmailParams {
  name: string;
  code: string;
}

interface WelcomeEmailParams {
  name: string;
  email: string;
}

interface SimpleLoginAlertParams {
  username: string;
  timestamp: string;
}

interface PasswordResetParams {
  username: string;
  code: string;
}

interface PasswordChangedAlertParams {
  username: string;
  timestamp: string;
}

interface DetailedPasswordChangeParams {
  username: string;
  email: string;
  timestamp: string;
  timezone: string;
  city: string;
  ip: string;
  userAgent: string;
}

interface EmailChangeVerificationParams {
  name: string;
  code: string;
}

interface SecurityLoginParams {
  username: string;
  name: string;
  email: string;
  timestamp: string;
  city: string;
  country: string;
  ip: string;
  userAgent: string;
}

export const emailTemplates = {
  // 1. Email Verification Code (Signup)
  verifyEmail: ({ name, code }: VerifyEmailParams) => ({
    subject: "Verify Your Email Address",
    message: `Hello ${name},

Thank you for signing up to Artimesa!

To complete your registration and verify your email address, please enter the verification code below:

Your verification code: ${code}

This code will expire in 15 minutes.

If you didn't sign up for this account, you can safely ignore this message.

Welcome aboard,
— The Artemisa Team`,
  }),

  // 2. Welcome Email (Registration Complete)
  welcome: ({ name, email }: WelcomeEmailParams) => ({
    subject: "Welcome to Artimesa",
    message: `Hello ${name},

Your registration is now complete!

You can log in anytime using your email: ${email}

We're thrilled to have you on board at Artimesa — enjoy exploring our community!

If you didn't create this account, please contact our support team immediately.

— The Artimesa Team`,
  }),

  // 3. Simple Login Alert
  loginAlert: ({ username, timestamp }: SimpleLoginAlertParams) => ({
    subject: "Account Access Alert",
    message: `Hello ${username},

Your account was just accessed!

Time: ${timestamp}

If this was not you, immediately change your password!

— The Artemisa Team`,
  }),

  // 4. Password Reset Code
  passwordReset: ({ username, code }: PasswordResetParams) => ({
    subject: "Password Reset Request",
    message: `Hi ${username},

You requested a password reset for your Artemisa account.

Your password reset code is: ${code}

This code is valid for 15 minutes.

If you didn't request this change, please ignore this email or contact Artemisa support immediately.

— The Artemisa Team`,
  }),

  // 5. Password Changed Alert (Simple)
  passwordChangedAlert: ({ username, timestamp }: PasswordChangedAlertParams) => ({
    subject: "Password Changed",
    message: `Hello ${username},

Your password was just changed!

Time: ${timestamp}

If this wasn't you, secure your account immediately!

— Artemisa Team`,
  }),

  // 6. Password Changed Alert (Detailed)
  passwordChangedDetailed: ({
    username,
    email,
    timestamp,
    timezone,
    city,
    ip,
    userAgent,
  }: DetailedPasswordChangeParams) => ({
    subject: "Password Changed - Account Security Alert",
    message: `Hi, ${username || "user"}

We're letting you know that the password for your account (${email}) was just changed.

Time: ${timestamp}
Location: ${timezone}, ${city}
IP Address: ${ip}
Device: ${userAgent}

If you did NOT change your password, please secure your account immediately.

— The Artemisa Team`,
  }),

  // 7. Email Change Verification Code
  emailChangeVerification: ({ name, code }: EmailChangeVerificationParams) => ({
    subject: "Email Change Verification Code",
    message: `Hi ${name || "there"},

You requested to change your account email. Use the verification code below to confirm:

${code}

This code will expire in 15 minutes

If you didn't request this, please ignore this message.

— Artemsia team`,
  }),

  // 8. GitHub Login Alert
  securityLoginGithub: ({
    username,
    name,
    timestamp,
    city,
    country,
    ip,
    userAgent,
  }: SecurityLoginParams) => ({
    subject: "New GitHub Login to Your Account",
    message: `Hello, ${username || name}

We noticed a new login to your account via GitHub.

Time: ${timestamp}
Location: ${city || "Unknown"}, ${country || ""}
IP Address: ${ip}
Device: ${userAgent || "Unknown"}

Your login was successful

If this wasn't you, please reset your password or contact support immediately.

— The Artemisa Security Team`,
  }),

  // 9. Google Login Alert
  securityLoginGoogle: ({
    username,
    name,
    timestamp,
    city,
    country,
    ip,
    userAgent,
  }: SecurityLoginParams) => ({
    subject: "New Google Login to Your Account",
    message: `Hello, ${username || name}

We noticed a new login to your account via Google.

Time: ${timestamp}
Location: ${city || "Unknown"}, ${country || ""}
IP Address: ${ip}
Device: ${userAgent || "Unknown"}

Your login was successful

If this wasn't you, please reset your password or contact support immediately.

— The Artemisa Security Team`,
  }),

  // 10. Email/Password Login Alert (Detailed)
  securityLoginEmail: ({
    username,
    name,
    email,
    timestamp,
    city,
    country,
    ip,
    userAgent,
  }: SecurityLoginParams) => ({
    subject: "New Login to Your Account",
    message: `Hi, ${username || name}

We noticed a new login to your account (${email}).

Time: ${timestamp}
Location: ${city || "Unknown"}, ${country || ""}
IP Address: ${ip}
Device: ${userAgent || "Unknown"}

If this was you — awesome! You're all set

If this wasn't you, please secure your account immediately.

— The Artemisa Security Team`,
  }),
};

export type EmailTemplateType = keyof typeof emailTemplates;