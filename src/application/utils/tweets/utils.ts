import { prisma, ReplyControl } from "@/prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

//import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import fetch, { Response as FetchResponse } from "node-fetch";
import zxcvbn from "zxcvbn";
import { promisify } from "util";
// The following imports assume you have 'prisma' and 'redisClient' configured

// import { redisClient } from "../../../config/redis.js";
import { redisClient } from "@/config/redis";
// import { sendEmailSMTP as _sendEmailSMTP } from "./email-helper.js"; // optional: separate email helper
import { performance } from "perf_hooks";
// Use appropriate types for Express Request and Response
import { Request, Response } from "express";
const uuidv4 = async () => {
  const { v4 } = await import("uuid");
  return v4();
};
export const validToRetweetOrQuote = async (parentTweetId: string) => {
  const rightToTweet = await prisma.tweet.findUnique({
    where: { id: parentTweetId },
    select: { user: { select: { protectedAccount: true } } },
  });
  return rightToTweet ? !rightToTweet.user.protectedAccount : false;
};

export const isFollower = async (followerId: string, followingId: string) => {
  const row = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });
  return !!row;
};
export const resolveUsernameToId = async (username: string) => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, protectedAccount: true },
  });
  if (!user?.id) throw new Error("User not found");
  return user;
};

export const isVerified = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { verified: true },
  });

  return user?.verified ?? false;
};

export const isMentioned = async (
  mentionedId: string,
  mentionerId: string,
  tweetId: string
) => {
  const row = prisma.mention.findUnique({
    where: {
      tweetId_mentionerId_mentionedId: { tweetId, mentionerId, mentionedId },
    },
  });
  return !!row;
};

export const validToReply = async (id: string, userId: string) => {
  if (!id || !userId) return false;

  const tweet = await prisma.tweet.findUnique({
    where: { id },
    select: {
      userId: true,
      user: { select: { protectedAccount: true } },
      replyControl: true,
    },
  });
  if (!tweet) return false;

  const protectedAccount = tweet?.user?.protectedAccount ?? false;
  const replyControl = await evaluateReplyControl(
    id,
    tweet.replyControl,
    tweet.userId,
    userId
  );
  if (protectedAccount) {
    const follows = await isFollower(userId, tweet.userId);
    return follows && replyControl;
  }
  return replyControl;
};

const evaluateReplyControl = async (
  tweetId: string,
  type: ReplyControl,
  replieeId: string,
  replierId: string
) => {
  switch (type) {
    case "EVERYONE":
      return true;

    case "FOLLOWINGS":
      return isFollower(replierId, replieeId);

    case "VERIFIED":
      return isVerified(replierId);

    case "MENTIONED":
      return isMentioned(replierId, replieeId, tweetId);
    default:
      return false;
  }
};
//////////////////HOSSAM///////////////////////////
// utils.ts (ESM) - Prisma + Redis version of your Go utils package
// npm install jsonwebtoken bcryptjs uuid node-fetch zxcvbn qrcode speakeasy nodemailer @prisma/client
// You will also need: npm install -D @types/express @types/jsonwebtoken @types/bcryptjs @types/uuid @types/node-fetch @types/nodemailer @types/zxcvbn

// --- Custom Type Definitions ---

// Define the structure of the payload you put into the JWT
export interface JwtUserPayload extends JwtPayload {
  Username: string;
  email: string;
  role: string;
  id: string; // Assuming user ID is a number based on prisma use below
  version: number;
  jti: string;
  devid: string | null; // Assuming devid is a number or null
}

// Define the structure of the GeoData response from ip-api.com
export interface GeoData {
  Query: string;
  Country: string;
  RegionName: string;
  City: string;
  ISP: string;
  Timezone: string;
  Org: string;
  Status: string;
  Lat: number;
  Lon: number;
  Zip: string;
  CountryCode: string;
}

// Define the structure of a Redis Session record
export interface UserSession {
  Jti: string;
  UserID: string; // Assuming user ID is a number
  IsActive: boolean;
  IssuedAT: string;
  DeviceInfoId: string | null;
  ExpireAt: string;
}

