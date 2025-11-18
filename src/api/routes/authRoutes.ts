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
 *     description: Allows a user to reset their password after verifying the reset code. Requires email and new password.
 *     security:
 *       - bearerAuth: []   # assuming Auth() middleware uses Bearer token
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
 *                 description: The email of the user whose password is being reset.
 *               password:
 *                 type: string
 *                 format: password
 *                 description: The new password to set for the user.
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
 *       400:
 *         description: Validation error or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid reset code or unauthorized
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
 *       500:
 *         description: Internal server error (email sending / DB update failed)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *     summary: Get current user information
 *     description: Retrieves information about the authenticated user.
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User info retrieved successfully.
 *       401:
 *         description: Unauthorized or token missing.
 */
router.get("/user", Auth(),  typedAuthController.GetUser); //tested
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
router.use(AfterChange());
router.use(GeoGurd());
export default router;