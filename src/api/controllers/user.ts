import dotenv from "dotenv";
dotenv.config();
import * as utils from "../../application/utils/tweets/utils";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import zxcvbn from "zxcvbn";
import qrcode from "qrcode";
import speakeasy from "speakeasy";
import { addNotification } from "./notificationController";
import prisma from "../../database";
import { redisClient } from "../../config/redis";
import fetch from "node-fetch";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { AppError } from "@/errors/AppError";
import axios from 'axios';
import qs from 'querystring';

// --- Custom Type Definitions ---
interface LocalJwtPayload extends JwtPayload {
  Username?: string;
  username?: string;
  email: string;
  id: string;
  version: number;
  jti: string;
  devid: string | null;
}

type UUID = `${string}-${string}-${string}-${string}-${string}`;

interface PrismaUser {
  id: string;
  username: string;
  name: string;
  email: string;
  password: string;
  saltPassword: string;
  tokenVersion: number;
  tfaVerifed: boolean;
  loginCodesSet: boolean;
  loginCodes: string | null;
  dateOfBirth: Date;
  isEmailVerified: boolean;
  otp: string | null;
}

// --- Environment Variables ---
const JWT_SECRET: string = process.env.JWT_SECRET || "changeme";
const PEPPER: string = process.env.PEPPER || "";
const DOMAIN: string = process.env.DOMAIN || "localhost";
const CLIENT_DOMAIN: string = process.env.CLIENT_DOMAIN || "localhost";

// --- Helper Functions ---
function timingSafeEqual(a: string | Buffer | number | object, b: string | Buffer | number | object): boolean {
  try {
    const A: Buffer = Buffer.from(String(a));
    const B: Buffer = Buffer.from(String(b));
    if (A.length !== B.length) {
      return false;
    }
    return crypto.timingSafeEqual ? crypto.timingSafeEqual(A, B) : A.equals(B);
  } catch (e) {
    return false;
  }
}

function gen6(): string {
  return Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
}

function generateJwt({ username, email, id, expiresInSeconds, version, devid }: {
  username: string;
  email: string;
  id: string;
  expiresInSeconds: number | undefined;
  version: number | undefined;
  devid: string | null | undefined;
}): { token: string; jti: string; payload: LocalJwtPayload } {
  const jti: string = uuidv4();
  const now: number = Math.floor(Date.now() / 1000);
  const payload: LocalJwtPayload = {
    Username: username,
    email,
    id,
    exp: now + (expiresInSeconds || 900),
    iat: now,
    version: version || 0,
    jti,
    devid: devid || null,
  };
  const token: string = jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
  return { token, jti, payload };
}

function validateJwt(token: string): { ok: boolean; payload?: LocalJwtPayload; err?: Error } {
  try {
    const payload: LocalJwtPayload = jwt.verify(token, JWT_SECRET) as LocalJwtPayload;
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, err: err as Error };
  }
}

/* --------------------- Controller Functions --------------------- */

export async function Create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input: any = req.body;

    if (!input || !input.email || !input.name || !input.dateOfBirth) {
      throw new AppError("Missing required fields", 400);
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new AppError("Email already in use", 409);
    }

    const isWebClient = req.headers["x-client-type"] === "web";
    const exist: number = await redisClient.exists(`signup_captcha:passed:${input.email}`);
    
    if (!exist && isWebClient) {
      throw new AppError("You must solve Captcha first", 401);
    } else {
      await redisClient.del(`signup_captcha:passed:${input.email}`);
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new AppError("Invalid email format", 400);
    }

    const code: string = gen6();
    await redisClient.set(`Signup:code:${input.email}`, code, { EX: 15 * 60 });

    const message: string = `Subject: Verify Your Email Address 🚀

Hello ${input.name},

Thank you for signing up to Artimesa! 🎉  
To complete your registration and verify your email address, please enter the verification code below:

🔐 Your verification code: ${code}

This code will expire in 15 minutes. ⏳  
If you didn't sign up for this account, you can safely ignore this message.

Welcome aboard,  
— The Artemisa Team 🛡️
`;
    
    utils.SendEmailSmtp(res, input.email, message).catch((err) => {
      throw new AppError("Failed to send verification email", 500);
    });

    await redisClient.set(`Signup:user:${input.email}`, JSON.stringify(input), { EX: 60 * 60 });

    const exists: number = await prisma.user.count({ 
      where: { email: input.email, isEmailVerified: true } 
    });
    
    if (exists === 0) {
      return utils.SendRes(res, { 
        message: "User registered successfully. Please verify your email to continue." 
      });
    }
    
    return utils.SendRes(res, { message: "Email already verified" });
  } catch (err) {
    next(err);
  }
}

