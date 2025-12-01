/**
 * @openapi
 * /users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get all users
 *     responses:
 *       200:
 *         description: OK
 */
import express, { Router, Request, Response, NextFunction } from "express";

// Importing the default export and giving it an appropriate type (assuming it's an object of async functions)
import {authController} from "../controllers/user"; 

// Importing middleware functions (which are default exports, typically untyped in JS)
import Auth from "../middlewares/Auth";

import Reauth from "../middlewares/Reauth";
import DeactivateUser from "../middlewares/DeactivateUser";
import AfterChange from "../middlewares/AfterChange";

// Type assertion for the controller functions to satisfy TS and keep the code clean
// This assumes authController is an object where keys are controller names and values are Express handlers.
type AuthController = { 
    [key: string]: (req: Request, res: Response, next: NextFunction) => Promise<any> | void;
};
const typedAuthController = authController as AuthController;



import GeoGurd from "../middlewares/GeoGuard";
type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => Promise<any> | void;
// const typedGeoGurd = GeoGurd as unknown as MiddlewareFunction;
// // Define the type for an Express Middleware function

// const typedAuth = Auth as unknown as MiddlewareFunction;

// const typedReauth = Reauth as unknown as MiddlewareFunction;
// const typedDeactivateUser = DeactivateUser as unknown as MiddlewareFunction;
// const typedAfterChange = AfterChange as unknown as MiddlewareFunction;

const router: Router = express.Router();

// --- Auth Routes ---
/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Register a new user
 *     description: Creates a new user account, validates Captcha for web clients, and sends a verification email containing a 6-digit code that expires in 15 minutes.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: header
 *         name: x-client-type
 *         schema:
 *           type: string
 *           example: web
 *         required: false
 *         description: Indicates the client type (e.g., "web" for browser clients requiring Captcha verification)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - dateOfBirth
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name of the user
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Valid email address of the user
 *                 example: "john@example.com"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: User's date of birth in YYYY-MM-DD format
 *                 example: "2003-05-21"
 *     responses:
 *       200:
 *         description: User registration initiated successfully. Verification email sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User registered successfully. Please verify your email to continue."
 *       400:
 *         description: Invalid or missing request fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Missing required fields"
 *       401:
 *         description: Captcha verification required for web clients.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "You must solve Captcha first"
 *       409:
 *         description: Email address is already associated with an existing account.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email already in use"
 *       500:
 *         description: Internal server error or failed email delivery.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to send verification email"
 */

router.post("/signup", typedAuthController.Create); //tested
/**
 * @swagger
 * /finalize_signup:
 *   post:
 *     summary: Finalize user signup by setting a password
 *     description: |
 *       Completes the signup process after successful email verification.  
 *       Accepts the user's verified email and chosen password, creates the user in the database,  
 *       sends a welcome email, generates access/refresh tokens, and deletes temporary Redis data.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's verified email address
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Strong password (min. 8 characters)
 *                 example: "StrongPassword123!"
 *     responses:
 *       201:
 *         description: Signup finalized successfully. User account created, tokens issued, and welcome email sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Signup complete. Welcome!"
 *                 user:
 *                   type: object
 *                   description: Newly created user object (password/salt omitted)
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "c8f26a23-8bc9-4e9a-9f1d-2e8f7f3a90aa"
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       example: "john@example.com"
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "2003-05-21"
 *                     isEmailVerified:
 *                       type: boolean
 *                       example: true
 *                 device:
 *                   type: object
 *                   description: Information about the registered device
 *                   example:
 *                     id: "device_abc123"
 *                     userAgent: "Mozilla/5.0"
 *                     ipAddress: "192.168.1.15"
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     refreshToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Missing email or password, or verification step not completed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "You must verify your email first"
 *       401:
 *         description: Password validation failed (if enforced).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password too weak"
 *       409:
 *         description: User already exists or signup already completed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User already exists"
 *       500:
 *         description: Internal server error or failed to send welcome email.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Failed to send welcome email"
 */

