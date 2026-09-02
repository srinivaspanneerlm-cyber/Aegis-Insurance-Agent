-- The number to reach somebody on, for a request that asked for a call or a
-- WhatsApp message.
--
-- Additive and nullable: every RenewalLead written before this column existed
-- stays valid, and every query that did not know about it keeps working. Rows
-- that predate it carry NULL, which reads as "no number was given" — true, and
-- the only honest thing to say about them.
ALTER TABLE "RenewalLead" ADD COLUMN "contactPhone" TEXT;