export async function SignupCaptcha(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let email: string | undefined;
    const emailQuery = req.query.email;
    
    if (typeof emailQuery === "string") {
      email = emailQuery;
    } else if (Array.isArray(emailQuery) && typeof emailQuery[0] === "string") {
      email = emailQuery[0];
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Valid email is required", 400);
    }

    await redisClient.set(`signup_captcha:passed:${email}`, "1", { EX: 15 * 60 });
    return utils.SendRes(res, { Message: "You passed the Captcha, you can register now" });
  } catch (err) {
    next(err);
  }
}
export async function GetUserEmailById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id;

    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    utils.SendRes(res, { email: user.email });
  } catch (err) {
    next(err);
  }
}
export async function Verify_signup_email(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      throw new AppError("Email and code are required", 400);
    }

    const stored: string | null = await redisClient.get(`Signup:code:${email}`);
    
    if (!stored) {
      throw new AppError("Verification session expired, please sign up again", 400);
    }

    if (stored !== code) {
      throw new AppError("Verification code is incorrect", 401);
    }

    const userJson: string | null = await redisClient.get(`Signup:user:${email}`);
    
    if (!userJson) {
      throw new AppError("User data not found, please sign up again", 400);
    }

    const input: any = JSON.parse(userJson);
    await redisClient.set(`Signup:verified:${email}`, JSON.stringify(input), { EX: 15 * 60 });
    await redisClient.del(`Signup:code:${email}`);

    return utils.SendRes(res, { 
      message: "Email verified successfully, please set your password." 
    });
  } catch (err) {
    next(err);
  }
}

export async function FinalizeSignup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const userJson: string | null = await redisClient.get(`Signup:verified:${email}`);
    
    if (!userJson) {
      throw new AppError("You must verify your email first", 400);
    }

    const input: any = JSON.parse(userJson);

    let username: string = input.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!username) username = `user${Math.floor(Math.random() * 10000)}`;
    
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) username = `${username}${Math.floor(Math.random() * 10000)}`;

    const salt: string = crypto.randomBytes(16).toString("hex");
    const hashed: string = await utils.HashPassword(password, salt);

    let parsedDate: Date = new Date(input.dateOfBirth);
    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date("2001-11-03T00:00:00.000Z");
    }

    const created: PrismaUser = await prisma.user.create({
      data: {
        username,
        name: input.name,
        email: input.email,
        password: hashed,
        saltPassword: salt,
        isEmailVerified: true,
        dateOfBirth: parsedDate,
      },
    }) as unknown as PrismaUser;

    await utils.AddPasswordHistory(hashed, created.id);
    await redisClient.del(`Signup:verified:${email}`);

    const { devid, deviceRecord } = await utils.SetDeviceInfo(req, res, email);

    const { token: accessToken, jti } = await utils.GenerateJwt({
      username: created.username,
      email: created.email,
      id: created.id,
      role: "user",
      expiresInSeconds:  60*60,
      version: 0,
      devid,
    });

    const { token: refreshToken } = await utils.GenerateJwt({
      username: created.username,
      email: created.email,
      id: created.id,
      role: "user",
      expiresInSeconds: 60 * 60 * 24 * 30,
      version: 0,
      devid,
    });

    await redisClient.set(`refreshToken:${created.id}`, refreshToken, { EX: 60 * 60 * 24 * 30 });
    await utils.SetSession(req, created.id, jti);

    const completeMsg = `Subject: Welcome to Artimesa 🎉

Hello ${created.name},

Your registration is now complete! ✅  
You can log in anytime using your email: ${created.email}

We're thrilled to have you on board at Artimesa — enjoy exploring our community! 🌟

If you didn't create this account, please contact our support team immediately.

— The Artimesa Team 🛡️
`;
    
    utils.SendEmailSmtp(res, created.email, completeMsg).catch((err) => {
      throw new AppError("Failed to send welcome email", 500);
    });

    return utils.SendRes(res, {
      message: "Signup complete. Welcome!",
      user: {
        id: created.id,
        username: created.username,
        name: created.name,
        email: created.email,
        dateOfBirth: created.dateOfBirth,
        isEmailVerified: created.isEmailVerified,
      },
      device: deviceRecord,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function Login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Enter valid email", 403);
    }

    const clientType = req.headers["x-client-type"] || "web";
    const stop = await utils.Attempts(res, email, clientType);
    if (stop) return;

    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    
    if (!user) {
      await utils.IncrAttempts(res, email);
      throw new AppError("Try again and enter your info correctly", 401);
    }

    const ok: boolean = await utils.CheckPass(password + user.saltPassword, user.password);
    
    if (!ok) {
      await utils.IncrAttempts(res, email);
      throw new AppError("Invalid credentials", 401);
    }

    await utils.RestAttempts(email);

    const { devid, deviceRecord } = await utils.SetDeviceInfo(req, res, email);

    const accessObj = await utils.GenerateJwt({
      username: user.username,
      email,
      id: user.id,
      expiresInSeconds: 60 * 60,
      version: user.tokenVersion || 0,
      devid,
      role:"user", 
    });

    const refreshObj = await utils.GenerateJwt({
      username: user.username,
      email,
      id: user.id,
      expiresInSeconds: 30 * 24 * 60 * 60,
      version: user.tokenVersion || 0,
      devid,
       role: "user",
    });

    res.cookie("refresh_token", refreshObj.token, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      domain: CLIENT_DOMAIN,
    });

    await utils.SetSession(req, user.id, refreshObj.jti);

    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const location = await utils.Sendlocation(ip as string);
    
    const emailMessage = `Hello ${user.username},

🚀 Your account was just accessed!

📍 Location: ${location}
💻 Device info: ${deviceRecord || "unknown"}
🕒 Time: ${new Date().toLocaleString()}

If this was not you, immediately change your password!
— The Artemisa Team`;

    utils.SendEmailSmtp(res, email, emailMessage).catch((err) => {
      throw new AppError("Failed to send login notification email", 500);
    });

    // await addNotification(user.id as UUID, {
    //   title: 'LOGIN',
    //   body: `Login from ${deviceRecord || "unknown device"} at ${location}`,
    //   actorId: user.id as UUID,
    // }, (err) => {
    //   if (err) throw new AppError("Failed to create login notification", 500);
    // });

    return utils.SendRes(res, {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        isEmailVerified: user.isEmailVerified,
      },
      DeviceRecord: deviceRecord,
      Token: accessObj.token,
      Refresh_token: refreshObj.token,
      message: "Login successful, email & in-app notification sent"
    });
  } catch (err) {
    next(err);
  }
}