router.post("/finalize_signup", typedAuthController.FinalizeSignup); // tested
/**
 * @swagger
 * /verify-signup:
 *   post:
 *     summary: Verify signup email with a 6-digit code
 *     description: >
 *       Verifies the user's email address using the 6-digit code sent to their inbox during signup.
 *       After successful verification, the user can finalize their signup by setting a password via finalize_signup**.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The user's email address used during signup
 *                 example: "john@example.com"
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 description: The 6-digit verification code sent via email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified successfully. User may now proceed to finalize signup.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Email verified successfully, please set your password."
 *       400:
 *         description: Missing required fields, expired verification session, or user data missing.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Verification session expired, please sign up again"
 *       401:
 *         description: Incorrect or invalid verification code.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Verification code is incorrect"
 *       500:
 *         description: Internal server error or Redis failure.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Server error occurred during verification"
 */

router.post("/verify-signup", typedAuthController.Verify_signup_email); //tested
/**
 * @swagger
 * /login:
 *   post:
 *     summary: User login with credentials
 *     description: >
 *       Authenticates a user using their **email** and **password**.  
 *       Returns both access and refresh tokens, sets a secure cookie for the refresh token,  
 *       and sends login notifications (email & in-app).  
 *       Rate-limited and device-tracked for enhanced security.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Registered email of the user
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *                 example: "StrongPassword123!"
 *     responses:
 *       200:
 *         description: Login successful — tokens issued and notifications sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 User:
 *                   type: object
 *                   description: Authenticated user details
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "cfe12a34-b5c6-7d89-e012-3456789abcde"
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 *                     email:
 *                       type: string
 *                       example: "john@example.com"
 *                     isEmailVerified:
 *                       type: boolean
 *                       example: true
 *                 DeviceRecord:
 *                   type: string
 *                   description: Information about the device used for login
 *                   example: "Windows 11 - Chrome 120"
 *                 Token:
 *                   type: string
 *                   description: Short-lived access token (JWT)
 *                 Refresh_token:
 *                   type: string
 *                   description: Long-lived refresh token (JWT)
 *                 message:
 *                   type: string
 *                   example: "Login successful, email & in-app notification sent"
 *       400:
 *         description: Missing required fields (email or password)
 *       401:
 *         description: Invalid credentials (wrong email or password)
 *       403:
 *         description: Invalid email format
 *       429:
 *         description: Too many login attempts — try again later
 *       500:
 *         description: Internal server error or email sending failure
 */
router.post("/login", typedAuthController.Login); //tested
// /**
//  * @swagger
//  * /verify-login:
//  *   post:
//  *     summary: Verify login with code
//  *     description: Verifies the login code sent to the user's email or device.
//  *     tags:
//  *       - Auth
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - email
//  *               - code
//  *             properties:
//  *               email:
//  *                 type: string
//  *                 example: "john@example.com"
//  *               code:
//  *                 type: string
//  *                 example: "458973"
//  *     responses:
//  *       200:
//  *         description: Login verified successfully
//  *       400:
//  *         description: Invalid verification code or expired session
//  */
// router.post("/verify-login", typedAuthController.Verify_email); //tested

// --- 2FA / Login Code Setup & Verification Routes (Require Auth & AdminAuth) ---
// /**
//  * @openapi
//  * /2fa/setup:
//  *   post:
//  *     tags:
//  *       - Auth
//  *     summary: Initialize 2FA setup for the authenticated user
//  *     description: Generates a secret key and QR code for enabling two-factor authentication (TOTP) for the logged-in user.
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Returns the generated 2FA secret and QR code URL.
//  *       401:
//  *         description: Unauthorized, missing or invalid token.
//  *       500:
//  *         description: Server error during 2FA setup.
//  */
// router.post("/2fa/setup", Auth(),  typedAuthController.Create_2fA); //tested
// /**
//  * @openapi
//  * /2fa/verify:
//  *   post:
//  *     tags:
//  *       - Auth
//  *     summary: Verify a 2FA token during setup or login
//  *     description: Verifies the TOTP token entered by the user during setup or when logging in with 2FA enabled.
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               token:
//  *                 type: string
//  *                 example: "123456"
//  *     responses:
//  *       200:
//  *         description: 2FA verified successfully.
//  *       400:
//  *         description: Invalid 2FA code or expired token.
//  *       500:
//  *         description: Internal server error during verification.
//  */
// router.post("/2fa/verify", typedAuthController.Verify_2fA); //tested
// /**
//  * @openapi
//  * /generate-login-codes:
//  *   post:
//  *     tags:
//  *       - Auth
//  *     summary: Generate backup login codes for the authenticated user
//  *     description: Generates a set of backup login codes that can be used if the user loses access to their 2FA device.
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Returns a list of backup login codes.
//  *       401:
//  *         description: Unauthorized, missing or invalid token.
//  *       500:
//  *         description: Server error generating login codes.
//  */