// --- Environment Variables (type assertions) ---
const JWT_SECRET: string = process.env.JWT_SECRET as string;
const PEPPER: string = process.env.PEPPER || "";
const COOKIE_DOMAIN: string = process.env.DOMAIN || "localhost";

/* ------------------------------ Generic response helpers ------------------------------ */

export function SendRes(res: Response, payload: any): void {
  if (res.headersSent) return;
  // respect Accept header: minimal support
  const accept: string = res.get("Accept") || "application/json";
  if (accept.includes("application/xml")) {
    // simple xml fallback
    res
      .type("application/xml")
      .status(200)
      .send(`<response>${JSON.stringify(payload)}</response>`);
  } else if (accept.includes("application/x-yaml")) {
    res.type("application/x-yaml").status(200).send(JSON.stringify(payload)); // simple fallback
  } else {
    res.status(200).json(payload);
  }
}

export function SendError(
  res: Response,
  status: number,
  message: string
): void {
  if (res.headersSent) return;
  const accept: string = res.get("Accept") || "application/json";
  if (accept.includes("application/xml")) {
    res
      .type("application/xml")
      .status(status)
      .send(`<error>${message}</error>`);
  } else if (accept.includes("application/x-yaml")) {
    res.type("application/x-yaml").status(status).send(`${message}`);
  } else {
    res.status(status).json({ message: message });
  }
}

/* ------------------------------ JWT / Auth helpers ------------------------------ */

/**
 * Generate JWT and set some context in return object
 * returns signed token string and jti
 */
export async function GenerateJwt({
  username,
  email,
  id,
  role = "user",
  expiresInSeconds = 900,
  version = 0,
  devid = null,
}: {
  username: string;
  email: string;
  id: string;
  role?: string;
  expiresInSeconds?: number;
  version?: number;
  devid?: string | null;
}): Promise<{ token: string; jti: string; payload: JwtUserPayload }> {
  const jti: string = await uuidv4();
  const now: number = Math.floor(Date.now() / 1000);
  const payload: JwtUserPayload = {
    Username: username,
    email,
    role,
    id,
    exp: now + expiresInSeconds,
    iat: now,
    version,
    jti,
    devid,
  };
  const token: string = jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
  return { token, jti, payload };
}

/**
 * validate token and return {ok, payload, error}
 */
export function ValidateToken(tokenString: string): {
  ok: boolean;
  payload?: JwtUserPayload;
  err?: Error;
} {
  try {
    //console.log("Token:", token);

    // We assert the type to our custom payload interface
    const payload: JwtUserPayload = jwt.verify(
      tokenString,
      JWT_SECRET
    ) as JwtUserPayload;
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, err: err as Error };
  }
}

/* ------------------------------ Password helpers ------------------------------ */

export async function HashPassword(
  password: string,
  salt: string
): Promise<string> {
  return await bcrypt.hash(password + PEPPER + salt, 10);
}

export async function CheckPass(
  password: string,
  hashed: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password + PEPPER, hashed);
  } catch {
    return false;
  }
}



/* ------------------------------ Username generator ------------------------------ */

export function generateUsername(name: string): string {
  const base = name.toLowerCase().replace(/\s+/g, "");
  const rand = Math.floor(Math.random() * 10000);
  return `${base}${rand}`;
}

/* ------------------------------ Email checks (gmail-only logic preserved) ------------------------------ */

function _localAndDomain(
  email: string | null | undefined
): { local: string; domain: string } | null {
  if (!email || !email.includes("@")) return null;
  const parts: string[] = email.split("@");
  if (parts.length !== 2) return null;
  return { local: parts[0], domain: parts[1] };
}

export async function CheckEMail(email: string): Promise<boolean> {
  const parts = _localAndDomain(email);
  if (!parts) return false;
  if (parts.domain !== "gmail.com") return false;
  if (!/^[a-zA-Z0-9._-]+$/.test(parts.local)) return false;
  // ensure not already in DB
  const existing = await prisma.user.findUnique({ where: { email } });
  return existing ? false : true;
}

