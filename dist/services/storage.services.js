"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveToStorage = saveToStorage;
exports.getFromStorage = getFromStorage;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
async function saveToStorage(file, title) {
    const storagePath = process.env.BLOB_STORAGE_PATH || "./storage";
    await promises_1.default.mkdir(storagePath, { recursive: true });
    const fileName = `${(0, uuid_1.v4)()}-${title.replace(/\s/g, "_")}.pdf`;
    const filePath = path_1.default.join(storagePath, fileName);
    await promises_1.default.writeFile(filePath, file);
    return filePath;
}
async function getFromStorage(blobPath) {
    return promises_1.default.readFile(blobPath);
}
