import { betterAuth } from "better-auth";
import mysql from "mysql2/promise";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "bullion_db",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_MAX || 10),
  queueLimit: 0,
});

export const auth = betterAuth({
  database: mysqlPool,
  secret:
    process.env.BETTER_AUTH_SECRET ||
    (process.env.NODE_ENV === "production"
      ? undefined
      : "bullion-secure-random-secret-key-32-chars-long-12345"),
  baseURL: appUrl,
  trustedOrigins: [
    appUrl,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ].filter(Boolean) as string[],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh if 1 day old
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false, // managed server-side only
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