// router.post("/generate-login-codes", Auth(),  typedAuthController.GenerteLoginCodes); //tested
// /**
//  * @openapi
//  * /verify-login-code:
//  *   post:
//  *     tags:
//  *       - Auth
//  *     summary: Verify a backup login code
//  *     description: Verifies one of the backup login codes generated by the user for account recovery or emergency access.
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               code:
//  *                 type: string
//  *                 example: "ABCD-1234"
//  *     responses:
//  *       200:
//  *         description: Login code verified successfully.
//  *       400:
//  *         description: Invalid or already used code.
//  *       500:
//  *         description: Server error during login code verification.
//  */
// router.post("/verify-login-code", typedAuthController.VerifyLoginCode); //tested

// --- Password Management Routes ---

/**
 * @openapi
 * /forget-password:
 *   post:
 *     tags:
 *       - Password Management
 *     summary: Request password reset
 *     description: Sends a password reset code or link to the user's email for account recovery.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *     responses:
 *       200:
 *         description: Password reset code sent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Reset code sent via email. Check your inbox!
 *       400:
 *         description: Missing or invalid email address.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error while sending reset code.
 */
router.post("/forget-password",  typedAuthController.ForgetPassword);
/**
 * @openapi
 * /verify-reset-code:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verify password reset code
 *     description: Verifies the reset code sent to the user's email. Once verified, the user can proceed to reset the password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The email of the user requesting password reset.
 *               code:
 *                 type: string
 *                 description: The 6-digit reset code sent to the user's email.
 *     responses:
 *       200:
 *         description: Reset code verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Reset code verified, you can now enter a new password"
 *       400:
 *         description: Validation error or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid reset code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

router.post("/verify-reset-code", typedAuthController.VerifyResetCode);

/**
 * @openapi
 * /reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reset user password
 *     description: Allows a user to reset their password after verifying the reset code. No login required.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - resetCode
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The user's email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: The new password
 *                 example: "NewStrongPass@2025"
 *               resetCode:
 *                 type: string
 *                 description: Code sent to user's email for password reset
 *                 example: "123456"
 *
 *     responses:
 *       200:
 *         description: Password reset successfully, notification sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password reset successfully, notification sent"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     dateOfBirth:
 *                       type: string
 *                     isEmailVerified:
 *                       type: boolean
 *                 refreshtoken:
 *                   type: string
 *                   description: JWT refresh token
 *                 accesstoken:
 *                   type: string
 *                   description: JWT access token
 *
 *       400:
 *         description: Validation error or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email, password, and reset code are required"
 *
 *       401:
 *         description: Invalid reset code or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid or expired reset code"
 *
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *
 *       500:
 *         description: Internal server error (email sending / DB update failed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

router.post("/reset-password",  typedAuthController.ResetPassword);

// --- Session & Logout Routes ---
/**
 * @openapi
 * /refresh:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Refresh access token
 *     description: Generates a new short-lived access token using a valid refresh token provided in the request body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: New access token generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...                
 *       401:
 *         description: Missing or invalid refresh token.
 *       500:
 *         description: Internal server error during token refresh.
 */
router.post("/refresh",  typedAuthController.Refresh);
/**
 * @openapi
 * /logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Logout current user
 *     description: Ends the current user session and invalidates both access and refresh tokens.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful, session terminated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out successfully.
 *       401:
 *         description: Unauthorized or invalid session.
 *       500:
 *         description: Internal server error during logout.
 */
router.post("/logout", Auth(),  typedAuthController.Logout, DeactivateUser()); //tested
/**
 * @swagger
 * /logout-all:
 *   post:
 *     summary: Logout from all active sessions
 *     description: Logs the user out from all devices and deactivates their account if required.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions terminated successfully.
 *       401:
 *         description: Unauthorized or invalid token.
 */
router.post("/logout-all", Auth(),  typedAuthController.LogoutALL, DeactivateUser());

