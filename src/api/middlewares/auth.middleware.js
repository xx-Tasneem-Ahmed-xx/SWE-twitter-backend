"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.requireAuth = void 0;
var jsonwebtoken_1 = require("jsonwebtoken");
var requireAuth = function (req, res, next) {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
            .status(401)
            .json({ message: "Missing or invalid Authorization header" });
    }
    var token = authHeader.split(" ")[1];
    try {
        var secret = process.env.JWT_SECRET || "devsecret";
        var payload = jsonwebtoken_1["default"].verify(token, secret);
        var userId = payload.sub || payload.id || payload.userId;
        if (!userId)
            return res.status(401).json({ message: "Invalid token payload" });
        req.user = __assign({ id: userId }, payload);
        return next();
    }
    catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};
exports.requireAuth = requireAuth;
