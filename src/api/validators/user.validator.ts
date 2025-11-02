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
  body("address")
    .optional()
    .isString()
    .isLength({ max: 30 })
    .withMessage("address too long"),
body("website")
  .optional({ checkFalsy: true })
  .isURL()
  .withMessage("website must be a valid URL"),
  body("protectedAccount").optional().isBoolean(),
];