// --- Captcha Routes ---
/**
 * @swagger
 * /captcha:
 *   get:
 *     summary: Get a CAPTCHA challenge
 *     description: Returns a CAPTCHA image or token for verifying user signup or login actions.
 *     tags:
 *       - Captcha
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CAPTCHA challenge generated successfully.
 *       401:
 *         description: Unauthorized request.
 */
router.get("/captcha", Auth(),  typedAuthController.Captcha);
/**
 * @swagger
 * /signup_captcha:
 *   get:
 *     summary: Signup CAPTCHA verification
 *     description: Marks CAPTCHA as passed for the given email.  
 *                  No body required; email is passed as query parameter.  
 *                  Returns a message confirming CAPTCHA verification.
 *     tags:
 *       - Captcha
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           example: "john@example.com"
 *         description: Email for which CAPTCHA was completed
 *     responses:
 *       200:
 *         description: CAPTCHA verified successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 Message:
 *                   type: string
 *                   example: "You passed the Captcha, you can register now"
 *       400:
 *         description: Invalid or missing email.
 */
router.post("/signup_captcha",  typedAuthController.SignupCaptcha); //tested

// --- Re-Authentication Routes ---
/**
 * @swagger
 * /reauth-password:
 *   post:
 *     summary: Reauthenticate using password
 *     description: Confirms the user's identity by verifying their password before sensitive actions.
 *     tags:
 *       - Reauthentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: "StrongPassword123!"
 *     responses:
 *       200:
 *         description: Reauthentication successful.
 *       401:
 *         description: Invalid password.
 */
router.post("/reauth-password", Auth() , typedAuthController.ReauthPassword);
// /**
//  * @swagger
//  * /reauth-tfa:
//  *   post:
//  *     summary: Reauthenticate using Two-Factor Authentication
//  *     description: Confirms identity by verifying the user's TOTP or 2FA code.
//  *     tags:
//  *       - Reauthentication
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - code
//  *             properties:
//  *               code:
//  *                 type: string
//  *                 example: "428913"
//  *     responses:
//  *       200:
//  *         description: Two-Factor reauthentication successful.
//  *       400:
//  *         description: Invalid or expired code.
//  */
// router.post("/reauth-tfa", Auth(),  typedAuthController.ReauthTFA); //tested
// /**
//  * @swagger
//  * /reauth-code:
//  *   post:
//  *     summary: Reauthenticate using backup code
//  *     description: Confirms identity using a backup code as an alternative to password or TFA.
//  *     tags:
//  *       - Reauthentication
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - backupCode
//  *             properties:
//  *               backupCode:
//  *                 type: string
//  *                 example: "ABCD-1234"
//  *     responses:
//  *       200:
//  *         description: Backup code verified successfully.
//  *       400:
//  *         description: Invalid or expired backup code.
//  */
// router.post("/reauth-code", Auth(),  typedAuthController.ReauthCode); //tested

// --- Sensitive Change Routes (Require Auth & Reauth) ---

/**
 * @openapi
 * /change-password:
 *   post:
 *     summary: Change user password
 *     description: >
 *       Allows an authenticated user to change their account password after validating the old one.
 *       The system checks password strength, prevents reuse of old passwords, updates the stored hash
 *       with a new salt, increments `tokenVersion` to invalidate previous tokens, and logs password
 *       history for security. A security notification email is then sent to the account owner.
 *       This endpoint requires a valid Bearer token.
 *
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 example: "OldPass@2024"
 *               newPassword:
 *                 type: string
 *                 example: "NewStrongPass@2025"
 *               confirmPassword:
 *                 type: string
 *                 example: "NewStrongPass@2025"
 *
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password updated successfully"
 *                 score:
 *                   type: object
 *                   description: Password strength analysis result
 *                   properties:
 *                     score:
 *                       type: integer
 *                       example: 3
 *                     crack_times_display:
 *                       type: object
 *                       example:
 *                         offline_fast_hashing_1e10_per_second: "centuries"
 *                         online_no_throttling_10_per_second: "months"
 *                     feedback:
 *                       type: object
 *                       properties:
 *                         warning:
 *                           type: string
 *                           example: "Repeats like 'aaa' are easy to guess"
 *                         suggestions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example:
 *                             - "Use a longer password"
 *                             - "Add more unpredictable words"
 *
 *       400:
 *         description: Validation failed (missing fields, weak password, confirmation mismatch, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Confirm password does not match the new password"
 *
 *       401:
 *         description: Old password incorrect or reauthentication required.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error while updating password or sending notification email.
 */

