import dotenv from "dotenv";
dotenv.config();
// Alias for utility functions - must be compatible with your utils.ts/js
import * as utils from "../../application/utils/tweets/utils";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import zxcvbn from "zxcvbn";
import qrcode from "qrcode";
import speakeasy from "speakeasy";
import nodemailer from "nodemailer";
import  prisma  from "../../database";
import { redisClient } from "../../config/redis";
import fetch from "node-fetch";
import crypto from "crypto";
// Import Express types for request and response objects
import { Request, Response, NextFunction } from "express";

// --- Custom Type Definitions ---
import axios from 'axios';
import qs from 'querystring';
// Define the structure of the JWT payload used locally
interface LocalJwtPayload extends JwtPayload {
  Username?: string;
  username?: string;
  email: string;

  id: string;
  version: number;
  jti: string;
  devid: string| null;
}

// Define a minimal User type for database results
// In a real TS project, this would come from Prisma Client's generated types (e.g., import { User } from '@prisma/client')
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
    // Add other properties defined in your Prisma schema
}

// --- Environment Variables (type assertions) ---

const JWT_SECRET: string = process.env.JWT_SECRET || "changeme";
const PEPPER: string = process.env.PEPPER || "";
const DOMAIN: string = process.env.DOMAIN || "localhost";
const CLIENT_DOMAIN: string = process.env.CLIENT_DOMAIN || "localhost";

// Local helper functions (unmodified)
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