export function CheckEmailLogin(email: string): boolean {
  const parts = _localAndDomain(email);
  if (!parts) return false;
  if (parts.domain !== "gmail.com") return false;
  if (!/^[a-zA-Z0-9._-]+$/.test(parts.local)) return false;
  return true;
}

/* ------------------------------ Rate-limiting / Attempts (Redis-backed) ------------------------------ */

async function _getTTL(key: string): Promise<number> {
  const ttl: number = await redisClient.ttl(key);
  return ttl; // -2 - key missing, -1 - no expiry, >=0 seconds
}

export async function Attempts(res: Response, email: string, clientType: string|string[]): Promise<boolean> {
  try {
    const blockedVal = await redisClient.get(`Login:block:${email}`);
    if (blockedVal === "1") {
      SendError(res, 429, "You are blocked. Wait 15 minutes before trying again.");
      return true;
    }

    const exists = await redisClient.exists(`Login:fail:${email}`);
    if (!exists) return false; // first attempt, no issue

    const numStr = await redisClient.get(`Login:fail:${email}`);
    if (!numStr) {
      SendError(res, 500, "Something went wrong");
      return true;
    }

    const num = parseInt(numStr, 10);
    if (isNaN(num)) {
      SendError(res, 500, "Invalid number format in Redis");
      return true;
    }

    const ttl = await _getTTL(`Login:fail:${email}`);

    // 🧱 Web CAPTCHA logic
    if (clientType === "web") {
      if (num === 3) {
        await redisClient.set(`Login:fail:${email}`, String(num + 1), { EX: ttl > 0 ? ttl : 300 });
        SendError(res, 401, "Solve CAPTCHA first");
        return true;
      }

      if (num > 3 && num < 5) {
        const captchaPassed = await redisClient.exists(`captcha:passed:${email}`);
        if (!captchaPassed) {
          SendError(res, 401, "You must solve CAPTCHA first");
          return true;
        }
      }
    }

    // 🧱 Universal lock logic (web + mobile)
    if (num >= 5) {
      await SendEmail_FAILED_LOGIN(res, email).catch(console.error);
      await redisClient.set(`Login:block:${email}`, "1", { EX: 15 * 60 });
      SendError(res, 401, `You exceeded the number of attempts. Wait 15 minutes.`);
      return true;
    }

    return false;
  } catch (err) {
    console.error("Attempts error:", err);
    SendError(res, 500, "Internal server error");
    return true;
  }
}


export async function RestAttempts(email: string): Promise<void> {
  try {
    await redisClient.del(`Login:fail:${email}`);
    await redisClient.del(`Login:block:${email}`);
  } catch (err) {
    console.error("RestAttempts err:", err);
  }
}

export async function IncrAttempts(
  res: Response,
  email: string
): Promise<boolean> {
  try {
    const exists: number = await redisClient.exists(`Login:fail:${email}`);
    if (!exists) {
      // create a key with small TTL (matching Go's behavior, Go used 5s in some places; adapt as required)
      await redisClient.set(`Login:fail:${email}`, "0", { EX: 5 });
    }
    const numStr: string | null = await redisClient.get(`Login:fail:${email}`);
    if (!numStr) {
      SendError(res, 500, "something just went wrong");
      return false;
    }
    const num: number = parseInt(numStr.trim(), 10) || 0;
    const next: number = num + 1;
    const ttl: number = await _getTTL(`Login:fail:${email}`);
    const newTTL: number = ttl > 0 ? ttl : 5;
    await redisClient.set(`Login:fail:${email}`, String(next), { EX: newTTL });
    return true;
  } catch (err) {
    console.error("IncrAttempts err:", err);
    SendError(res, 500, "something went wrong 6");
    return false;
  }
}

/* ------------------------------ Password history ------------------------------ */

