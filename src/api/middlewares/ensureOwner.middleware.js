"use strict";
exports.__esModule = true;
exports.ensureOwner = void 0;
var ensureOwner = function (paramName) {
    if (paramName === void 0) { paramName = "id"; }
    return function (req, res, next) {
        var _a;
        var authUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        var targetId = req.params[paramName];
        if (!authUserId)
            return res.status(401).json({ message: "Unauthorized" });
        if (!targetId)
            return res.status(400).json({ message: "Missing target id" });
        if (authUserId !== targetId)
            return res
                .status(403)
                .json({ message: "Forbidden: you can only modify your own profile" });
        return next();
    };
};
exports.ensureOwner = ensureOwner;