function generateJwt({ username, email, id ,expiresInSeconds, version, devid }: {
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

/* --------------------- Controller functions --------------------- */

export async function Create(req: Request, res: Response): Promise<Response | void> {
   console.log("Signup body jkahdjfhjksdhfjhsdjf");
  try {
    const input: any = req.body;
    console.log("Signup body:", input);
    if (!input || !input.email || !input.password || !input.name) {
      return utils.SendError(res, 400, "missing required fields");
    }
  const exist: number = await redisClient.exists(`signup_captcha:passed:${input.email}`);
   if (!exist){
    return utils.SendError(res,401,"u must solve Captcha first");
    }

     await redisClient.del(`signup_captcha:passed:${input.email}`);
  const passRes: string = await utils.ValidatePassword(input.password);
    if (passRes !== "0") return utils.SendError(res, 400, passRes);


    // email basic validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return utils.SendError(res, 400, "invalid email");

    const code: string = gen6();
    await redisClient.set(`Signup:code:${input.email}`, code, { EX: 15 * 60 });
console.log("signupcod saved",code);
    const message: string = `Subject: Verify Your Email Address 🚀

Hello ${input.name},

Thank you for signing up to Artimesa! 🎉  
To complete your registration and verify your email address, please enter the verification code below:

🔐 Your verification code: ${code}

This code will expire in 15 minutes. ⏳  
If you didn’t sign up for this account, you can safely ignore this message.

Welcome aboard,  
— The SOAH Security Team 🛡️
`;
    // Use the imported SendEmailSmtp from utils
    utils.SendEmailSmtp(res, input.email, message).catch(console.error);

    await redisClient.set(`Signup:user:${input.email}`, JSON.stringify(input), { EX: 15 * 60 });

    const exists: number = await prisma.user.count({ where: { email: input.email, isEmailVerified: true } });
    if (exists === 0) {
      return utils.SendRes(res, "Verify your email to continue");
    }
    return utils.SendRes(res, "Email already verified");
  } catch (err) {
  console.error("Create err:", err);
  return res.status(500).json({ error: (err as Error).message });
}
}

export async function SignupCaptcha(req: Request, res: Response): Promise<Response | void> {
  try {
    let email: string | undefined;
    const emailQuery = req.query.email;
    if (typeof emailQuery === "string") {
      email = emailQuery;
    } else if (Array.isArray(emailQuery) && typeof emailQuery[0] === "string") {
      email = emailQuery[0];
    } else {
      email = undefined;
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return utils.SendError(res, 400, "Email is Required");
console.log("Redis connected?", redisClient.isOpen);
    await redisClient.set(`signup_captcha:passed:${email}`, "1", { EX: 15 * 60 });
    return utils.SendRes(res, { Message: "You passed the Captcha you can continue regster now " });
  } catch (err) {
    console.error("Captcha err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function Verify_signup_email(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) return utils.SendError(res, 400, "email and token required");

    const stored: string | null = await redisClient.get(`Signup:code:${email}`);
console.log("signupcod rerived",stored);
    if (!stored) return utils.SendError(res, 500, "something went wrong:u must signup again");

    if (stored !== code) return utils.SendError(res, 401, "verifying email code is incorrect");

    // mark IsEmailVerified true in DB if exists (optional)
    await prisma.user.updateMany({ where: { email }, data: { isEmailVerified: true } });

    const userJson: string | null = await redisClient.get(`Signup:user:${email}`);
    if (!userJson) return utils.SendError(res, 500, "something went wrong");

    const input: any = JSON.parse(userJson);
    let username: string = input.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!username) username = `user${Math.floor(Math.random() * 10000)}`;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) username = `${username}${Math.floor(Math.random() * 10000)}`;
    const salt: string = crypto.randomBytes(16).toString("hex");
    // Use utils.HashPassword
    const hashed: string = await utils.HashPassword(input.password, salt);
console.log("here is dataofbirth",input.dateOfBirth);
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
        dateOfBirth: parsedDate,
      },
    }) as unknown as PrismaUser;

    utils.SendEmailSmtp(res, created.email, `Subject: Welcome to artimsia\n\nWelcome ${created.name}`).catch(console.error);

    return utils.SendRes(res, { user: created });
  } catch (err) {
    console.error("Verify_signup_email err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function Login(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email, password } = req.body;
console.log(email, password);

    if (!email || !password) return utils.SendError(res, 400, "missing email or password");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return utils.SendError(res, 403, "enter valid email");

    // Use utils.Attempts to check for blocks/captcha
    if (await utils.Attempts(res, email)) return;

    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
console.log(user);

    if (!user) {
      await utils.IncrAttempts(res, email);
      return utils.SendError(res, 401, "try again and enter your info correctly");
    }

    // Use utils.CheckPass
    const ok: boolean = await utils.CheckPass(password + user.saltPassword, user.password);
//     if (!ok) {
//       await utils.IncrAttempts(res, email);
//       return utils.SendError(res, 401, "try again and enter your info correctly");
//     }

    // Password correct, reset attempts
    await utils.RestAttempts(email);

    await redisClient.set(`Login:user:${email}`, JSON.stringify(user), { EX: 15 * 60 });
    const code: string = gen6();
    await redisClient.set(`Login:code:${email}`, code, { EX: 15 * 60 });

    const message: string = `Hello ${user.username},

🎉 Your login attempt was successful!

🔐 Your 2FA verification code: ${code}

This code is valid for 15 minutes.
`;
console.log("code",code)
    utils.SendEmailSmtp(res, email, message).catch(console.error);

    const exists: number = await redisClient.exists(`Login:verified:${email}`);
    if (!exists) {
      return utils.SendRes(res, { message: "you must enter verification code to continue" });
    } else {
      return utils.SendRes(res, "email is verified u good to go");
    }
  } catch (err) {
    console.error("Login err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function Verify_email(req: Request, res: Response): Promise<Response | void> {
  try {
const { email} = req.body;   
    const {code}=req.body;
    if (!email || !code) return utils.SendError(res, 400, "email and code required");

    const stored: string | null = await redisClient.get(`Login:code:${email}`);
    if (!stored) return utils.SendError(res, 500, "something went wrong");
    if (stored !== code) return utils.SendError(res, 401, "Enter Email verification code correctly");

    await redisClient.del(`Login:code:${email}`);
    await redisClient.set(`Login:verified:${email}`, "1", { EX: 10 * 60 });

    const userRow = await prisma.user.findFirst({
      where: { email, OR: [{ tfaVerifed: true }, { loginCodesSet: true }] },
    }) as PrismaUser | null;

    if (userRow) {
      return utils.SendRes(res, "Enter your 2FA code to login OR login codes to enter");
    }

    const userJson: string | null = await redisClient.get(`Login:user:${email}`);
    if (!userJson) return utils.SendError(res, 500, "something went wrong");
    const user: PrismaUser = JSON.parse(userJson);
if (!user) return utils.SendError(res, 404, "user not found");
    // Use utils.SetDeviceInfo
console.log("User inside Verify_email:", user);

    const {devid, deviceRecord} = await utils.SetDeviceInfo(req, res, email);

    const accessObj = generateJwt({
      username: user.username,
      email,
      id: user.id,
     
      expiresInSeconds: 15 * 60,
      version: user.tokenVersion || 0,
      devid,
    });
    const refreshObj = generateJwt({
      username: user.username,
      email,
      id: user.id,
     
      expiresInSeconds: 7 * 24 * 60 * 60,
      version: user.tokenVersion || 0,
      devid,
    });

    res.cookie("refresh_token", refreshObj.token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      domain: CLIENT_DOMAIN,
    });

    // Use utils.SetSession
console.log("here is it req",req);
console.log("user",user);

 await utils.SetSession(req, user.id, refreshObj.jti);
console.log("Device Info:", { devid, deviceRecord });

    return utils.SendRes(res, { User: user, DeviceRecord:deviceRecord ,Token: accessObj.token, Refresh_token: refreshObj.token });
  } catch (err) {
    console.error("Verify_email err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function Refresh(req: Request, res: Response): Promise<Response | void> {
  try {
    const refreshToken: string | undefined = req.cookies?.refresh_token;
    if (!refreshToken) return utils.SendError(res, 401, "no refreshToken cookie has been set cannot renew seasion");

    const validated = validateJwt(refreshToken);
    if (!validated.ok) return utils.SendError(res, 401, "no valid refreshToken cookie has been set cannot renew seasion");

    const payload: LocalJwtPayload = validated.payload as LocalJwtPayload;
    const username: string = payload.Username || payload.username || "";
    const email: string = payload.email;
    const id: string = payload.id;
    
    const version: number = payload.version || 0;

    // Use utils.SetDeviceInfo
    // NOTE: The return type of utils.SetDeviceInfo has changed to {devid, deviceRecord}
    // I'm preserving the original variable name 'devid' for compatibility with the original logic, 
    // but this might need adjustment if it caused a runtime error in JS.
    const { devid } = await utils.SetDeviceInfo(req, res, email);

    const newAccess = generateJwt({
      username,
      email,
      id,
     
      expiresInSeconds: 7 * 60,
      version,
      devid,
    });

    const jti: string = uuidv4();
    // Use utils.SetSession
   await utils.SetSession(req, id, jti);

    return utils.SendRes(res, { NewAcesstoken: newAccess.token });
  } catch (err) {
    console.error("Refresh err:", err);
    return utils.SendError(res, 500, "something went wrong try again");
  }
}

export async function Logout(req: Request, res: Response): Promise<Response | void> {
  try {
    const refreshToken: string | undefined = req.cookies?.refresh_token;
    if (!refreshToken) return utils.SendError(res, 401, "refresh token expried u already logged out");

    const validated = validateJwt(refreshToken);
    if (!validated.ok) return utils.SendError(res, 401, "refreshToken invalid");

    const header: string | undefined = req.get("Authorization");
    if (!header) return utils.SendError(res, 401, "No Authorization Header");
    let tokenString: string | null = header.startsWith("Bearer") ? header.slice(6).trim() : null;
    if (!tokenString) return utils.SendError(res, 401, "Not valid token should start with Bearer");
    tokenString = tokenString.replace(/^&\{/, "");

    const accessVal = validateJwt(tokenString);
    if (!accessVal.ok) return utils.SendError(res, 401, "Not valid token signuture");

    if (tokenString === refreshToken) return utils.SendError(res, 401, "token and refreshToken cannot be the same");

    const accessPayload: LocalJwtPayload = accessVal.payload as LocalJwtPayload;
    const userId: string | undefined = accessPayload.id || (req.user as any)?.id;
    const jti: string | null = accessPayload.jti || req.body?.jti || null;
    if (userId && jti) {
      await redisClient.del(`session:${userId}:${jti}`);
    }

    res.clearCookie("refresh_token", { domain: DOMAIN, path: "/" });
    return utils.SendRes(res, "logged out");
  } catch (err) {
    console.error("Logout err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function Captcha(req: Request, res: Response): Promise<Response | void> {
  try {
   const emailQuery = req.query.email;
let email: string | undefined;
if (Array.isArray(emailQuery)) {
  email = typeof emailQuery[0] === "string" ? emailQuery[0] : undefined;
} else if (typeof emailQuery === "string") {
  email = emailQuery;
} else {
  email = undefined;
}
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return utils.SendError(res, 400, "Email is Required");
    await redisClient.set(`captcha:passed:${email}`, "1", { EX: 15 * 60 });
    return utils.SendRes(res, { Message: "You passed the Captcha you can login now " });
  } catch (err) {
    console.error("Captcha err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function Create_2fA(req: Request, res: Response): Promise<Response | void> {
  try {
    const email = (req.user as any)?.email || req.body?.email;
    console.log("req.user::",req.user);
    if (!email) return utils.SendError(res, 400, "email required");
    const secret = speakeasy.generateSecret({ issuer: "SOAH", name: email });
    await redisClient.set(`Login:2fa:${email}`, secret.base32);
    await prisma.user.updateMany({ where: { email }, data: { otp: secret.base32 } });
    const png: string = await qrcode.toDataURL(secret.otpauth_url || "", { width: 256 });
    await prisma.user.updateMany({ where: { email }, data: { tfaVerifed: true } });
    return utils.SendRes(res, { Email: email, Png: png, Secret: secret.base32 });
  } catch (err) {
    console.error("Create_2fA err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function Verify_2fA(req: Request, res: Response): Promise<Response | void> {
  try {
    const email = (req.user as any)?.email || req.body?.email;  
    const {code}=req.body?.code;

  console.log("code:",code);
  console.log("email::",email);
    if (!email || !code) return utils.SendError(res, 400, "email & code required");
    const secret: string | null = await redisClient.get(`Login:2fa:${email}`);
console.log("secret :",secret);
    if (!secret) return utils.SendError(res, 500, "something went wrong");
    const ok: boolean = speakeasy.totp.verify({ secret, encoding: "base32", token: code, window: 1 });
    if (!ok) return utils.SendError(res, 401, "Enter valid 2fA code");
    const userJson: string | null = await redisClient.get(`Login:user:${email}`);

    if (!userJson) return utils.SendError(res, 500, "something went wrong");
    const user: PrismaUser = JSON.parse(userJson);
console.log("user :",user);
    // Use utils.SetDeviceInfo
    const { devid } = await utils.SetDeviceInfo(req, res, email);
    const accessObj = generateJwt({ username: user.username, email, id: user.id, expiresInSeconds: 15 * 60, version: user.tokenVersion || 0, devid });
    const refreshObj = generateJwt({ username: user.username, email, id: user.id, expiresInSeconds: 7 * 24 * 60 * 60, version: user.tokenVersion || 0, devid });
    res.cookie("refresh_token", refreshObj.token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax", domain: CLIENT_DOMAIN });
   
    await utils.SetSession(req, user.id, refreshObj.jti);
    return utils.SendRes(res, { User: user, Token: accessObj.token, Refresh_token: refreshObj.token });
  } catch (err) {
    console.error("Verify_2fA err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function GenerteLoginCodes(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email } = req.body;
    if (!email) return utils.SendError(res, 400, "email required");
    const codes: string[] = [];
    for (let i: number = 0; i < 12; i++) codes.push(gen6());
    const joined: string = codes.join(",");
    const updated = await prisma.user.updateMany({ where: { email }, data: { loginCodes: joined, loginCodesSet: true } });
    if (updated.count === 0) return utils.SendError(res, 500, "something went wrong");
    const msg: string = `Hello [UserName],\n\nYour backup codes:\n${codes.join("\n")}`;
    // Note: Original code passes "Backup Login Codes" as the third argument (subject), but utils.SendEmailSmtp expects the third arg to be the message text.
    // I'm keeping the parameter count and passing the message text (`msg`) as the second message part.
    utils.SendEmailSmtp(res, email, msg).catch(console.error);
    return utils.SendRes(res, msg);
  } catch (err) {
    console.error("GenerteLoginCodes err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function VerifyLoginCode(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) return utils.SendError(res, 400, "email & code required");
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    if (!user) return utils.SendError(res, 500, "something went error");
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
    if (!found) return utils.SendError(res, 401, "Enter your Login_codes correctly");
    // Use utils.SetDeviceInfo
    const { devid } = await utils.SetDeviceInfo(req, res, email);
    const accessObj = generateJwt({ username: user.username, email, id: user.id,  expiresInSeconds: 15 * 60, version: user.tokenVersion || 0, devid });
    const refreshObj = generateJwt({ username: user.username, email, id: user.id,  expiresInSeconds: 7 * 24 * 60 * 60, version: user.tokenVersion || 0, devid });
    await prisma.user.updateMany({ where: { email }, data: { loginCodes: copy.join(",") } });
    res.cookie("refresh_token", refreshObj.token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax", domain: CLIENT_DOMAIN });
    // Use utils.SetSession
    await utils.SetSession(req, user.id, refreshObj.jti);
    return utils.SendRes(res, { User: user, Token: accessObj.token, Refresh_token: refreshObj.token });
  } catch (err) {
    console.error("VerifyLoginCode err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function ForgetPassword(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email } = req.body;
    if (!email) return utils.SendError(res, 400, "email required");

    // Use utils.ResetAttempts to check for blocks
    if (await utils.ResetAttempts(res, email)) return;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await utils.IncrResetAttempts(res, email);
      return utils.SendError(res, 404, "user not found");
    }

    const token: string = uuidv4();
    const link: string = `${process.env.GMAIL_FORGET_PASSWORD || ""}${token}&email=${encodeURIComponent(email)}`;
    const message: string = `Hi ${email.split("@")[0]},\n\nReset link:\n${link}\n\nThis link will expire in 15 minutes for your protection.`;
    await redisClient.set(`Reset:token:${email}`, token, { EX: 15 * 60 });
    utils.SendEmailSmtp(res, email, message).catch(console.error);
    return utils.SendRes(res, "Token sent by email check your email");
  } catch (err) {
    console.error("ForgetPassword err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function ResetPassword(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password) return utils.SendError(res, 400, "missing fields");
    const stored: string | null = await redisClient.get(`Reset:token:${email}`);
    if (!stored) return utils.SendError(res, 500, "something went wrong");
    if (stored !== token) return utils.SendError(res, 401, "unathourized access cannot reset password");
    
    const passValidation: string = await utils.ValidatePassword(password);
    if (passValidation !== "0") return utils.SendError(res, 400, passValidation);

    const salt: string = crypto.randomBytes(16).toString("hex");
    // Use utils.HashPassword
    const hashed: string = await utils.HashPassword(password, salt);
    await prisma.user.updateMany({ where: { email }, data: { password: hashed, saltPassword: salt } });
    await redisClient.del(`Reset:token:${email}`);

    // Reset reset attempts
    await utils.RsetResetAttempts(email);

    return utils.SendRes(res, "password Reseted correctly");
  } catch (err) {
    console.error("ResetPassword err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function GetDeviceInfo(req: Request, res: Response): Promise<Response | void> {
  try {
    const email: string | undefined = (req.user as any)?.email || (req.query.email as string);
    if (!email) return utils.SendError(res, 400, "email required");
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    if (!user) return utils.SendError(res, 500, "something went wrong");
    // Assuming deviceRecord has 'userid' field
    const device = await prisma.deviceRecord.findFirst({ where: { userId: user.id } });
    if (!device) return utils.SendError(res, 500, "something went wrong");
    return utils.SendRes(res, device);
  } catch (err) {
    console.error("GetDeviceInfo err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function ReauthPassword(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) return utils.SendError(res, 400, "missing");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return utils.SendError(res, 401, "invaild Email");
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    if (!user) return utils.SendError(res, 401, "Enter Email or password correctly");
    // Use utils.CheckPass
    const ok: boolean = await utils.CheckPass(password + user.saltPassword, user.password);
    if (!ok) return utils.SendError(res, 401, "Enter Email or password correctly");
    await redisClient.set(`Reauth:${email}`, "1", { EX: 5 * 60 });
    return utils.SendRes(res, "you can change your cerditional now");
  } catch (err) {
    console.error("ReauthPassword err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function ReauthTFA(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) return utils.SendError(res, 400, "missing");
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    if (!user) return utils.SendError(res, 401, "email isnot in system");
    if (!user.tfaVerifed || !user.otp) return utils.SendError(res, 403, "you cannot use 2FA method it must be enables first");
    const ok: boolean = speakeasy.totp.verify({ secret: user.otp, encoding: "base32", token: code, window: 1 });
    if (!ok) return utils.SendError(res, 401, "code isnot correct try again");
    await redisClient.set(`Reauth:${email}`, "1", { EX: 5 * 60 });
    return utils.SendRes(res, "you can change your cerditional now");
  } catch (err) {
    console.error("ReauthTFA err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function ReauthCode(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) return utils.SendError(res, 400, "missing");
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    if (!user) return utils.SendError(res, 401, "email isnot in system");
    if (!user.loginCodesSet) return utils.SendError(res, 403, "you cannot use this codes method it must be enables first");
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
    if (!found) return utils.SendError(res, 401, "Enter code correctly try again");
    await prisma.user.updateMany({ where: { email }, data: { loginCodes: copy.join(",") } });
    await redisClient.set(`Reauth:${email}`, "1", { EX: 5 * 60 });
    return utils.SendRes(res, "you can change your cerditional now");
  } catch (err) {
    console.error("ReauthCode err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function ChangePassword(req: Request, res: Response): Promise<Response | void> {
  try {
    const { password, confirm } = req.body;
    const email: string | undefined = (req.user as any)?.email || req.body?.email;
    if (!email) return utils.SendError(res, 401, "you are unauthorized to enter this route");
    
    // Use utils.ValidatePassword
    const passValidation: string = await utils.ValidatePassword(password);
    if (passValidation !== "0") return utils.SendError(res, 400, passValidation);
    
    const user = await prisma.user.findUnique({ where: { email } }) as PrismaUser | null;
    if (!user) return utils.SendError(res, 500, "something went wrong");
    
    // Use utils.AnalisePass
    const score: zxcvbn.ZXCVBNResult = utils.AnalisePass(password, user);
    if (score.score < 3) return utils.SendError(res, 401, "your password not accepted");
    if (confirm !== password) return utils.SendError(res, 401, "confirm password isnot like the password");
    
    // Use utils.NotOldPassword
    const oldPassCheck: string = await utils.NotOldPassword(password, user.id);
    if (oldPassCheck !== "0") return utils.SendError(res, 401, oldPassCheck);

    const salt: string = crypto.randomBytes(16).toString("hex");
    // Use utils.HashPassword
    const hashed: string = await utils.HashPassword(password, salt);
    
    await prisma.user.updateMany({ where: { email }, data: { saltPassword:salt, password: hashed }});
    
    // Add new hash to history
    await utils.AddPasswordHistory(hashed, user.id);

    const ip: string = req.ip || req.connection?.remoteAddress || "unknown";
    const username: string = (req.user as any)?.username || user.username || "user";
    // Use utils.Sendlocation
    const geo: utils.GeoData | null = await utils.Sendlocation(ip).catch(() => null);
    const message: string = `Hi ,${username}

We’re letting you know that the password for your account (${email}) was just changed.

🕒 Time: ${new Date().toISOString()}
📍 Location: ${geo ? `${geo.Timezone}, ${geo.City}` : "unknown"}
🌐 IP Address: ${ip}
🖥️ Device: ${req.get("User-Agent") || ""}

If you did NOT change your password, please secure your account immediately.
`;
await prisma.user.updateMany({ where: { email }, data: { tokenVersion: (user.tokenVersion || 0) + 1 } });
    utils.SendEmailSmtp(res, email, message).catch(console.error);
    
    return utils.SendRes(res, { Message: "password updated correctly", Score: score });
  } catch (err) {
    console.error("ChangePassword err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function ChangeEmail(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email: newEmail } = req.body;
    const currentEmail: string | undefined = (req.user as any)?.email || req.body?.currentEmail;
    if (!newEmail) return utils.SendError(res, 400, "email required");
    if (!currentEmail) return utils.SendError(res, 401, "must provide your current email");
if (newEmail==currentEmail)return utils.SendError(res,401,"new email must be different than the old one");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return utils.SendError(res, 401, "input email is not valid");

    // Use utils.VerifEmailHelper
    const ok: boolean = await utils.VerifEmailHelper(res, currentEmail, newEmail);
    if (!ok) return utils.SendError(res, 500, "failed to send verification email");

    return utils.SendRes(res, "now you can verify your email to change it");
  } catch (err) {
    console.error("ChangeEmail err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function VerifyNewEmail(req: Request, res: Response): Promise<Response | void> {
  try {
    const { email: desiredEmail, code } = req.body;
    const currentEmail: string | undefined = (req.user as any)?.email || req.body?.currentEmail;
    if (!currentEmail) return utils.SendError(res, 401, "you cannot use this codes method it must be enables first");
    if (!code) return utils.SendError(res, 400, "code required");
    const stored: string | null = await redisClient.get(`ChangeEmail:code:${currentEmail}`);
    if (!stored) return utils.SendError(res, 500, "something went wrong:doesnot exist in redis");
    if (stored !== code) return utils.SendError(res, 401, "Enter code correctly");
    await prisma.user.updateMany({ where: { email: currentEmail }, data: { email: desiredEmail } });
    const updated = await prisma.user.findUnique({ where: { email: desiredEmail } });
    if (!updated) return utils.SendError(res, 500, "something went wrong updating user with the new email");
    await prisma.user.updateMany({ where: { email: desiredEmail }, data: { tokenVersion: (updated.tokenVersion || 0) + 1 } });
    return utils.SendRes(res, "email changed correctly");
  } catch (err) {
    console.error("VerifyNewEmail err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function GetUser(req: Request, res: Response): Promise<Response | void> {
  try {
    const email: string | undefined = (req.user as any)?.email || (req.query?.email as string)||(req.body?.email as string);
    if (!email) return utils.SendError(res, 401, "user isnot authorized this route ");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return utils.SendError(res, 500, "something went wrong");
    return utils.SendRes(res, { User: user });
  } catch (err) {
    console.error("GetUser err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function LogoutALL(req: Request, res: Response): Promise<Response | void> {
  try {
    const id: number | undefined = (req.user as any)?.id || req.body?.id || (req.query?.id as string);
    if (!id) return utils.SendError(res, 401, "unauthorized");
    let cursor: string = "0";
    const pattern: string = `session:${id}:*`;
    do {
      // scanRes type can be simplified for Redis client
      const scanRes: { cursor: string, keys: string[] } = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 }) as { cursor: string, keys: string[] };
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
    return utils.SendRes(res, "you logout all session successfully");
  } catch (err) {
    console.error("LogoutALL err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}

export async function GetSession(req: Request, res: Response): Promise<Response | void> {
  try {
    const id: string | undefined = (req.user as any)?.id || (req.query?.id as string) || req.body?.id;
    console.log("GetSession called with id:", id);
    
    if (!id) return utils.SendError(res, 401, "unauthorized");
    
    let cursor: string = "0";
    const pattern: string = `User:sessions:${id}:*`;
    console.log("Searching for pattern:", pattern);
    
    const sessions: any[] = [];
    const allKeys: string[] = [];
    
    // First, collect all matching keys
    do {
      console.log("Scanning with cursor:", cursor);
      const scanRes = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      }) as { cursor: number | string, keys: string[] };
      
      console.log("Scan result:", scanRes);
      
      cursor = String(scanRes.cursor);
      const keys: string[] = scanRes.keys || [];
      
      if (keys.length > 0) {
        console.log("Found keys in this iteration:", keys);
        allKeys.push(...keys);
      }
    } while (cursor !== "0");
    
    console.log(`Found ${allKeys.length} session keys for user ${id}`, allKeys);
    
    // Then fetch all list items from each key
    for (const key of allKeys) {
      try {
        console.log("Reading from key:", key);
        const listItems = await redisClient.lRange(key, 0, -1);
        console.log("List items:", listItems);
        
        for (const val of listItems) {
          try {
            const session = JSON.parse(val);
            console.log("Parsed session:", session);
            // Optional: filter out expired sessions
            if (new Date(session.ExpireAt) > new Date()) {
              sessions.push(session);
            } else {
              console.log("Session expired, skipping");
            }
          } catch (e) {
            console.error("GetSession unmarshal", e);
          }
        }
      } catch (e) {
        console.error(`Error reading key ${key}:`, e);
      }
    }
    
    console.log("Final sessions from GetSession:", sessions);
    return utils.SendRes(res, sessions);
  } catch (err) {
    console.error("GetSession err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}
// export async function DebugRedis(req: Request, res: Response): Promise<Response | void> {
//   try {
//     const id: string = (req.query?.id as string) || req.body?.id;
//     console.log("Debug: Looking for sessions with id:", id);
    
//     // Get ALL session keys in Redis
//     const allRedisKeys = await redisClient.keys("User:sessions:*");
//     console.log("All session keys in Redis:", allRedisKeys);
    
//     // Try to find keys for this specific user
//     const userKeys = await redisClient.keys(`User:sessions:${id}:*`);
//     console.log(`Keys for user ${id}:`, userKeys);
    
//     // Read data from user keys
//     const data: any = {};
//     for (const key of userKeys) {
//       const listItems = await redisClient.lRange(key, 0, -1);
//       data[key] = listItems.map(item => JSON.parse(item));
//     }
    
//     return utils.SendRes(res, { 
//       searchId: id,
//       allRedisKeys, 
//       userKeys,
//       data 
//     });
//   } catch (err) {
//     console.error("DebugRedis err:", err);
//     return utils.SendError(res, 500, "debug error");
//   }
// }



export async function LogoutSession(req: Request, res: Response): Promise<Response | void> {
  try {
    const sessionid: string = req.params.sessionid;
    const userId: string| undefined = (req.user as any)?.id || req.body?.id || (req.query?.id as string);
    if (!sessionid || !userId) return utils.SendError(res, 400, "missing");
    await redisClient.del(`session:${userId}:${sessionid}`);
    await redisClient.set(`Blocklist:${sessionid}`, "1", { EX: 15 * 60 });
    return utils.SendRes(res, "session logged out successfully");
  } catch (err) {
    console.error("LogoutSession err:", err);
    return utils.SendError(res, 500, "something went wrong");
  }
}


/* --------------------- Export default --------------------- */

////////////////////////////////////////////////////



export async function exchangeGithubCode(code: string){
const params = {
client_id: process.env.GITHUB_CLIENT_ID,
client_secret: process.env.GITHUB_CLIENT_SECRET,
code,
redirect_uri: process.env.GITHUB_RED_URL,
};
const resp = await axios.post('https://github.com/login/oauth/access_token', qs.stringify(params), {
headers: { 'Accept': 'application/json' }
});
return resp.data; // contains access_token
}


export async function fetchGithubEmails(accessToken: string){
const resp = await axios.get('https://api.github.com/user/emails', {
headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
});
return resp.data;
}


export async function fetchGithubUser(accessToken: string){
const resp = await axios.get('https://api.github.com/user', {
headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
});
return resp.data;
}


export async function exchangeGoogleCode(code: string){
const params = {
code,
client_id: process.env.CLIENT_ID,
client_secret: process.env.CLIENT_SECRET,
redirect_uri: process.env.RED_URL,
grant_type: 'authorization_code'
};
const resp = await axios.post('https://oauth2.googleapis.com/token', qs.stringify(params), {
headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
return resp.data; // contains id_token and access_token
}


export async function exchangeLinkedinCode(code: string){
const params = {
grant_type: 'authorization_code',
code,
redirect_uri: process.env.LINKDIN_RED_URL,
client_id: process.env.LINKDIN_CLIENT_ID,
client_secret: process.env.LINKDIN_CLIENT_SECRET,
};
const resp = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', qs.stringify(params), {
headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
return resp.data;
}


export async function fetchLinkedinProfile(accessToken: string){
const resp = await axios.get('https://api.linkedin.com/v2/me', {
headers: { Authorization: `Bearer ${accessToken}` }
});
return resp.data;
}


export async function fetchLinkedinEmail(accessToken: string){
const resp = await axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
headers: { Authorization: `Bearer ${accessToken}` }
});
return resp.data;
}

///////////////////////////////////////////
export async function Authorize(req: Request, res: Response){
const provider = req.params?.provider;
if(provider === 'google'){
const scope = encodeURIComponent('openid email profile');
const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.RED_URL!)}&response_type=code&scope=${scope}&state=${process.env.GOOGLE_STATE}`;
return res.redirect(url);
}
if(provider === 'github'){
const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GITHUB_RED_URL!)}&scope=user%20user:email&state=${process.env.GITHUB_STATE}&prompt=select_account`;
return res.redirect(url);
}
// if(provider === 'linkedin'){
// const scope = encodeURIComponent('r_liteprofile r_emailaddress');
// const url = `https://www.linkedin.com/oauth/v2/authorization?client_id=${process.env.LINKDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.LINKDIN_RED_URL!)}&state=${process.env.LINKDIN_STATE}&scope=${scope}&response_type=code`;
// return res.redirect(url);
// }
return res.status(400).json({ error: 'unsupported provider' });
}

////////////////////////////////////////////////////////////////////////////
export async function CallbackGithub(req: Request, res: Response){
try{
const code = req.query.code as string;
const tokenResp = await exchangeGithubCode(code);
const accessToken = tokenResp.access_token as string;
const emails = await fetchGithubEmails(accessToken);
const primary = emails.find((e: any) => e.primary && e.verified);
if(!primary) return res.status(400).json({ error: 'No verified email found' });
const email = primary.email as string;
const userProfile = await fetchGithubUser(accessToken);
const name = userProfile.name || userProfile.login;
let user = await prisma.user.findUnique({ where: { email } });
if(!user){
user = await prisma.user.create({ data: {
email,
username: utils.generateUsername(name),
name,
password: '',
saltPassword: '',
dateOfBirth: "2001-11-03T00:00:00.000Z",
}});
// optionally send email
}
const deviceId = Math.floor(Math.random()*100000);
const payload = { username: user.username, email: user.email, id: user.id, role: 'user' };
const token = await utils.GenerateJwt(payload);
const refreshToken =await  utils.GenerateJwt(payload);
await redisClient.set(`refresh-token:${user.email}:${deviceId}`, refreshToken.token, { EX: 60*60*24*30 });
res.cookie('refresh-token', refreshToken, { maxAge: 1000*60*60*24*30, httpOnly: true, secure: true, domain: process.env.FRONTEND_HOST });
await prisma.user.update({ where: { email }, data: { tokenVersion: (user.tokenVersion || 0) + 1 } });
const userRefreshed = await prisma.user.findUnique({ where: { email } });
return res.json({ token, user: userRefreshed, device: { id: deviceId } });
}catch(err:any){
return res.status(500).json({ error: err.message });
}
}


export async function CallbackGoogle(req: Request, res: Response){
try{
const code = req.query.code as string;
const tokenObj = await exchangeGoogleCode(code);
const idToken = tokenObj.id_token as string;
// decode payload
const parts = idToken.split('.');
if(parts.length < 2) return res.status(401).json({ error: 'invalid id_token' });
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
const email = payload.email as string;
const name = payload.given_name || payload.name || 'unknown';
let user = await prisma.user.findUnique({ where: { email } });
if(!user){
user = await prisma.user.create({ data: {
email,
username: utils.generateUsername(name),
name,
password: '',
saltPassword: '',
dateOfBirth:  "2001-11-03T00:00:00.000Z",
}});
}
const deviceId = Math.floor(Math.random()*100000);
const token = await utils.GenerateJwt({ username: user.username, email: user.email, id: user.id, role: 'user' });
const refreshToken = await utils.GenerateJwt({ username: user.username, email: user.email, id: user.id, role: 'user' });
await redisClient.set(`refresh-token:${user.email}:${deviceId}`,  refreshToken.token, { EX: 60*60*24*30 });
res.cookie('refresh-token', refreshToken, { maxAge: 1000*60*60*24*24*30, httpOnly: true, secure: true, domain: process.env.FRONTEND_HOST });

await prisma.user.update({
  where: { email },
  data: { tokenVersion: (user.tokenVersion || 0) + 1 }
});

const userRefreshed = await prisma.user.findUnique({ where: { email } });
return res.json({ token, user: userRefreshed, device: { id: deviceId } });

}catch(err:any){
  return res.status(500).json({ error: err.message });
}
}
const authController = {
  Create,
  Verify_signup_email,
  Login,
  Verify_email,
  Create_2fA,
  Verify_2fA,
  GenerteLoginCodes,
  VerifyLoginCode,
  ForgetPassword,
  ResetPassword,
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

};
const oauthController = {
  Authorize,
  CallbackGoogle,
  CallbackGithub,
  // callbackLinkedin, // Implement similarly if needed
};
export { authController, oauthController };