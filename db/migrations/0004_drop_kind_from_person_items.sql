DROP INDEX IF EXISTS idx_person_items_kind;

ALTER TABLE person_items DROP COLUMN kind;
