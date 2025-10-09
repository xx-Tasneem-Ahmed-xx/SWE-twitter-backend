// src/api/validators/user.validator.ts
import { body, param } from "express-validator";

export const updateUserValidator = [
  param("id").isUUID().withMessage("id must be a valid UUID"),
  body("name")
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage("name too long"),
  body("bio")
    .optional()
    .isString()
    .isLength({ max: 160 })
    .withMessage("bio too long"),
  body("address").optional().isString().isLength({ max: 30 }).withMessage("address too long"),
  body("website").optional().isURL().withMessage("website must be a valid URL"),
  body("protectedAccount").optional().isBoolean(),
  body("profilePhoto")
    .optional()
    .isURL()
    .withMessage("profilePhoto must be a valid URL"),
  body("cover").optional().isURL().withMessage("cover must be a valid URL"),
];
