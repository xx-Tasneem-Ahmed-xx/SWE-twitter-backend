"use strict";
exports.__esModule = true;
exports.UserResponseDTOSchema = exports.UpdateUserProfileDTOSchema = void 0;
var zod_1 = require("zod");
var zod_to_openapi_1 = require("@asteasolutions/zod-to-openapi");
(0, zod_to_openapi_1.extendZodWithOpenApi)(zod_1["default"]);
var StringSchema = zod_1["default"]
    .string()
    .min(1, { message: "This field cannot be empty" });
exports.UpdateUserProfileDTOSchema = zod_1["default"]
    .object({
    name: StringSchema.optional(),
    username: StringSchema.optional(),
    bio: StringSchema.optional(),
    address: StringSchema.optional(),
    website: StringSchema.optional(),
    protectedAccount: zod_1["default"].boolean().optional(),
    profilePhoto: zod_1["default"].string().url().optional(),
    cover: zod_1["default"].string().url().optional()
})
    .openapi("UpdateUserProfileDTO");
exports.UserResponseDTOSchema = zod_1["default"]
    .object({
    id: zod_1["default"].string().uuid(),
    name: StringSchema.optional().nullable(),
    username: StringSchema,
    email: zod_1["default"].string().email(),
    bio: StringSchema.optional().nullable(),
    dateOfBirth: zod_1["default"].date(),
    joinDate: zod_1["default"].date(),
    verified: zod_1["default"].boolean(),
    address: StringSchema.optional().nullable(),
    website: StringSchema.optional().nullable(),
    protectedAccount: zod_1["default"].boolean(),
    profilePhoto: zod_1["default"].string().url().optional().nullable(),
    cover: zod_1["default"].string().url().optional().nullable()
})
    .openapi("UserProfileResponseDTO");
