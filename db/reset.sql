-- Drops every table so the next schema.sql + seed.sql run starts from zero.
--
-- This file is DESTRUCTIVE and is only used by the local reset path
-- (`npm run db:init`). It is deliberately kept out of the production
-- migration (`server/db/migrate.js`), which never drops anything.

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
