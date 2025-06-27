import express from "express";
import { logger } from "./utils/logger";

const app = express();
app.get("/", (req: any, res: any) => res.send("Hello World"));

app.listen(3000, () => {
  logger.info("Test server running on http://localhost:3000");
});
