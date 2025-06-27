import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function saveToStorage(file: Buffer, title: string) {
  const storagePath = process.env.BLOB_STORAGE_PATH || "./storage";
  await fs.mkdir(storagePath, { recursive: true });
  const fileName = `${uuidv4()}-${title.replace(/\s/g, "_")}.pdf`;
  const filePath = path.join(storagePath, fileName);
  await fs.writeFile(filePath, file);
  return filePath;
}

export async function getFromStorage(blobPath: string) {
  return fs.readFile(blobPath);
}
