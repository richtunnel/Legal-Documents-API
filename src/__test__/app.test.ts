import request from "supertest";
import createApp from "../app";
import { Database } from "sqlite";

describe("API", () => {
  let app: any;
  beforeAll(async () => {
    const db = {} as Database; // Mock SQLite DB
    app = await createApp(db);
  });

  it("GET /api/v1/documents returns 401 without auth", async () => {
    const res = await request(app).get("/api/v1/documents");
    expect(res.status).toBe(401);
  });
});
