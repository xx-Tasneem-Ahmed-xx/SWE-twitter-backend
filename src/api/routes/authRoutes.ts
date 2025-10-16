import express, { Router, Request, Response, NextFunction } from "express";

// Importing the default export and giving it an appropriate type (assuming it's an object of async functions)
import authController from "../controllers/user"; 

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
router.post("/signup", typedAuthController.Create); //tested
//router.post("/continue_signup",typedAuthController.ContinuS)
router.post("/verify-signup", typedAuthController.Verify_signup_email); //tested
router.post("/login", typedAuthController.Login); //tested
router.post("/verify-login", typedAuthController.Verify_email); //tested

// --- 2FA / Login Code Setup & Verification Routes (Require Auth & AdminAuth) ---
router.post("/2fa/setup", Auth(),  typedAuthController.Create_2fA); //tested
router.post("/2fa/verify", typedAuthController.Verify_2fA); //tested
router.post("/generate-login-codes", Auth(),  typedAuthController.GenerteLoginCodes); //tested
router.post("/verify-login-code", typedAuthController.VerifyLoginCode); //tested

// --- Password Management Routes ---
router.post("/forget-password", Auth(),  typedAuthController.ForgetPassword);
router.post("/reset-password", Auth(),  typedAuthController.ResetPassword);

// --- Session & Logout Routes ---
router.get("/refresh",Auth(),  typedAuthController.Refresh);
router.post("/logout", Auth(),  typedAuthController.Logout, DeactivateUser()); //tested
router.post("/logout-all", Auth(),  typedAuthController.LogoutALL, DeactivateUser());

// --- Captcha Routes ---
router.get("/captcha", Auth(),  typedAuthController.Captcha);
router.post("/signup_captcha",  typedAuthController.SignupCaptcha); //tested

// --- Re-Authentication Routes ---
router.post("/reauth-password", Auth() , typedAuthController.ReauthPassword);
router.post("/reauth-tfa", Auth(),  typedAuthController.ReauthTFA); //tested
router.post("/reauth-code", Auth(),  typedAuthController.ReauthCode); //tested

// --- Sensitive Change Routes (Require Auth & Reauth) ---
router.post("/change-password", Auth(),  Reauth(), typedAuthController.ChangePassword); //tested
router.post("/change-email", Auth(),  Reauth(), typedAuthController.ChangeEmail); //tested
router.post("/verify-new-email",Auth(),  typedAuthController.VerifyNewEmail); //tested

// --- User Info & Session Retrieval/Management Routes ---
router.get("/user", Auth(),  typedAuthController.GetUser); //tested
router.get("/sessions", Auth(),  typedAuthController.GetSession); //tested
router.delete("/session/:sessionid", Auth(),  typedAuthController.LogoutSession);

// --- Post-Request Cleanup Middleware ---
router.use(AfterChange());
router.use(GeoGurd());
export default router;