export async function AddPasswordHistory(
  hashed: string,
  userId: string
): Promise<boolean> {
  try {
    await prisma.oldPassword.create({
      data: {
        userId: userId,
        password: hashed,
      },
    });
    return true;
  } catch (err) {
    console.error("AddPasswordHistory err:", err);
    return false;
  }
}

export async function NotOldPassword(
  passwordPlain: string,
  userId: string
): Promise<string> {
  try {
    // fetch last 5 passwords
    const history = await prisma.oldPassword.findMany({
      where: { userId: userId },
      orderBy: { id: "desc" },
      take: 5,
    });
    for (const h of history) {
      // Assuming 'h.password' is the hashed password from DB
      // WARNING: Your original JS code compares a *plain* password to a *hashed* password from the DB.
      // This is generally incorrect for security. Assuming the `passwordPlain` argument is actually the *hashed* version
      // or that 'h.password' is *plain* for the purpose of conversion fidelity.
      if (h.password === passwordPlain) {
        return "You enter old password";
      }
    }
    return "0";
  } catch (err) {
    console.error("NotOldPassword err:", err);
    return "something went wrong";
  }
}

/* ------------------------------ Reset attempts (similar to login attempts) ------------------------------ */

export async function ResetAttempts(
  res: Response,
  email: string
): Promise<boolean> {
  try {
    const blocked: string | null = await redisClient.get(
      `reset:block:${email}`
    );
    if (blocked === "1") {
      SendError(
        res,
        429,
        "you are blocked wait 15 min utils you can try again"
      );
      return true;
    }
    const exists: number = await redisClient.exists(`reset:fail:${email}`);
    if (!exists) return false;

    const numStr: string | null = await redisClient.get(`reset:fail:${email}`);
    const num: number = parseInt(numStr || "0", 10);
    const ttl: number = await _getTTL(`reset:fail:${email}`);

    if (num === 3) {
      await redisClient.set(`reset:fail:${email}`, String(num + 1), {
        EX: ttl > 0 ? ttl : 300,
      });
      SendError(res, 401, "Solve Captcha first");
      return true;
    }
    if (num > 3 && num < 5) {
      const captchaPassed: number = await redisClient.exists(
        `captcha:passed:${email}`
      );
      if (!captchaPassed) {
        SendError(res, 401, "You should Solve Captcha First");
        return true;
      }
      return false;
    }
    if (num >= 5) {
      await redisClient.set(`reset:block:${email}`, "1", { EX: 5 * 60 });
      SendError(
        res,
        401,
        `You exceeded number of Attempts wait for ${ttl} seconds`
      );
      return true;
    }
    return false;
  } catch (err) {
    console.error("ResetAttempts err:", err);
    SendError(res, 500, "something went wrong");
    return true;
  }
}

export async function RsetResetAttempts(email: string): Promise<void> {
  try {
    await redisClient.del(`reset:fail:${email}`);
    await redisClient.del(`reset:block:${email}`);
  } catch (err) {
    console.error("RsetResetAttempts err:", err);
  }
}

export async function IncrResetAttempts(
  res: Response,
  email: string
): Promise<boolean> {
  try {
    const exists: number = await redisClient.exists(`reset:fail:${email}`);
    if (!exists) {
      await redisClient.set(`reset:fail:${email}`, "0", { EX: 5 });
    }
    const numStr: string | null = await redisClient.get(`reset:fail:${email}`);
    if (!numStr) {
      SendError(res, 500, "something just went wrong");
      return false;
    }
    const num: number = parseInt(numStr.trim(), 10) || 0;
    const next: number = num + 1;
    const ttl: number = await _getTTL(`reset:fail:${email}`);
    await redisClient.set(`reset:fail:${email}`, String(next), {
      EX: ttl > 0 ? ttl : 5,
    });
    return true;
  } catch (err) {
    console.error("IncrResetAttempts err:", err);
    SendError(res, 500, "something went wrong 6");
    return false;
  }
}

/* ------------------------------ Send mailers & notifications ------------------------------ */

