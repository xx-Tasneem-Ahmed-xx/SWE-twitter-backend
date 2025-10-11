import express, { Router, Request, Response, NextFunction } from "express";

// Importing the default export and giving it an appropriate type (assuming it's an object of async functions)
import authController from "../controller/user.js"; 

// Importing middleware functions (which are default exports, typically untyped in JS)
import Auth from "../middlerware/Auth.js";
import AdminAuth from "../middlerware/AdminAuth.js";
import Reauth from "../middlerware/Reauth.js";
import DeactivateUser from "../middlerware/DeactivateUser.js";
import AfterChange from "../middlerware/AfterChange.js";

// Type assertion for the controller functions to satisfy TS and keep the code clean
// This assumes authController is an object where keys are controller names and values are Express handlers.
type AuthController = { 
    [key: string]: (req: Request, res: Response, next: NextFunction) => Promise<any> | void;
};
const typedAuthController = authController as AuthController;

// Type assertion for middleware functions which are exported as default functions
type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => Promise<any> | void;

const typedAuth = Auth as unknown as MiddlewareFunction;
const typedAdminAuth = AdminAuth as unknown as MiddlewareFunction;
const typedReauth = Reauth as unknown as MiddlewareFunction;
const typedDeactivateUser = DeactivateUser as unknown as MiddlewareFunction;
const typedAfterChange = AfterChange as unknown as MiddlewareFunction;

const router: Router = express.Router();

// --- Auth Routes ---
router.post("/signup", typedAuthController.Create); //tested
//router.post("/continue_signup",typedAuthController.ContinuS)
router.post("/verify-signup", typedAuthController.Verify_signup_email); //tested
router.post("/login", typedAuthController.Login); //tested
router.post("/verify-login", typedAuthController.Verify_email); //tested

// --- 2FA / Login Code Setup & Verification Routes (Require Auth & AdminAuth) ---
router.post("/2fa/setup", typedAuth, typedAdminAuth, typedAuthController.Create_2fA); //tested
router.post("/2fa/verify", typedAuthController.Verify_2fA); //tested
router.post("/generate-login-codes", typedAuth, typedAdminAuth, typedAuthController.GenerteLoginCodes); //tested
router.post("/verify-login-code", typedAuthController.VerifyLoginCode); //tested

// --- Password Management Routes ---
router.post("/forget-password", typedAuth, typedAdminAuth, typedAuthController.ForgetPassword);
router.post("/reset-password", typedAuth, typedAdminAuth, typedAuthController.ResetPassword);

// --- Session & Logout Routes ---
router.get("/refresh", typedAuth, typedAdminAuth, typedAuthController.Refresh);
router.post("/logout", typedAuth, typedAdminAuth, typedAuthController.Logout, typedDeactivateUser); //tested
router.post("/logout-all", typedAuth, typedAdminAuth, typedAuthController.LogoutALL, typedDeactivateUser);

// --- Captcha Routes ---
router.get("/captcha", typedAuth, typedAdminAuth, typedAuthController.Captcha);
router.post("/signup_captcha", typedAuth, typedAdminAuth, typedAuthController.SignupCaptcha); //tested

// --- Re-Authentication Routes ---
router.post("/reauth-password", typedAuth, typedAdminAuth, typedAuthController.ReauthPassword);
router.post("/reauth-tfa", typedAuth, typedAdminAuth, typedAuthController.ReauthTFA); //tested
router.post("/reauth-code", typedAuth, typedAdminAuth, typedAuthController.ReauthCode); //tested

// --- Sensitive Change Routes (Require Auth & Reauth) ---
router.post("/change-password", typedAuth, typedAdminAuth, typedReauth, typedAuthController.ChangePassword); //tested
router.post("/change-email", typedAuth, typedAdminAuth, typedReauth, typedAuthController.ChangeEmail); //tested
router.post("/verify-new-email", typedAuth, typedAdminAuth, typedAuthController.VerifyNewEmail); //tested

// --- User Info & Session Retrieval/Management Routes ---
router.get("/user", typedAuth, typedAdminAuth, typedAuthController.GetUser); //tested
router.get("/sessions", typedAuth, typedAdminAuth, typedAuthController.GetSession); //tested
router.delete("/session/:sessionid", typedAuth, typedAdminAuth, typedAuthController.LogoutSession);

// --- Post-Request Cleanup Middleware ---
router.use(typedAfterChange);

export default router;