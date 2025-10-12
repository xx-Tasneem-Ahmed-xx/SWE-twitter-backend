"use strict";
exports.__esModule = true;
exports.updateUserValidator = void 0;
var express_validator_1 = require("express-validator");
exports.updateUserValidator = [
    (0, express_validator_1.param)("id").isUUID().withMessage("id must be a valid UUID"),
    (0, express_validator_1.body)("name")
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage("name too long"),
    (0, express_validator_1.body)("bio")
        .optional()
        .isString()
        .isLength({ max: 160 })
        .withMessage("bio too long"),
    (0, express_validator_1.body)("address").optional().isString().isLength({ max: 30 }).withMessage("address too long"),
    (0, express_validator_1.body)("website").optional().isURL().withMessage("website must be a valid URL"),
    (0, express_validator_1.body)("protectedAccount").optional().isBoolean(),
    (0, express_validator_1.body)("profilePhoto")
        .optional()
        .isURL()
        .withMessage("profilePhoto must be a valid URL"),
    (0, express_validator_1.body)("cover").optional().isURL().withMessage("cover must be a valid URL"),
];
