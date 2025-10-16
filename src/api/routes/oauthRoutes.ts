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
 *     summary: Redirect user to OAuth provider for authorization
 *     description: Initiates the OAuth 2.0 authorization flow by redirecting the user to the specified provider (e.g., Google or GitHub) for login.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         description: OAuth provider to use (google or github)
 *         schema:
 *           type: string
 *           enum: [google, github]
 *     responses:
 *       302:
 *         description: Redirects user to the OAuth provider's login page.
 *       400:
 *         description: Invalid or unsupported provider specified.
 *       500:
 *         description: Internal server error during authorization.
 */
router.get("/authorize/:provider", typedOauthController.Authorize);
/**
 * @openapi
 * /callback/google:
 *   get:
 *     tags:
 *       - OAuth
 *     summary: Handle Google OAuth callback
 *     description: Handles the callback from Google after user authorization. Exchanges the authorization code for tokens and retrieves user information.
 *     responses:
 *       200:
 *         description: User successfully authenticated with Google.
 *       400:
 *         description: Missing or invalid authorization code.
 *       500:
 *         description: Error during token exchange or user data retrieval.
 */
router.get("/callback/google", typedOauthController.CallbackGoogle);
/**
 * @openapi
 * /callback/github:
 *   get:
 *     tags:
 *       - OAuth
 *     summary: Handle GitHub OAuth callback
 *     description: Handles the callback from GitHub after user authorization. Exchanges the authorization code for tokens and retrieves user profile data.
 *     responses:
 *       200:
 *         description: User successfully authenticated with GitHub.
 *       400:
 *         description: Missing or invalid authorization code.
 *       500:
 *         description: Error during token exchange or user data retrieval.
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