export async function Refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken: string | undefined = req.body?.refresh_token;

    if (!refreshToken) {
      throw new AppError("No refresh token provided in body, cannot renew session", 401);
    }

    const validated = validateJwt(refreshToken);

    if (!validated.ok) {
      throw new AppError("Invalid refresh token, cannot renew session", 401);
    }

    const payload: LocalJwtPayload = validated.payload as LocalJwtPayload;
    const username: string = payload.Username || payload.username || "";
    const email: string = payload.email;
    const id: string = payload.id;
    const version: number = payload.version || 0;

    const { devid } = await utils.SetDeviceInfo(req, res, email);

    const newAccess = await utils.GenerateJwt({
      username,
      email,
      id,
      expiresInSeconds: 60 * 60,
      version,
      devid,
      role: "user",
    });

    const jti: string = uuidv4();
    await utils.SetSession(req, id, jti);

    // Send access token in response body instead of cookie
    return utils.SendRes(res, { access_token: newAccess.token});

  } catch (err) {
    next(err);
  }
}

export async function Logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken: string | undefined = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      throw new AppError("Refresh token expired, you are already logged out", 401);
    }

    const validated = validateJwt(refreshToken);
    
    if (!validated.ok) {
      throw new AppError("Invalid refresh token", 401);
    }

    const header: string | undefined = req.get("Authorization");
    
    if (!header) {
      throw new AppError("No Authorization header provided", 401);
    }
    
    let tokenString: string | null = header.startsWith("Bearer") ? header.slice(6).trim() : null;
    
    if (!tokenString) {
      throw new AppError("Token must start with Bearer", 401);
    }
    
    tokenString = tokenString.replace(/^&\{/, "");

    const accessVal = validateJwt(tokenString);
    
    if (!accessVal.ok) {
      throw new AppError("Invalid token signature", 401);
    }

    if (tokenString === refreshToken) {
      throw new AppError("Token and refresh token cannot be the same", 401);
    }

    const accessPayload: LocalJwtPayload = accessVal.payload as LocalJwtPayload;
    const userId: string | undefined = accessPayload.id || (req as any).user?.id;
    const jti: string | null = accessPayload.jti || req.body?.jti || null;
    
    if (userId && jti) {
      await redisClient.del(`session:${userId}:${jti}`);
    }

    res.clearCookie("refresh_token", { domain: DOMAIN, path: "/" });
    return utils.SendRes(res, { message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
}

export async function Captcha(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const emailQuery = req.query.email;
    let email: string | undefined;
    
    if (Array.isArray(emailQuery)) {
      email = typeof emailQuery[0] === "string" ? emailQuery[0] : undefined;
    } else if (typeof emailQuery === "string") {
      email = emailQuery;
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Valid email is required", 400);
    }
    
    await redisClient.set(`captcha:passed:${email}`, "1", { EX: 15 * 60 });
    return utils.SendRes(res, { Message: "You passed the Captcha, you can login now" });
  } catch (err) {
    next(err);
  }
}

export async function ForgetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    
    if (!email) {
      throw new AppError("Email is required", 400);
    }

    if (await utils.ResetAttempts(res, email)) return;

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      await utils.IncrResetAttempts(res, email);
      throw new AppError("User not found", 404);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const message = `
Hi ${user.username},

You requested a password reset for your Artemisa account.

🔑 Your password reset code is: ${code}

This code is valid for 15 minutes.

If you didn't request this change, please ignore this email or contact Artemisa support immediately.

— The Artemisa Team
`;

    await redisClient.set(`Reset:code:${email}`, code, { EX: 15 * 60 });
    
    utils.SendEmailSmtp(res, email, message).catch((err) => {
      throw new AppError("Failed to send reset code email", 500);
    });

    return utils.SendRes(res, { message: "Reset code sent via email. Check your inbox!" });
  } catch (err) {
    next(err);
  }
}
export async function VerifyResetCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) throw new AppError("Email and reset code are required", 400);

    const storedCode = await redisClient.get(`Reset:code:${email}`);
    if (!storedCode) throw new AppError("Reset code expired or not found", 400);
    if (storedCode !== code) throw new AppError("Invalid reset code", 401);

    return utils.SendRes(res, { message: "Reset code verified, you can now enter a new password" });
  } catch (err) {
    next(err);
  }
}

