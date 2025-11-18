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
 *   get:
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
 * /callback/github:
 *   get:
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
router.get("/callback/github", typedOauthController.CallbackGithub);


// router.get("/callback/facebook", typedOauthController.CallbackFacebook);
// router.get("/callback/linkedin", typedOauthController.CallbackLinkedin);

// --- Token Management ---
// router.post("/refresh", typedOauthController.Refresh);
// router.post("/logout", typedOauthController.Logout);
// router.post("/logout-all", typedOauthController.LogoutALl);

// --- Sessions (require authentication) ---
// router.get("/get-sessions", Auth(), typedOauthController.GetSession);

export default router;
