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
 *     description: Creates a new user account and sends a verification email with a code.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john_doe"
 *               email:
 *                 type: string
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "StrongPassword123!"
 *     responses:
 *       201:
 *         description: User registered successfully and verification email sent
 *       400:
 *         description: Missing or invalid input fields
 *       409:
 *         description: Email already exists
 */
router.post("/signup", typedAuthController.Create); //tested
//router.post("/continue_signup",typedAuthController.ContinuS)

router.post("/verify-signup", typedAuthController.Verify_signup_email); //tested
/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login with credentials
 *     description: Authenticates the user using email and password, returns access and refresh tokens.
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
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "StrongPassword123!"
 *     responses:
 *       200:
 *         description: Login successful, tokens returned
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", typedAuthController.Login); //tested
/**
 * @swagger
 * /verify-login:
 *   post:
 *     summary: Verify login with code
 *     description: Verifies the login code sent to the user's email or device.
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
 *                 example: "john@example.com"
 *               code:
 *                 type: string
 *                 example: "458973"
 *     responses:
 *       200:
 *         description: Login verified successfully
 *       400:
 *         description: Invalid verification code or expired session
 */
router.post("/verify-login", typedAuthController.Verify_email); //tested

// --- 2FA / Login Code Setup & Verification Routes (Require Auth & AdminAuth) ---
/**
 * @openapi
 * /2fa/setup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Initialize 2FA setup for the authenticated user
 *     description: Generates a secret key and QR code for enabling two-factor authentication (TOTP) for the logged-in user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns the generated 2FA secret and QR code URL.
 *       401:
 *         description: Unauthorized, missing or invalid token.
 *       500:
 *         description: Server error during 2FA setup.
 */
router.post("/2fa/setup", Auth(),  typedAuthController.Create_2fA); //tested
/**
 * @openapi
 * /2fa/verify:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verify a 2FA token during setup or login
 *     description: Verifies the TOTP token entered by the user during setup or when logging in with 2FA enabled.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA verified successfully.
 *       400:
 *         description: Invalid 2FA code or expired token.
 *       500:
 *         description: Internal server error during verification.
 */
router.post("/2fa/verify", typedAuthController.Verify_2fA); //tested
/**
 * @openapi
 * /generate-login-codes:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Generate backup login codes for the authenticated user
 *     description: Generates a set of backup login codes that can be used if the user loses access to their 2FA device.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns a list of backup login codes.
 *       401:
 *         description: Unauthorized, missing or invalid token.
 *       500:
 *         description: Server error generating login codes.
 */

router.post("/generate-login-codes", Auth(),  typedAuthController.GenerteLoginCodes); //tested
/**
 * @openapi
 * /verify-login-code:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verify a backup login code
 *     description: Verifies one of the backup login codes generated by the user for account recovery or emergency access.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 example: "ABCD-1234"
 *     responses:
 *       200:
 *         description: Login code verified successfully.
 *       400:
 *         description: Invalid or already used code.
 *       500:
 *         description: Server error during login code verification.
 */
router.post("/verify-login-code", typedAuthController.VerifyLoginCode); //tested

// --- Password Management Routes ---

/**
 * @openapi
 * /forget-password:
 *   post:
 *     tags:
 *       - Password Management
 *     summary: Send a password reset link or code
 *     description: Allows a logged-in user to request a password reset (sends email or SMS verification code).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Password reset email or code sent successfully.
 *       401:
 *         description: Unauthorized, missing or invalid token.
 *       500:
 *         description: Internal server error sending password reset request.
 */
router.post("/forget-password", Auth(),  typedAuthController.ForgetPassword);
/**
 * @swagger
 * /reset-password:
 *   post:
 *     summary: Reset password
 *     description: Resets a user's password using a token sent to their email.
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
 *               - token
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 example: "john@example.com"
 *               token:
 *                 type: string
 *                 example: "abc123token"
 *               newPassword:
 *                 type: string
 *                 example: "NewStrongPassword@123"
 *     responses:
 *       200:
 *         description: Password reset successfully.
 *       400:
 *         description: Invalid or expired reset token.
 */