router.post("/change-password", Auth(), typedAuthController.ChangePassword); //tested

/**
 * @swagger
 * /change-email:
 *   post:
 *     summary: Request email change
 *     description: Sends a 6-digit verification code to the new email. The change will be finalized after verifying the code using `/verify-new-email`.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *             properties:
 *               newEmail:
 *                 type: string
 *                 example: "newemail@example.com"
 *     responses:
 *       200:
 *         description: Verification code sent successfully to the new email.
 *       400:
 *         description: Invalid email format.
 *       401:
 *         description: Unauthorized or current email missing.
 *       409:
 *         description: Email already exists.
 *       500:
 *         description: Internal server error.
 */
router.post("/change-email", Auth(), typedAuthController.ChangeEmail); //tested

/**
 * @swagger
 * /verify-new-email:
 *   post:
 *     summary: Verify and finalize email change
 *     description: Confirms the email change using the code sent to the new address. Issues new access & refresh tokens with the updated email.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - desiredEmail
 *               - code
 *             properties:
 *               desiredEmail:
 *                 type: string
 *                 example: "newemail@example.com"
 *               code:
 *                 type: string
 *                 example: "842613"
 *     responses:
 *       200:
 *         description: Email changed and verified successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email changed successfully
 *                 newEmail:
 *                   type: string
 *                   example: "newemail@example.com"
 *                 Token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 Refresh_token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Invalid or expired verification code.
 *       401:
 *         description: Email mismatch or unauthorized.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error.
 */
router.post("/verify-new-email",Auth(),  typedAuthController.VerifyNewEmail); //tested

// --- User Info & Session Retrieval/Management Routes ---
/**
 * @swagger
 * /user:
 *   get:
 *     summary: Get authenticated user info including device history
 *     description: Returns user profile data and previously logged device information.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information with device records
 *         content:
 *           application/json:
 *             example:
 *               user:
 *                 id: "uuid"
 *                 username: "master_hossam"
 *                 name: "Hossam"
 *                 email: "test@example.com"
 *                 dateOfBirth: "2003-10-02"
 *                 isEmailVerified: true
 *                 bio: "Backend engineer"
 *                 protectedAcc: false
 *               DeviceRecords:
 *                 - id: "device-id"
 *                   ip: "102.xx.xx.1"
 *                   agent: "Firefox on Ubuntu"
 *                   location: "Cairo, Egypt"
 *                   updatedAt: "2025-11-18T14:22:10Z"
 *               message: "User info returned with device history"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */

router.get("/user", Auth(),  typedAuthController.GetUser); //tested
/**
 * @swagger
 * /userinfo:
 *   get:
 *     summary: Get authenticated user info (Reauthentication required)
 *     description: Same response as /user but requires a recent reauthentication step before accessing sensitive screens.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully returned user info and device history
 *         content:
 *           application/json:
 *             example:
 *               user:
 *                 id: "uuid"
 *                 username: "master_hossam"
 *                 name: "Hossam"
 *                 email: "user@example.com"
 *                 dateOfBirth: "2003-10-02"
 *                 isEmailVerified: true
 *                 bio: "Backend engineer"
 *                 protectedAcc: false
 *               DeviceRecords:
 *                 - id: "device-id"
 *                   ip: "102.xx.xx.1"
 *                   agent: "Firefox on Ubuntu Linux"
 *                   location: "Cairo, Egypt"
 *                   updatedAt: "2025-11-18T14:22:10Z"
 *               message: "User info returned with device history"
 *       401:
 *         description: Unauthorized or reauthentication required
 *       404:
 *         description: User not found
 */
router.get("/userinfo",Auth(),typedAuthController.GetUserz); //tested
/**
 * @swagger
 * /sessions:
 *   get:
 *     summary: Get user active sessions
 *     description: Returns all currently active sessions for the authenticated user.
 *     tags:
 *       - Session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully.
 *       401:
 *         description: Unauthorized access.
 */
