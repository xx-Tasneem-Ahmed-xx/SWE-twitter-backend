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
 * /callback/google:
 *   get:
 *     tags:
 *       - OAuth
 *     summary: Handle Google OAuth callback
 *     description: >
 *       This endpoint handles the callback from **Google OAuth** after user authorization.
 *       It exchanges the received authorization code for an ID token, retrieves the user's profile and email,
 *       creates or updates the user in the database, issues access and refresh tokens, stores session info,
 *       and sends a login notification email.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         description: Authorization code returned by Google after user consent.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User successfully authenticated and tokens issued.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT access token.
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token stored in cookies and Redis.
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
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
 *                 deviceRecord:
 *                   type: object
 *                   description: Information about the device used for login.
 *                 location:
 *                   type: object
 *                   description: IP-based geolocation info.
 *                 message:
 *                   type: string
 *                   example: User registered and logged in successfully ✅
 *       400:
 *         description: Missing or invalid authorization code.
 *       500:
 *         description: Error during token exchange, user creation, or email notification.
 */
router.get("/callback/google", typedOauthController.CallbackGoogle);

/**
 * @openapi
 * /callback/github:
 *   get:
 *     tags:
 *       - OAuth
 *     summary: Handle GitHub OAuth callback
 *     description: >
 *       This endpoint handles the callback from **GitHub OAuth** after the user grants access.
 *       It exchanges the authorization code for an access token, retrieves the user’s primary verified email,
 *       fetches GitHub profile data, creates or links the user in the system, issues JWT tokens,
 *       logs the device info, and sends a login alert email.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         description: Authorization code returned by GitHub after user consent.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User successfully authenticated and tokens issued.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT access token.
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token stored in cookies and Redis.
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
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
 *                 deviceRecord:
 *                   type: object
 *                   description: Information about the device used for login.
 *                 location:
 *                   type: object
 *                   description: IP-based geolocation info.
 *                 message:
 *                   type: string
 *                   example: User logged in successfully via GitHub ✅
 *       400:
 *         description: Missing or invalid authorization code.
 *       500:
 *         description: Error during token exchange, user lookup, or email notification.
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