router.post("/reset-password", Auth(),  typedAuthController.ResetPassword);

// --- Session & Logout Routes ---
/**
 * @swagger
 * /refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Generates a new access token using a valid refresh token.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR..."
 *     responses:
 *       200:
 *         description: New access token generated successfully
 *       403:
 *         description: Invalid or expired refresh token
 */
router.get("/refresh",  typedAuthController.Refresh);
/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout current user
 *     description: Ends the current user session and invalidates the tokens.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful.
 *       401:
 *         description: Unauthorized or invalid session.
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
 *   post:
 *     summary: Signup using CAPTCHA verification
 *     description: Registers a new user only if CAPTCHA verification passes.
 *     tags:
 *       - Captcha
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - captchaResponse
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john_doe"
 *               email:
 *                 type: string
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "StrongPassword123!"
 *               captchaResponse:
 *                 type: string
 *                 example: "03AHJ_Vuv2kjs..."
 *     responses:
 *       201:
 *         description: Signup successful and CAPTCHA verified.
 *       400:
 *         description: Invalid CAPTCHA or missing fields.
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
/**
 * @swagger
 * /reauth-tfa:
 *   post:
 *     summary: Reauthenticate using Two-Factor Authentication
 *     description: Confirms identity by verifying the user's TOTP or 2FA code.
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
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "428913"
 *     responses:
 *       200:
 *         description: Two-Factor reauthentication successful.
 *       400:
 *         description: Invalid or expired code.
 */
router.post("/reauth-tfa", Auth(),  typedAuthController.ReauthTFA); //tested
/**
 * @swagger
 * /reauth-code:
 *   post:
 *     summary: Reauthenticate using backup code
 *     description: Confirms identity using a backup code as an alternative to password or TFA.
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
 *               - backupCode
 *             properties:
 *               backupCode:
 *                 type: string
 *                 example: "ABCD-1234"
 *     responses:
 *       200:
 *         description: Backup code verified successfully.
 *       400:
 *         description: Invalid or expired backup code.
 */
router.post("/reauth-code", Auth(),  typedAuthController.ReauthCode); //tested

// --- Sensitive Change Routes (Require Auth & Reauth) ---
/**
 * @swagger
 * /change-password:
 *   post:
 *     summary: Change user password
 *     description: Changes the current password after successful reauthentication.
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
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 example: "NewStrongPass@2024"
 *     responses:
 *       200:
 *         description: Password changed successfully.
 *       401:
 *         description: Reauthentication required or failed.
 */
router.post("/change-password", Auth(),  Reauth(), typedAuthController.ChangePassword); //tested
/**
 * @swagger
 * /change-email:
 *   post:
 *     summary: Change user email
 *     description: Changes the user’s email after successful reauthentication.
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
 *         description: Email change requested successfully.
 *       401:
 *         description: Unauthorized or reauth failed.
 */
router.post("/change-email", Auth(),  Reauth(), typedAuthController.ChangeEmail); //tested
/**
 * @swagger
 * /verify-new-email:
 *   post:
 *     summary: Verify new email address
 *     description: Verifies a newly changed email by checking the verification code sent to it.
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
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "842613"
 *     responses:
 *       200:
 *         description: Email verified successfully.
 *       400:
 *         description: Invalid or expired verification code.
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
 *     description: Updates the username of the authenticated user using their ID from req.user.id.
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
 *                 example: new_username123
 *     responses:
 *       200:
 *         description: Username updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Username updated successfully ✅
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: clu6wq2k90001x3sdo8v9l0k4
 *                     username:
 *                       type: string
 *                       example: new_username123
 *       400:
 *         description: Invalid username.
 *       401:
 *         description: Unauthorized or missing user ID.
 *       500:
 *         description: Internal server error.
 */
router.put("/update_username",Auth(),typedAuthController.UpdateUsername);
router.use(AfterChange());
router.use(GeoGurd());
export default router;