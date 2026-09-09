import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const raw = readFileSync(join(process.cwd(), "prisma", "constraints.sql"), "utf8");
  const sql = raw.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
    console.log("✓", statement.split("\n")[0].slice(0, 60));
  }
}

main()
  .catch((e) => { console.error("✗", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