router.get("/sessions", Auth(),  typedAuthController.GetSession); //tested
/**
 * @swagger
 * /session/{sessionid}:
 *   delete:
 *     summary: Logout specific session
 *     description: Deletes a specific active session using its session ID.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionid
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to terminate.
 *     responses:
 *       200:
 *         description: Session deleted successfully.
 *       404:
 *         description: Session not found.
 */
router.delete("/session/:sessionid", Auth(),  typedAuthController.LogoutSession);
// router.post("/debug-redis",Auth(),typedAuthController.DebugRedis); //tested
// --- Post-Request Cleanup Middleware ---
/**
 * @swagger
 * /update_username:
 *   put:
 *     summary: Update current user's username
 *     description: Updates the authenticated user's username and issues new access & refresh tokens with an incremented token version.
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 example: "new_username123"
 *     responses:
 *       200:
 *         description: Username updated successfully and new tokens issued.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Username updated successfully 
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: clu6wq2k90001x3sdo8v9l0k4
 *                     username:
 *                       type: string
 *                       example: new_username123
 *                     tokenVersion:
 *                       type: integer
 *                       example: 5
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     access:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refresh:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Invalid username.
 *       401:
 *         description: Unauthorized or missing user ID.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error.
 */
router.put("/update_username",Auth(),typedAuthController.UpdateUsername);
/**
 * @swagger
 * /getUser:
 *   post:
 *     summary: Check if a user email exists
 *     description: Verifies whether a given email address is already registered in the database.
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Successfully checked if the email exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   description: True if user exists, false otherwise
 *                   example: true
 *       400:
 *         description: Missing or invalid email in request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: email is required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal Server Error
 */
router.post("/getUser",typedAuthController.CheckEmail);

