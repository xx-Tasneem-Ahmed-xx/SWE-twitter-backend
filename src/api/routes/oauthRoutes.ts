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
import {oauthController} from "../controllers/user"; // renamed from controllers in Go version
import Auth from "../middlewares/Auth";

// Type definition for controller functions
type ControllerHandler = (req: Request, res: Response, next: NextFunction) => Promise<any> | void;
type OauthController = Record<string, ControllerHandler>;
const typedOauthController = oauthController as OauthController;

const router: Router = express.Router();

// --- OAuth2 Routes (converted from Go) ---
/**
 * @openapi
 * /authorize/{provider}:
 *   post:
 *     tags:
 *       - OAuth
 *     summary: Start OAuth 2.0 authorization flow
 *     description: >
 *       Initiates the OAuth 2.0 authorization process by redirecting the user to the chosen provider's authorization page.
 *       Supported providers: **Google** and **GitHub**.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         description: The OAuth provider to authenticate with.
 *         schema:
 *           type: string
 *           enum: [google, github]
 *     responses:
 *       302:
 *         description: Redirects the user to the selected OAuth provider's authorization page.
 *       400:
 *         description: Unsupported or missing provider name.
 *       500:
 *         description: Internal server error during authorization setup.
 */
router.get("/authorize/:provider", typedOauthController.Authorize);
/**
 * @openapi
 * /callback/google:
 *   post:
 *     tags:
 *       - OAuth
 *     summary: Google OAuth callback
 *     description: >
 *       Handles Google OAuth callback after user authorization.
 *       Exchanges the authorization code for Google tokens, extracts email and profile info,
 *       creates/links the user, generates JWT access & refresh tokens, stores refresh token in Redis,
 *       sets a secure HttpOnly cookie, sends login notification email, then redirects to the frontend.
 *
 *        This endpoint does **NOT** return JSON.  
 *       It **redirects (302)** to the frontend with tokens and user info encoded in the URL.
 *
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         description: Authorization code returned by Google after user consent.
 *         schema:
 *           type: string
 *
 *     responses:
 *       302:
 *         description: Redirects to the frontend with tokens and user info.
 *         headers:
 *           Location:
 *             description: >
 *               Example redirect URL structure:  
 *               `{FRONTEND_URL}/login/success?token={accessToken}&refresh-token={refreshToken}&user={jsonUser}`
 *             schema:
 *               type: string
 *       400:
 *         description: Missing or invalid authorization code.
 *       500:
 *         description: Internal error during token exchange, user creation, or notification process.
 */
router.post("/callback/google", typedOauthController.CallbackGoogle);


/**
 * @openapi
 * /callback/github:
 *   post:
 *     tags:
 *       - OAuth
 *     summary: GitHub OAuth callback
 *     description: >
 *       Handles GitHub OAuth callback after user authorization.
 *       Exchanges the authorization code for an access token, retrieves the verified primary email,
 *       fetches GitHub profile, creates/links the user, generates JWT access & refresh tokens,
 *       stores refresh token in Redis, sets a secure HttpOnly cookie, sends login alert email,
 *       then redirects the user to the frontend.
 *
 *        This endpoint does **NOT** return JSON.  
 *       It **redirects (302)** to the frontend with tokens and user info encoded in the URL.
 *
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         description: Authorization code returned by GitHub after user consent.
 *         schema:
 *           type: string
 *
 *     responses:
 *       302:
 *         description: Redirects to the frontend with access token, refresh token, and user info.
 *         headers:
 *           Location:
 *             description: >
 *               Example redirect URL structure:  
 *               `{FRONTEND_URL}/login/success?token={accessToken}&refresh-token={refreshToken}&user={jsonUser}`
 *             schema:
 *               type: string
 *       400:
 *         description: No verified email found, or invalid code.
 *       500:
 *         description: Internal error during token exchange, user lookup, or login email notification.
 */
router.post("/callback/github", typedOauthController.CallbackGithub);
/**
 * @openapi
 * /callback/android_google:
 *   post:
 *     tags:
 *       - OAuth
 *     summary: Android Google OAuth callback
 *     description: >
 *       Handles Google Sign-In for **Android mobile apps**.
 *
 *       Unlike web OAuth, Android does **not** use authorization codes.
 *       The Flutter app obtains an **ID token** directly from Google using the
 *       official Google Sign-In SDK, then sends it to this endpoint.
 *
 *       This endpoint:
 *       - Validates the ID token signature & audience  
 *       - Extracts user info (email, name, sub)  
 *       - Creates or links user with Google provider  
 *       - Generates JWT access & refresh tokens  
 *       - Stores refresh token in Redis  
 *       - Sends login security email  
 *       - Redirects the user to the frontend success page  
 *
 *       **This endpoint does NOT return JSON.**  
 *       It performs a **302 redirect** with tokens and user JSON encoded in the URL.
 *
 *     parameters:
 *       - in: query
 *         name: id_token
 *         required: true
 *         description: >
 *           Google ID token obtained from the Android Google Sign-In SDK.
 *           This is NOT a code. It is a JWT returned directly from Google.
 *         schema:
 *           type: string
 *
 *     responses:
 *       302:
 *         description: >
 *           Redirects to the frontend with access token, refresh token,
 *           and user info encoded in the query string.
 *         headers:
 *           Location:
 *             description: >
 *               Example redirect format:  
 *               `{FRONTEND_URL}/login/success?token={accessToken}&refresh-token={refreshToken}&user={jsonUser}`
 *             schema:
 *               type: string
 *
 *       400:
 *         description: Missing or invalid Google ID token.
 *
 *       401:
 *         description: ID token failed verification (invalid signature / audience mismatch).
 *
 *       500:
 *         description: Internal server error during token validation, user creation, or login email process.
 */
router.post("/callback/android_google", typedOauthController.CallbackAndroidGoogle);

// router.get("/callback/facebook", typedOauthController.CallbackFacebook);
// router.get("/callback/linkedin", typedOauthController.CallbackLinkedin);

// --- Token Management ---
// router.post("/refresh", typedOauthController.Refresh);
// router.post("/logout", typedOauthController.Logout);
// router.post("/logout-all", typedOauthController.LogoutALl);

// --- Sessions (require authentication) ---
// router.get("/get-sessions", Auth(), typedOauthController.GetSession);

export default router;
