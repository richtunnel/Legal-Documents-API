"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
app.get("/", (req, res) => res.send("Hello World"));
app.listen(3000, () => {
    logger_1.logger.info("Test server running on http://localhost:3000");
});
