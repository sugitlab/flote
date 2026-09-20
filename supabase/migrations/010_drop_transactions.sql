-- ─────────────────────────────────────────────────────────────────────────────
-- Remove the expense (収支) feature.
--
-- The transactions table was introduced by the (now removed) add_transactions
-- migration. This forward migration drops it so databases that already applied
-- that migration no longer keep the unused table. `if exists` + `cascade` make
-- this a safe no-op on databases where the table was never created, and it also
-- removes the table's RLS policy automatically.
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.transactions cascade;
