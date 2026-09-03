import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  database: {
    provider: "postgresql", // or "sqlite", "mysql" depending on your schema.prisma
    url: {
      fromEnv: "DATABASE_URL",
    },
  },
});