export async function ResetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError("Email and new password are required", 400);

    const passValidation = await utils.ValidatePassword(password);
    if (passValidation !== "0") throw new AppError(passValidation, 400);

    const salt = crypto.randomBytes(16).toString("hex");
    const hashed = await utils.HashPassword(password, salt);

    await prisma.user.updateMany({ where: { email }, data: { password: hashed, saltPassword: salt } });
    await redisClient.del(`Reset:code:${email}`);
    await utils.RsetResetAttempts(email);

    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser;
    if (user) {
      const { devid, deviceRecord } = await utils.SetDeviceInfo(req, res, email);
      const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const location = await utils.Sendlocation(ip as string);

      const emailMessage = `Hello ${user.username},

🔐 Your password was just changed!

📍 Location: ${location}
💻 Device info: ${deviceRecord || "unknown"}
🕒 Time: ${new Date().toLocaleString()}

If this wasn't you, secure your account immediately!
— Artemisa Team`;

      utils.SendEmailSmtp(res, email, emailMessage).catch(() => {
        throw new AppError("Failed to send password change notification", 500);
      });

      await addNotification(user.id as UUID, {
        title: 'Password_Changed',
        body: `Your password was changed from ${deviceRecord || "unknown device"} at ${location}`,
        actorId: user.id as UUID,
      }, (err) => { if (err) throw new AppError("Failed to create notification", 500) });
    }

    return utils.SendRes(res, { message: "Password reset successfully, notification sent" });
  } catch (err) {
    next(err);
  }
}


export async function ReauthPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Invalid email format", 401);
    }
    
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    
    if (!user) {
      throw new AppError("Enter email or password correctly", 401);
    }
    
    const ok: boolean = await utils.CheckPass(password + user.saltPassword, user.password);
    
    if (!ok) {
      throw new AppError("Enter email or password correctly", 401);
    }
    
    await redisClient.set(`Reauth:${email}`, "1", { EX: 5 * 60 });
    return utils.SendRes(res, { message: "You can change your credentials now" });
  } catch (err) {
    next(err);
  }
}

export async function ReauthTFA(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      throw new AppError("Email and code are required", 400);
    }
    
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    
    if (!user) {
      throw new AppError("Email is not in system", 401);
    }
    
    if (!user.tfaVerifed || !user.otp) {
      throw new AppError("You cannot use 2FA method, it must be enabled first", 403);
    }
    
    const ok: boolean = speakeasy.totp.verify({ 
      secret: user.otp, 
      encoding: "base32", 
      token: code, 
      window: 1 
    });
    
    if (!ok) {
      throw new AppError("Code is not correct, try again", 401);
    }
    
    await redisClient.set(`Reauth:${email}`, "1", { EX: 5 * 60 });
    return utils.SendRes(res, { message: "You can change your credentials now" });
  } catch (err) {
    next(err);
  }
}

export async function ReauthCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      throw new AppError("Email and code are required", 400);
    }
    
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    
    if (!user) {
      throw new AppError("Email is not in system", 401);
    }
    
    if (!user.loginCodesSet) {
      throw new AppError("You cannot use this codes method, it must be enabled first", 403);
    }
    
    const codes: string[] = (user.loginCodes || "").split(",").filter(Boolean);
    let found: boolean = false;
    const copy: string[] = [];
    
    for (const c of codes) {
      if (c === code) {
        found = true;
        continue;
      }
      copy.push(c);
    }
    
    if (!found) {
      throw new AppError("Enter code correctly, try again", 401);
    }
    
    await prisma.user.updateMany({ 
      where: { email }, 
      data: { loginCodes: copy.join(",") } 
    });
    
    await redisClient.set(`Reauth:${email}`, "1", { EX: 5 * 60 });
    return utils.SendRes(res, { message: "You can change your credentials now" });
  } catch (err) {
    next(err);
  }
}

export async function ChangePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
 const email: string | undefined=(req as any ).user?.email
    if (!email || !oldPassword || !newPassword || !confirmPassword) {
      throw new AppError("Please provide email, old password, new password, and confirmation", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const isOldPassValid = await utils.CheckPass(oldPassword, user.password);
    if (!isOldPassValid) {
      throw new AppError("Old password is incorrect", 401);
    }

    const passValidation: string = await utils.ValidatePassword(newPassword);
    if (passValidation !== "0") {
      throw new AppError(passValidation, 400);
    }

    const score: zxcvbn.ZXCVBNResult = utils.AnalisePass(newPassword, user);
    if (score.score < 3) {
      throw new AppError("Your new password is not strong enough", 401);
    }

    if (confirmPassword !== newPassword) {
      throw new AppError("Confirm password does not match the new password", 400);
    }

    const oldPassCheck: string = await utils.NotOldPassword(newPassword, user.id);
    if (oldPassCheck !== "0") {
      throw new AppError(oldPassCheck, 401);
    }

    const salt: string = crypto.randomBytes(16).toString("hex");
    const hashed: string = await utils.HashPassword(newPassword, salt);

    await prisma.user.updateMany({
      where: { email },
      data: { saltPassword: salt, password: hashed, tokenVersion: (user.tokenVersion || 0) + 1 }
    });

    await utils.AddPasswordHistory(hashed, user.id);

    const ip: string = req.ip || (req as any).connection?.remoteAddress || "unknown";
    const geo: utils.GeoData | null = await utils.Sendlocation(ip).catch(() => null);

    const message: string = `Hi, ${user.username || "user"}

We're letting you know that the password for your account (${email}) was just changed.

🕒 Time: ${new Date().toISOString()}
📍 Location: ${geo ? `${geo.Timezone}, ${geo.City}` : "unknown"}
🌐 IP Address: ${ip}
🖥️ Device: ${req.get("User-Agent") || ""}

If you did NOT change your password, please secure your account immediately.
— The Artemisa Team
`;

    utils.SendEmailSmtp(res, email, message).catch(() => {
      throw new AppError("Failed to send password change email", 500);
    });

    return utils.SendRes(res, {
      Message: "Password updated successfully",
      Score: score
    });
  } catch (err) {
    next(err);
  }
}

