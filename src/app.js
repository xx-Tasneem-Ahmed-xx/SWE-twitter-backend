"use strict";
exports.__esModule = true;
exports.app = exports.socketService = exports.io = void 0;
var express_1 = require("express");
var cors_1 = require("cors");
var helmet_1 = require("helmet");
var morgan_1 = require("morgan");
var compression_1 = require("compression");
var swagger_ui_express_1 = require("swagger-ui-express");
var docs_1 = require("./docs");
var http_1 = require("http");
var socket_io_1 = require("socket.io");
var socketService_1 = require("@/application/services/socketService");
var directMessages_1 = require("@/api/routes/directMessages");
var tweets_1 = require("@/api/routes/tweets");
var userInteractions_1 = require("@/api/routes/userInteractions");
var user_routes_1 = require("./api/routes/user.routes");
var app = (0, express_1["default"])();
exports.app = app;
app.use((0, cors_1["default"])());
app.use((0, helmet_1["default"])());
app.use((0, morgan_1["default"])("dev"));
app.use((0, compression_1["default"])());
app.use(express_1["default"].json());
// Create HTTP server and Socket.IO server
var httpServer = (0, http_1.createServer)(app);
exports.io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});
// Initialize Socket Service
var socketService = new socketService_1.SocketService(exports.io);
exports.socketService = socketService;
app.use("/api", userInteractions_1["default"], user_routes_1["default"]);
app.use("/api-docs", swagger_ui_express_1["default"].serve, swagger_ui_express_1["default"].setup(docs_1.swaggerDoc));
app.use("/api/users/dm", directMessages_1["default"]);
app.use("/api/tweets", tweets_1["default"]);
app.use("/api/users", user_routes_1["default"]);
app.get("/", function (req, res) { return res.json({ message: "HELLO TEAM" }); });
exports["default"] = httpServer;
