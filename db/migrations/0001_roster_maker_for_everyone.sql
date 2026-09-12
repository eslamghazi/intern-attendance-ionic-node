-- The roster maker is open to every member.
--
-- It used to be switched on per member (can_make_roster, default false), so a
-- member saw the tab only after an admin had found the toggle on their card.
-- Nothing reads the flag any more: the tab and the route are there for every
-- member, and the API never gated the data behind it in the first place.
--
-- The column stays — a migration here never drops one — and is set to true
-- everywhere so that anything which still reads it (a backup, an old client)
-- sees the truth rather than a "false" that no longer means anything.
ALTER TABLE "members" ALTER COLUMN "can_make_roster" SET DEFAULT true;
--> statement-breakpoint
UPDATE "members" SET "can_make_roster" = true WHERE "can_make_roster" = false;
