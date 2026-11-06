-- Same end state as `number Int @unique @default(autoincrement())`, but built by
-- hand so that tickets that already exist are numbered in the order they were
-- opened (createdAt, then id) and not in the table's physical order, which is
-- what a plain `SERIAL` column would give them.

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "number" INTEGER;

UPDATE "Ticket"
SET "number" = numbered.n
FROM (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "Ticket"
) AS numbered
WHERE "Ticket"."id" = numbered."id";

-- The next ticket gets the number after the highest one (1 on an empty table).
CREATE SEQUENCE "Ticket_number_seq" AS INTEGER OWNED BY "Ticket"."number";
SELECT setval(
  '"Ticket_number_seq"',
  COALESCE(MAX("number"), 1),
  MAX("number") IS NOT NULL
) FROM "Ticket";

ALTER TABLE "Ticket" ALTER COLUMN "number" SET DEFAULT nextval('"Ticket_number_seq"');
ALTER TABLE "Ticket" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");
