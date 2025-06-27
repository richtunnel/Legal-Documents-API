import { Database } from "sqlite";
import bcrypt from "bcrypt";

export interface User {
  id: number;
  email: string;
  password: string;
  role: string;
}

export async function createUser(db: Database, email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await db.run("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", [email, hashedPassword, "user"]);
  return { id: result.lastID, email, role: "user" };
}

export async function findUserByEmail(db: Database, email: string) {
  return db.get<User>("SELECT * FROM users WHERE email = ?", [email]);
}