export async function ChangeEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email: newEmail } = req.body;
    const currentEmail: string | undefined = (req as any).user?.email || req.body?.currentEmail;

    if (!newEmail) throw new AppError("Email is required", 400);
    if (!currentEmail) throw new AppError("Must provide your current email", 401);
    if (newEmail === currentEmail) throw new AppError("New email must be different than the old one", 401);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new AppError("Input email is not valid", 401);

    const user = await prisma.user.findUnique({ where: { email: currentEmail } });
    if (!user) throw new AppError("User not found", 404);

    const exists = await prisma.user.findUnique({ where: { email: newEmail } });
    if (exists) throw new AppError("This email is already in use", 409);

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(code);

    // Store in Redis with 10 min expiration
    await redisClient.setEx(`ChangeEmail:code:${currentEmail}`, 15*60, code);
    await redisClient.setEx(`ChangeEmail:new:${currentEmail}`, 15*60, newEmail);

    // Send verification email with the code
    const msg= `Hi ${user.name || "there"},
        You requested to change your account email. Use the verification code below to confirm:
        ${code}
        This code will expire in 15 minutes
        If you didn’t request this, please ignore this message.
        -Artemsia team
      `;
    await utils.SendEmailSmtp(res, newEmail, msg);

   

    return utils.SendRes(res, { message: "Verification code sent successfully to your new email" });
  } catch (err) {
    next(err);
  }
}




export async function VerifyNewEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email: desiredEmail, code } = req.body;
    const currentEmail: string | undefined = (req as any).user?.email || req.body?.currentEmail;
    
    if (!currentEmail) throw new AppError("Current email is required", 401);
    if (!code) throw new AppError("Verification code is required", 400);

    const storedCode = await redisClient.get(`ChangeEmail:code:${currentEmail}`);
    const storedNewEmail = await redisClient.get(`ChangeEmail:new:${currentEmail}`);

    if (!storedCode || !storedNewEmail) throw new AppError("Verification code not found or expired", 400);
    if (storedCode !== code) throw new AppError("Incorrect verification code", 401);
    if (storedNewEmail !== desiredEmail) throw new AppError("Email mismatch", 401);

    // ✅ Update email and increment token version (optional)
    const user = await prisma.user.update({
      where: { email: currentEmail },
      data: { email: desiredEmail }
    });

    // ✅ Generate new tokens with updated email
    const accessObj = await utils.GenerateJwt({
      username: user.username,
      email: desiredEmail,
      id: user.id,
      expiresInSeconds: 60 * 60, // 1 hour
      version: user.tokenVersion || 0,
      devid: null,
      role: "user"
    });

    const refreshObj = await utils.GenerateJwt({
      username: user.username,
      email: desiredEmail,
      id: user.id,
      expiresInSeconds: 30 * 24 * 60 * 60, // 30 days
      version: user.tokenVersion || 0,
      devid: null,
      role: "user"
    });

    // Set new refresh token cookie
    res.cookie("refresh_token", refreshObj.token, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      domain: CLIENT_DOMAIN,
    });

    // ✅ Optional: delete old Redis codes
    await redisClient.del(`ChangeEmail:code:${currentEmail}`);
    await redisClient.del(`ChangeEmail:new:${currentEmail}`);

    return utils.SendRes(res, {
      message: "Email changed successfully",
      newEmail: desiredEmail,
      Token: accessObj.token,
      Refresh_token: refreshObj.token
    });
  } catch (err) {
    next(err);
  }
}




export async function GetUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email: string | undefined =
      (req as any).user?.email ||
      (req.query?.email as string) ||
      (req.body?.email as string);
    
    if (!email) {
      throw new AppError("User is not authorized for this route", 401);
    }
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      throw new AppError("User not found", 404);
    }
    
    return utils.SendRes(res, {user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        isEmailVerified: user.isEmailVerified,
      },});
  } catch (err) {
    next(err);
  }
}


export async function LogoutALL(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    console.log("req",req);
    
   const id: number | undefined = (req as any).user.id || req.body?.id || (req.query?.id as string);
    
    if (!id) {
      throw new AppError("Unauthorized", 401);
    }
    
    let cursor: string = "0";
    const pattern: string = `session:${id}:*`;
    
    do {
      const scanRes: { cursor: string, keys: string[] } = await redisClient.scan(cursor, { 
        MATCH: pattern, 
        COUNT: 100 
      }) as { cursor: string, keys: string[] };
      
      cursor = scanRes.cursor;
      const keys: string[] = scanRes.keys || [];
      
      if (keys.length) {
        for (const key of keys) {
          const parts: string[] = key.split(":");
          if (parts.length === 3) {
            const jti: string = parts[2];
            await redisClient.set(`Blocklist:${jti}`, "1", { EX: 15 * 60 });
          }
        }
        await redisClient.del(keys);
      }
    } while (cursor !== "0");
    
    return utils.SendRes(res, { message: "You logged out all sessions successfully" });
  } catch (err) {
    next(err);
  }
}