// export async function SendEmailSmtp(res, to, message) { ... }
export async function SendEmailSmtp(
  res: Response,
  email: string,
  message: string
): Promise<Response<any> | void> {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // TLS will be used automatically if false
      auth: {
        user: process.env.Mail_email,
        pass: process.env.Mail_password, // App password for Gmail
      },
    });

    const mailOptions = {
      from: process.env.Mail_email,
      to: email,
      subject: "Notification", // You can customize the subject
      text: message,
    };

    await transporter.sendMail(mailOptions);

    return;
  } catch (err) {
    // The error is typed as 'any' in the catch block for simplicity, but you can narrow it down (e.g., to Error)
    return SendError(
      res,
      500,
      `Something went wrong: ${(err as Error).message}`
    );
  }
}

/**
 * SendEmail and SendEmail_FAILED_LOGIN mirror Go versions: they use Sendlocation and DB user data
 */
export async function Sendlocation(
  remoteAddr: string | undefined | null
): Promise<GeoData> {
  try {
    // remoteAddr may be "ip:port" or direct ip; handle both
    let ip: string = remoteAddr || "";
    // strip IPv6 prefix or port if present
    if (ip.includes(":")) {
      // try to split host:port
      const idx: number = ip.lastIndexOf(":");
      const maybe: string = ip.substring(0, idx);
      if (maybe) ip = maybe;
    }
    // For local testing or if IP is 127.0.0.1, fallback to external ip
    if (!ip || ip === ":" || ip === "::1" || ip === "127.0.0.1") {
      ip = "8.8.8.8"; // fallback for localhost
    }
    // call ip-api.com (keep same as Go)
    if (!ip || ip === ":" || ip === "::1" || ip === "127.0.0.1") {
      ip = "8.8.8.8"; // fallback for localhost
    }
    const target: string =
      ip.includes("127.0.0.1") || ip.includes("::1") ? "8.8.8.8" : ip;
    console.log("🌍 Sending location request for:", target);
    const resp: FetchResponse = await fetch(`http://ip-api.com/json/${target}`);
    console.log("🌎 Geo API status:", resp.status);
    if (!resp.ok) throw new Error("failed to fetch geo info");
    const data: any = await resp.json();
    console.log("🌎 Geo API raw data:", data);
    if (!data || data.status !== "success")
      throw new Error("failed to get geo info");
    // normalize to GeoData fields used previously
    return {
      Query: data.query,
      Country: data.country,
      RegionName: data.regionName,
      City: data.city,
      ISP: data.isp,
      Timezone: data.timezone,
      Org: data.org,
      Status: data.status,
      Lat: Number(data.lat || 0),
      Lon: Number(data.lon || 0),
      Zip: data.zip,
      CountryCode: data.countryCode,
    };
  } catch (err) {
    throw err;
  }
}

export async function SendEmail_FAILED_LOGIN(
  res: Response,
  email: string
): Promise<void> {
  try {
    const ipAddr: string =
      (res.req as Request)?.ip ||
      (res.req as Request)?.connection?.remoteAddress ||
      "0.0.0.0";
    const geo: GeoData | null = await Sendlocation(ipAddr).catch(() => null);

    const user = await prisma.user.findUnique({ where: { email } });
    const message: string = `Hello ${user?.username || ""},

We noticed multiple failed login attempts on your account using the email: ${email}.

📍 Location Details:
- IP Address: ${geo?.Query || ipAddr}
- Country: ${geo?.Country || ""}
- Region: ${geo?.RegionName || ""}
- City: ${geo?.City || ""}
- ISP: ${geo?.ISP || ""}
- Organization: ${geo?.Org || ""}
- Timezone: ${geo?.Timezone || ""}
🕒 Time: ${new Date().toISOString()}

As a security precaution, we’ve temporarily blocked login from this IP for 15 minutes.

If this wasn’t you, we recommend:
- Changing your password immediately.
- Enabling extra security options, like 2FA.

Stay safe,
The Racist Team
`;
    // res is passed to SendEmailSmtp, which handles the response
    await SendEmailSmtp(res, email, message);
  } catch (err) {
    console.error("SendEmail_FAILED_LOGIN err:", err);
  }
}