/**
 * @swagger
 * /user/{id}/email:
 *   get:
 *     summary: Get user's email by ID
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: User email retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                   example: user@example.com
 *       400:
 *         description: User ID is missing
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/user/:id/email", Auth(),typedAuthController.GetUserEmailById);
//temp routes for searchEngine
/**
 * @swagger
 * components:
 *   schemas:
 *     IndexStats:
 *       type: object
 *       properties:
 *         totalDocuments:
 *           type: integer
 *           example: 1000
 *         totalTerms:
 *           type: integer
 *           example: 5000
 *         tweets:
 *           type: integer
 *           example: 500
 *         users:
 *           type: integer
 *           example: 300
 *         hashtags:
 *           type: integer
 *           example: 200
 *         urls:
 *           type: integer
 *           example: 0
 *         averageDocLength:
 *           type: integer
 *           example: 45
 *         indexSize:
 *           type: string
 *           example: "2.34 MB"
 *
 *     SearchResult:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "tweet_12345"
 *         type:
 *           type: string
 *           enum: [tweet, user, hashtag, url]
 *           example: "tweet"
 *         score:
 *           type: number
 *           format: float
 *           example: 45.67
 *         tfidfScore:
 *           type: number
 *           format: float
 *           example: 12.34
 *         relevance:
 *           type: integer
 *           example: 89
 *         matchedTokens:
 *           type: array
 *           items:
 *             type: string
 *           example: ["nodejs", "javascript"]
 *         data:
 *           type: object
 *           example:
 *             id: "tweet_12345"
 *             content: "Learning Node.js is awesome"
 *             username: "johndev"
 *             likesCount: 150
 *
 *     PaginatedSearchResponse:
 *       type: object
 *       properties:
 *         query:
 *           type: string
 *           example: "nodejs"
 *         type:
 *           type: string
 *           example: "all"
 *         results:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SearchResult'
 *         total:
 *           type: integer
 *           example: 250
 *         page:
 *           type: integer
 *           example: 1
 *         pageSize:
 *           type: integer
 *           example: 20
 *         pages:
 *           type: integer
 *           example: 13
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:45.123Z"
 *
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "tweet_12345"
 *         type:
 *           type: string
 *           enum: [tweet, user, hashtag, url]
 *           example: "tweet"
 *         tokensCount:
 *           type: integer
 *           example: 25
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:45.123Z"
 *         data:
 *           type: object
 *
 *     Term:
 *       type: object
 *       properties:
 *         term:
 *           type: string
 *           example: "nodejs"
 *         frequency:
 *           type: integer
 *           example: 1234
 *         documentCount:
 *           type: integer
 *           example: 456
 *
 *     HealthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: "ok"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:45.123Z"
 *         index:
 *           $ref: '#/components/schemas/IndexStats'
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Failed to index tweets"
 *         details:
 *           type: string
 *           example: "Connection timeout"
 *
 *   responses:
 *     BadRequest:
 *       description: Bad request. Invalid parameters.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *
 *     NotFound:
 *       description: Resource not found.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *
 *     InternalServerError:
 *       description: Internal server error.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the search engine is running and get index statistics
 *     tags:
 *       - Health & Status
 *     responses:
 *       200:
 *         description: Search engine is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: Get index statistics
 *     description: Returns detailed statistics about the search index including document counts, terms, and size
 *     tags:
 *       - Health & Status
 *     responses:
 *       200:
 *         description: Index statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IndexStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /index/tweets:
 *   post:
 *     summary: Index tweets from database
 *     description: Crawl and index tweets from the database with optional pagination
 *     tags:
 *       - Indexing - Tweets
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 default: 100
 *                 example: 100
 *                 description: Number of tweets to index
 *               offset:
 *                 type: integer
 *                 default: 0
 *                 example: 0
 *                 description: Starting offset for pagination
 *     responses:
 *       200:
 *         description: Tweets indexed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully indexed 100 tweets"
 *                 count:
 *                   type: integer
 *                   example: 100
 *                 stats:
 *                   $ref: '#/components/schemas/IndexStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /index/users:
 *   post:
 *     summary: Index users from database
 *     description: Crawl and index users from the database with optional pagination
 *     tags:
 *       - Indexing - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 default: 100
 *                 example: 100
 *               offset:
 *                 type: integer
 *                 default: 0
 *                 example: 0
 *     responses:
 *       200:
 *         description: Users indexed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully indexed 100 users"
 *                 count:
 *                   type: integer
 *                   example: 100
 *                 stats:
 *                   $ref: '#/components/schemas/IndexStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /index/hashtags:
 *   post:
 *     summary: Index hashtags from database
 *     description: Crawl and index hashtags from the database with optional pagination
 *     tags:
 *       - Indexing - Hashtags
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 default: 100
 *                 example: 100
 *               offset:
 *                 type: integer
 *                 default: 0
 *                 example: 0
 *     responses:
 *       200:
 *         description: Hashtags indexed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully indexed 100 hashtags"
 *                 count:
 *                   type: integer
 *                   example: 100
 *                 stats:
 *                   $ref: '#/components/schemas/IndexStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /index/batch:
 *   post:
 *     summary: Batch index large datasets
 *     description: Crawl and index large amounts of data (tweets, users, or hashtags) in optimized batches for scalability
 *     tags:
 *       - Indexing - Batch
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [tweets, users, hashtags]
 *                 example: tweets
 *                 description: Type of data to index
 *               limit:
 *                 type: integer
 *                 default: 5000
 *                 example: 5000
 *                 description: Total number of items to index (processes in 500-item batches)
 *     responses:
 *       200:
 *         description: Batch indexing completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully batch indexed 5000 tweets"
 *                 count:
 *                   type: integer
 *                   example: 5000
 *                 stats:
 *                   $ref: '#/components/schemas/IndexStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /index/all:
 *   post:
 *     summary: Index all data types
 *     description: Crawl and index tweets, users, and hashtags from the database simultaneously
 *     tags:
 *       - Indexing - All
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 default: 100
 *                 example: 100
 *     responses:
 *       200:
 *         description: All data indexed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully indexed all data"
 *                 counts:
 *                   type: object
 *                   properties:
 *                     tweets:
 *                       type: integer
 *                       example: 100
 *                     users:
 *                       type: integer
 *                       example: 100
 *                     hashtags:
 *                       type: integer
 *                       example: 100
 *                 stats:
 *                   $ref: '#/components/schemas/IndexStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Search across all content types
 *     description: Perform a global search with advanced options including fuzzy matching, phrase search, and pagination
 *     tags:
 *       - Search - Global
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         example: nodejs
 *         description: Search query
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         example: 20
 *         description: Results per page (max 100)
 *       - name: offset
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         example: 0
 *         description: Pagination offset
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [all, tweet, user, hashtag, url]
 *           default: all
 *         example: all
 *         description: Filter results by content type
 *       - name: fuzzy
 *         in: query
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         example: false
 *         description: Enable fuzzy matching for typo tolerance
 *       - name: phrase
 *         in: query
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         example: false
 *         description: Enable phrase search for exact multi-word matching
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedSearchResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /search/{type}:
 *   get:
 *     summary: Search by specific content type
 *     description: Search within a specific type (tweet, user, hashtag, or url) with advanced filtering options
 *     tags:
 *       - Search - By Type
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [tweet, user, hashtag, url]
 *         example: tweet
 *         description: Content type to search in
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         example: javascript
 *         description: Search query
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         example: 20
 *         description: Results per page
 *       - name: offset
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         example: 0
 *         description: Pagination offset
 *       - name: fuzzy
 *         in: query
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         example: false
 *         description: Enable fuzzy matching
 *       - name: phrase
 *         in: query
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         example: false
 *         description: Enable phrase search
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedSearchResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /documents:
 *   get:
 *     summary: Retrieve indexed documents
 *     description: Get a list of all indexed documents with optional filtering by type
 *     tags:
 *       - Documents
 *     parameters:
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [tweet, user, hashtag, url]
 *         example: tweet
 *         description: Filter documents by type
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *           maximum: 1000
 *         example: 100
 *         description: Maximum documents to return
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 500
 *                 returned:
 *                   type: integer
 *                   example: 100
 *                 type:
 *                   type: string
 *                   example: tweet
 *                 documents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /terms:
 *   get:
 *     summary: Get most frequent terms in index
 *     description: Retrieve the most frequently occurring terms in the index with their document frequency statistics
 *     tags:
 *       - Analytics
 *     parameters:
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 500
 *         example: 50
 *         description: Number of top terms to return
 *     responses:
 *       200:
 *         description: Terms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 5000
 *                 returned:
 *                   type: integer
 *                   example: 50
 *                 terms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Term'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /crawl:
 *   post:
 *     summary: Crawl and index a single URL
 *     description: Fetch a URL, parse its content, and add it to the search index
 *     tags:
 *       - Web Crawling
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com
 *                 description: URL to crawl and index
 *     responses:
 *       200:
 *         description: URL crawled and indexed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "URL crawled and indexed successfully"
 *                 documentId:
 *                   type: string
 *                   example: "https://example.com"
 *                 url:
 *                   type: string
 *                   example: "https://example.com"
 *                 title:
 *                   type: string
 *                   example: "Example Domain"
 *                 tokensCount:
 *                   type: integer
 *                   example: 45
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /crawl/batch:
 *   post:
 *     summary: Crawl and index multiple URLs
 *     description: Fetch multiple URLs in parallel, parse their content, and add them to the search index
 *     tags:
 *       - Web Crawling
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - urls
 *             properties:
 *               urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 example:
 *                   - https://example.com
 *                   - https://example.org
 *                   - https://example.net
 *                 description: Array of URLs to crawl
 *     responses:
 *       200:
 *         description: URLs crawled and indexed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "URLs crawled and indexed successfully"
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       url:
 *                         type: string
 *                       title:
 *                         type: string
 *                       type:
 *                         type: string
 *                       tokensCount:
 *                         type: integer
 *                 stats:
 *                   $ref: '#/components/schemas/IndexStats'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /index/save:
 *   post:
 *     summary: Save index to Redis
 *     description: Persist the current search index to Redis for fault tolerance and recovery
 *     tags:
 *       - Persistence
 *     responses:
 *       200:
 *         description: Index saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Index saved to Redis successfully"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /index/load:
 *   post:
 *     summary: Load index from Redis
 *     description: Restore a previously saved search index from Redis
 *     tags:
 *       - Persistence
 *     responses:
 *       200:
 *         description: Index loaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Index loaded from Redis"
 *                 data:
 *                   $ref: '#/components/schemas/IndexStats'
 *       404:
 *         description: Index not found in Redis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /index/clear:
 *   delete:
 *     summary: Clear the entire search index
 *     description: Remove all documents and indexes from memory. WARNING - This operation cannot be undone without reindexing
 *     tags:
 *       - Index Management
 *     responses:
 *       200:
 *         description: Index cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Index cleared successfully"
 *                 stats:
 *                   $ref: '#/components/schemas/IndexStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

router.use(AfterChange());
router.use(GeoGurd());
export default router;