export async function GetSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id: string | undefined =
      (req as any).user?.id || (req.query?.id as string) || req.body?.id;
    
    if (!id) {
      throw new AppError("Unauthorized", 401);
    }
    
    let cursor: string = "0";
    const pattern: string = `User:sessions:${id}:*`;
    const sessions: any[] = [];
    const allKeys: string[] = [];
    
    do {
      const scanRes = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      }) as { cursor: number | string, keys: string[] };
      
      cursor = String(scanRes.cursor);
      const keys: string[] = scanRes.keys || [];
      
      if (keys.length > 0) {
        allKeys.push(...keys);
      }
    } while (cursor !== "0");
    
    for (const key of allKeys) {
      try {
        const listItems = await redisClient.lRange(key, 0, -1);
        
        for (const val of listItems) {
          try {
            const session = JSON.parse(val);
            if (new Date(session.ExpireAt) > new Date()) {
              sessions.push(session);
            }
          } catch (parseErr) {
            throw new AppError("Failed to parse session data", 500);
          }
        }
      } catch (keyErr) {
        throw new AppError(`Error reading session key: ${key}`, 500);
      }
    }
    
    return utils.SendRes(res, sessions);
  } catch (err) {
    next(err);
  }
}

export async function LogoutSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionid: string = req.params.sessionid;
    const userId: string | undefined =
      (req as any).user?.id || req.body?.id || (req.query?.id as string);
    
    if (!sessionid || !userId) {
      throw new AppError("Session ID and User ID are required", 400);
    }
    
    await redisClient.del(`session:${userId}:${sessionid}`);
    await redisClient.set(`Blocklist:${sessionid}`, "1", { EX: 15 * 60 });
    
    return utils.SendRes(res, { message: "Session logged out successfully" });
  } catch (err) {
    next(err);
  }
}

/* --------------------- OAuth Helper Functions --------------------- */

export async function exchangeGithubCode(code: string) {
  try {
    const params = {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_RED_URL,
    };
    
    const resp = await axios.post(
      'https://github.com/login/oauth/access_token', 
      qs.stringify(params), 
      { headers: { 'Accept': 'application/json' } }
    );
    
    return resp.data;
  } catch (err) {
    throw new AppError("Failed to exchange GitHub code", 500);
  }
}

export async function fetchGithubEmails(accessToken: string) {
  try {
    const resp = await axios.get('https://api.github.com/user/emails', {
      headers: { 
        Authorization: `Bearer ${accessToken}`, 
        Accept: 'application/json' 
      }
    });
    return resp.data;
  } catch (err) {
    throw new AppError("Failed to fetch GitHub emails", 500);
  }
}

export async function fetchGithubUser(accessToken: string) {
  try {
    const resp = await axios.get('https://api.github.com/user', {
      headers: { 
        Authorization: `Bearer ${accessToken}`, 
        Accept: 'application/json' 
      }
    });
    return resp.data;
  } catch (err) {
    throw new AppError("Failed to fetch GitHub user", 500);
  }
}

export async function exchangeGoogleCode(code: string) {
  try {
    const params = {
      code,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.RED_URL_PRD,
      grant_type: 'authorization_code'
    };
    
    const resp = await axios.post(
      'https://oauth2.googleapis.com/token', 
      qs.stringify(params), 
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    return resp.data;
  } catch (err) {
    throw new AppError("Failed to exchange Google code", 500);
  }
}

// export async function exchangeLinkedinCode(code: string) {
//   try {
//     const params = {
//       grant_type: 'authorization_code',
//       code,
//       redirect_uri: process.env.LINKDIN_RED_URL,
//       client_id: process.env.LINKDIN_CLIENT_ID,
//       client_secret: process.env.LINKDIN_CLIENT_SECRET,
//     };
    
//     const resp = await axios.post(
//       'https://www.linkedin.com/oauth/v2/accessToken', 
//       qs.stringify(params), 
//       { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
//     );
    
//     return resp.data;
//   } catch (err) {
//     throw new AppError("Failed to exchange LinkedIn code", 500);
//   }
// }

// export async function fetchLinkedinProfile(accessToken: string) {
//   try {
//     const resp = await axios.get('https://api.linkedin.com/v2/me', {
//       headers: { Authorization: `Bearer ${accessToken}` }
//     });
//     return resp.data;
//   } catch (err) {
//     throw new AppError("Failed to fetch LinkedIn profile", 500);
//   }
// }

// export async function fetchLinkedinEmail(accessToken: string) {
//   try {
//     const resp = await axios.get(
//       'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', 
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );
//     return resp.data;
//   } catch (err) {
//     throw new AppError("Failed to fetch LinkedIn email", 500);
//   }
// }

/* --------------------- OAuth Controllers --------------------- */

export async function Authorize(req: Request, res: Response, next: NextFunction) {
  try {
    const provider = req.params?.provider;
    
    if (provider === 'google') {
      const scope = encodeURIComponent('openid email profile');
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.RED_URL_PRD!)}&response_type=code&scope=${scope}&state=${process.env.GOOGLE_STATE}`;
      return res.redirect(url);
    }
    
    if (provider === 'github') {
      const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GITHUB_RED_URL!)}&scope=user%20user:email&state=${process.env.GITHUB_STATE}&prompt=select_account`;
      return res.redirect(url);
    }
    
    throw new AppError("Unsupported provider", 400);
  } catch (err) {
    next(err);
  }
}