export async function SendEmail(res: Response, email: string): Promise<void> {
  try {
    const ipAddr: string =
      (res.req as Request)?.ip ||
      (res.req as Request)?.connection?.remoteAddress ||
      "0.0.0.0";
    const geo: GeoData | null = await Sendlocation(ipAddr).catch(() => null);
    const user = await prisma.user.findUnique({ where: { email } });
    const message: string = `Subject: 🎉 Welcome to Racist Team, ${
      user?.username || ""
    }!

Hello ${user?.username || ""} 👋,

Welcome aboard! Your account with the email: ${email} has just been created successfully.

🗺️ Location at Signup:
- IP Address: ${geo?.Query || ipAddr}
- Country: ${geo?.Country || ""}
- Region: ${geo?.RegionName || ""}
- City: ${geo?.City || ""}
- ISP: ${geo?.ISP || ""}
- Organization: ${geo?.Org || ""}
- Timezone: ${geo?.Timezone || ""}

🕒 Signup Time: ${new Date().toISOString()}

Cheers,
The Racist Team
`;
    // res is passed to SendEmailSmtp, which handles the response
    await SendEmailSmtp(res, email, message);
  } catch (err) {
    console.error("SendEmail err:", err);
  }
}

/* ------------------------------ Device info / Session helpers ------------------------------ */

/**
 * SetDeviceInfo(req, res, email) -> returns {devid, deviceRecord} or throws on failure
 * Mirrors the Go logic: stores or updates DeviceRecord by userID
 */
// The original function returns 0 on failure, so I'll adjust the return type and keep the internal logic
export async function SetDeviceInfo(
  req: Request,
  res: Response,
  email: string
): Promise<{ devid: string; deviceRecord: any }> {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("failed to load user");
    }
    const ip: string = req.ip || req.connection?.remoteAddress || "0.0.0.0";
    const browser: string = req.get("User-Agent") || "";

    let geo: GeoData;
    try {
      geo = await Sendlocation(ip);
    } catch (err) {
      throw new Error("something went wrong");
    }
    console.log("Inside SetDeviceInfo received user:", user);

    // Upsert device record: find existing by userID, then update or create
    const existing = await prisma.deviceRecord.findFirst({
      where: { userId: user.id },
    });
    if (existing) {
      const updated = await prisma.deviceRecord.update({
        where: { id: existing.id },
        data: {
          city: geo?.City,
          region: geo?.RegionName,
          country: geo?.Country,
          lat: geo?.Lat,
          lon: geo?.Lon,
          zipcode: geo?.Zip,
          locale: `en-${geo?.CountryCode || ""}`,
          browser,
          lastLogin: new Date(),
        },
      });
      (req as any).devid = updated.id;
      let devid: string = updated.id;
      return { devid, deviceRecord: updated };
    } else {
      const created = await prisma.deviceRecord.create({
        data: {
          userId: user.id,
          city: geo?.City,
          region: geo?.RegionName,
          country: geo?.Country,
          lat: geo?.Lat,
          lon: geo?.Lon,
          zipcode: geo?.Zip,
          locale: `en-${geo?.CountryCode || ""}`,
          browser,
          lastLogin: new Date(),
        },
      });
      (req as any).devid = created.id;
      let devid: string = created.id;
      return { devid, deviceRecord: created };
    }
  } catch (err) {
    console.error("SetDeviceInfo err:", err);
    throw new Error("something went wrong");
  }
}

/* ------------------------------ Email change helper ------------------------------ */