export async function CallbackGithub(req: Request, res: Response, next: NextFunction) {
  try {
    const code = req.query.code as string;
    if (!code) throw new AppError("Authorization code is missing", 400);

    const tokenResp = await exchangeGithubCode(code);
    const accessToken = tokenResp.access_token as string;

    const emails = await fetchGithubEmails(accessToken);
    const primary = emails.find((e: any) => e.primary && e.verified);
    if (!primary) throw new AppError("No verified email found", 400);

    const email = primary.email as string;
    const userProfile = await fetchGithubUser(accessToken);
    const name = userProfile.name || userProfile.login;
    const providerId = userProfile.id.toString();

    // 🔹 Find or create user
    let oauth = await prisma.oAuthAccount.findFirst({
      where: { provider: "github", providerId },
      include: { user: true },
    });

    let user;
    if (oauth) {
      user = oauth.user;
    } else {
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username: utils.generateUsername(name),
            name,
            password: "",
            saltPassword: "",
            dateOfBirth: "2001-11-03T00:00:00.000Z",
            oAuthAccount: {
              create: { provider: "github", providerId },
            },
          },
        });
      } else {
        await prisma.oAuthAccount.create({
          data: { provider: "github", providerId, userId: user.id },
        });
      }
    }

    // 🌍 Set Device Info
    const { devid, deviceRecord } = await utils.SetDeviceInfo(req, res, email);

    // 🔑 Generate Tokens
    const payload = {
      username: user.username,
      email: user.email,
      id: user.id,
      role: "user",
      expiresInSeconds: 60 * 60,
    };
    const payload2 = {
      username: user.username,
      email: user.email,
      id: user.id,
      role: "user",
      expiresInSeconds: 60 * 60 * 24 * 30,
    };

    const token = await utils.GenerateJwt(payload);
    const refreshToken = await utils.GenerateJwt(payload2);

    await redisClient.set(
      `refresh-token:${user.email}:${devid}`,
      refreshToken.token,
      { EX: 60 * 60 * 24 * 30 }
    );

    res.cookie("refresh-token", refreshToken, {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: true,
      secure: true,
      domain: process.env.FRONTEND_HOST,
    });

    await prisma.user.update({
      where: { email },
      data: { tokenVersion: (user.tokenVersion || 0) + 1 },
    });

    // 🌐 Get Location Info
    const ip: string = req.ip || req.connection?.remoteAddress || "0.0.0.0";
    const geo = await utils.Sendlocation(ip);

    // 📧 Send Professional Login Email
    const emailMsg = `
<h2>👋 Hello, ${user.username || name}</h2>
<p>We noticed a new login to your account via <b>GitHub</b>.</p>

<table style="border-collapse: collapse;">
  <tr><td>🕒 <b>Time</b></td><td>${new Date().toLocaleString()}</td></tr>
  <tr><td>📍 <b>Location</b></td><td>${geo.City || "Unknown"}, ${geo.Country || ""}</td></tr>
  <tr><td>🌐 <b>IP Address</b></td><td>${geo.Query || ip}</td></tr>
  <tr><td>🖥️ <b>Device</b></td><td>${req.get("User-Agent") || "Unknown"}</td></tr>
</table>

<p>Your login was successful 🎉</p>
<p>If this wasn’t you, please reset your password or contact support immediately.</p>

<hr>
<p>— The Artemisa Security Team 🦊</p>
`;

    await utils.SendEmailSmtp(res,email,emailMsg);

    // ✅ Final Response
    return res.json({
      token,
      refreshToken,
      message: "User logged in successfully via GitHub ✅",
     user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        isEmailVerified: user.isEmailVerified,
      },
      deviceRecord,
      location: geo,
    });
  } catch (err) {
    console.error("CallbackGithub err:", err);
    next(err);
  }
}
export async function CallbackGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    const code = req.query.code as string;
    if (!code) throw new AppError("Authorization code is missing", 400);

    const tokenObj = await exchangeGoogleCode(code);
    const idToken = tokenObj.id_token as string;
    const parts = idToken.split(".");
    if (parts.length < 2) throw new AppError("Invalid ID token", 401);

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    const email = payload.email as string;
    const name = payload.given_name || payload.name || "unknown";
    const providerId = payload.sub.toString();

    // Find or create user
    let oauth = await prisma.oAuthAccount.findFirst({
      where: { provider: "google", providerId },
      include: { user: true },
    });

    let user;
    if (oauth) {
      user = oauth.user;
    } else {
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username: utils.generateUsername(name),
            name,
            password: "",
            saltPassword: "",
            dateOfBirth: "2001-11-03T00:00:00.000Z",
            oAuthAccount: {
              create: { provider: "google", providerId },
            },
          },
        });
      } else {
        await prisma.oAuthAccount.create({
          data: { provider: "google", providerId, userId: user.id },
        });
      }
    }

    // 🧠 Set Device Info (Geo + Device Record)
    const { devid, deviceRecord } = await utils.SetDeviceInfo(req, res, email);

    // 🕒 Tokens
    const payloadJwt = {
      username: user.username,
      email: user.email,
      id: user.id,
      role: "user",
      expiresInSeconds: 60 * 60,
    };
    const payloadJwt2 = {
      username: user.username,
      email: user.email,
      id: user.id,
      role: "user",
      expiresInSeconds: 60 * 60 * 24 * 30,
    };

    const token = await utils.GenerateJwt(payloadJwt);
    const refreshToken = await utils.GenerateJwt(payloadJwt2);

    await redisClient.set(
      `refresh-token:${user.email}:${devid}`,
      refreshToken.token,
      { EX: 60 * 60 * 24 * 30 }
    );

    res.cookie("refresh-token", refreshToken, {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: true,
      secure: true,
      domain: process.env.FRONTEND_HOST,
    });

    await prisma.user.update({
      where: { email },
      data: { tokenVersion: (user.tokenVersion || 0) + 1 },
    });

    // 📧 Send Professional Login Email
    const ip: string = req.ip || req.connection?.remoteAddress || "0.0.0.0";
    const geo = await utils.Sendlocation(ip);

    const emailMsg = `
<h2>👋 Hi, ${user.username || name}</h2>

<p>We noticed a new login to your account <strong>(${email})</strong>.</p>

<table style="border-collapse: collapse;">
  <tr><td>🕒 <b>Time</b></td><td>${new Date().toLocaleString()}</td></tr>
  <tr><td>📍 <b>Location</b></td><td>${geo.City || "Unknown"}, ${geo.Country || ""}</td></tr>
  <tr><td>🌐 <b>IP Address</b></td><td>${geo.Query || ip}</td></tr>
  <tr><td>🖥️ <b>Device</b></td><td>${req.get("User-Agent") || "Unknown"}</td></tr>
</table>

<p>If this was you — awesome! You’re all set 🎉</p>
<p>If this wasn’t you, please secure your account immediately.</p>

<hr>
<p>— The Artemisa Security Team 🌙</p>
`;

    await utils.SendEmailSmtp(res,email,emailMsg );

    // ✅ Final Response
    return res.json({
      token,
      refreshToken,
     user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        isEmailVerified: user.isEmailVerified,
      },
      message: "User registered and logged in successfully ✅",
      deviceRecord,
      location: geo,
    });
  } catch (err) {
    console.error("CallbackGoogle err:", err);
    next(err);
  }
}
export async function CheckEmail(req: Request, res: Response,next:NextFunction): Promise<Response | void> {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError("email is required", 400));

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      return utils.SendRes(res, { exists: true });
    } else {
      return utils.SendRes(res, { exists: false });
    }
  } catch (err) {
    console.error("CheckEmail err:", err);
    return next(err);
  }
}
// export const UpdateUsername = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//    const userId = (req as any).user.id;
//     const { username } = req.body;