export async function VerifEmailHelper(
  res: Response,
  email: string,
  oldEmail: string
): Promise<boolean> {
  try {
    const code: string = String(Math.floor(Math.random() * 1_000_000)).padStart(
      6,
      "0"
    );
    await redisClient.set(`ChangeEmail:code:${oldEmail}`, code, {
      EX: 10 * 60,
    });
    const message: string = `Hello,

We received a request to change the email address associated with your account. To confirm this change and verify your new email address, please use the verification code below:

🔐 Verification Code: ${code}

This code is valid for the next 10 minutes.

Stay safe,
The SOAH Security Team
`;
    // Note: here we don't pass a res; SendEmailSmtp handles sending and errors
    await SendEmailSmtp(res, email, message);
    return true;
  } catch (err) {
    console.error("VerifEmailHelper err:", err);
    return false;
  }
}

/* ------------------------------ Password validation & analysis ------------------------------ */

export async function ValidatePassword(password: string): Promise<string> {
  if (!password) return "password required";
  if (password.length < 12 || password.length > 128)
    return "password should be between 12 and 128";

  let upper: number = 0,
    lower: number = 0,
    sym: number = 0,
    num: number = 0;

  for (const ch of password) {
    if (ch >= "A" && ch <= "Z") upper++;
    else if (ch >= "a" && ch <= "z") lower++;
    else if (ch >= "0" && ch <= "9") num++;
    else sym++;
  }

  if (lower < 3) return "password should contain atleast 3 lower case char";
  if (upper < 3) return "password should contain atleast 3 upper case char";
  if (sym < 3) return "password should contain atleast 3 symbol ";
  if (num < 3) return "password should contain atleast 3 num";

  // check Pwned Passwords via k-anonymity (sha1 range API)
  const sha1sum: string = crypto
    .createHash("sha1")
    .update(password)
    .digest("hex")
    .toUpperCase();
  const prefix: string = sha1sum.slice(0, 5);
  try {
    const resp: FetchResponse = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`
    );
    if (!resp.ok) return "something went wrong while validating";
    const body: string = await resp.text();
    const lines: string[] = body.split("\r\n");
    for (const line of lines) {
      const [suffix] = line.split(":");
      if (!suffix) continue;
      if (suffix === sha1sum.slice(5)) {
        return "your password is breached";
      }
    }
  } catch (err) {
    return "something went wrong while vaildating";
  }
  return "0";
}

// You might need to import the Prisma 'User' type if you want to strictly type 'user'
export function AnalisePass(password: string, user: any): zxcvbn.ZXCVBNResult {
  // user is prisma user object
  const inputs: string[] = [
    user?.username,
    user?.email,
    user?.name,
    "SOAH",
    "support",
  ].filter(Boolean) as string[];
  return zxcvbn(password, inputs);
}

export function StricerPassword(scoreObj: zxcvbn.ZXCVBNResult): number {
  // approximate logic copied from Go
  if (new Date().getHours() > 2) {
    if (scoreObj.score < 3) return -1;
    if ((scoreObj.guesses_log10 || 0) < 6) return -1; // 10^6 guesses ~ entropy 60 bits
  }
  return 1;
}

/* ------------------------------ Sessions (Redis-backed) ------------------------------ */

/**
 * SetSession(req, res) - stores session info in redis key: session:<userId>:<jti>
 */
export async function SetSession(
  req: Request,
  userId: string,
  jti: string
): Promise<boolean> {
  try {
    if (!userId) {
      console.error("SetSession: missing user id");
      return false;
    }
    console.log("setsessions been called");
    const devid: string | null =
      (req as any).devid || (req.body as any)?.devid || null;

    const session: UserSession = {
      Jti: jti || (await uuidv4()),
      UserID: userId,
      IsActive: true,
      IssuedAT: new Date().toISOString(),
      DeviceInfoId: devid,
      ExpireAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    const key: string = `User:sessions:${userId}:${jti}`;
    console.log("Storing session in Redis key:", key, "session:", session);
    // Push new session into Redis list (acts like array)
    await redisClient.rPush(key, JSON.stringify(session));

    // Optional: keep last 10 sessions only
    await redisClient.lTrim(key, -10, -1);

    // Set TTL (expire key after 15 minutes)
    await redisClient.expire(key, 15 * 60);

    return true;
  } catch (err) {
    console.error("SetSession err:", err);
    return false;
  }
}
//////HOSSAM//////////////////