//     if (!userId) {
//       throw new AppError("Unauthorized: Missing user ID", 401);
//     }

//     if (!username || typeof username !== 'string' || username.trim() === '') {
//       throw new AppError("Invalid username", 400);
//     }

//     const updatedUser = await prisma.user.update({
//       where: { id: userId },
//       data: { username },
//     });

//     return utils.SendRes(res, {
//       message: 'Username updated successfully ✅',
//       user: {
//         id: updatedUser.id,
//         username: updatedUser.username,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };
export const UpdateUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { username } = req.body;

    if (!userId) throw new AppError("Unauthorized: Missing user ID", 401);
    if (!username || typeof username !== "string" || username.trim() === "")
      throw new AppError("Invalid username", 400);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true, tokenVersion: true },
    });

    if (!currentUser) throw new AppError("User not found", 404);

    const newVersion = (currentUser.tokenVersion || 0) + 1;

    // 🧱 Update username and token version
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username,
        tokenVersion: newVersion,
      },
    });

    // 🪄 Generate new access & refresh tokens
    const accessObj = await utils.GenerateJwt({
      username: updatedUser.username,
      email: currentUser.email,
      id: updatedUser.id,
      role: "user",
      version: newVersion,
      expiresInSeconds: 60 * 60, // 1 hour
    });

    const refreshObj = await utils.GenerateJwt({
      username: updatedUser.username,
      email: currentUser.email,
      id: updatedUser.id,
      role: "user",
      version: newVersion,
      expiresInSeconds: 60 * 60 * 24 * 30, // 30 days
    });

    // 🍪 Set refresh token cookie
    res.cookie("refresh_token", refreshObj.token, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      domain: CLIENT_DOMAIN,
    });

    // ✅ Optional: reset session if you’re tracking sessions in Redis
    await utils.SetSession(req, userId, refreshObj.jti);

    // 🎯 Return result
    return utils.SendRes(res, {
      message: "Username updated successfully ✅",
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        tokenVersion: newVersion,
      },
      tokens: {
        access: accessObj.token,
        refresh: refreshObj.token,
      },
      
    });
  } catch (err) {
    next(err);
  }
};


/* --------------------- Exports --------------------- */

const authController = {
  Create,
  Verify_signup_email,
  VerifyResetCode,
  UpdateUsername,
  Login,
  ForgetPassword,
  ResetPassword,
  FinalizeSignup,
  Refresh,
  Logout,
  Captcha,
  ReauthPassword,
  ReauthTFA,
  ReauthCode,
  ChangePassword,
  ChangeEmail,
  VerifyNewEmail,
  GetUser,
  LogoutALL,
  GetSession,
  LogoutSession,
  SignupCaptcha,
  CheckEmail,
  GetUserEmailById,
};

const oauthController = {
  Authorize,
  CallbackGoogle,
  CallbackGithub,
};

export { authController, oauthController };