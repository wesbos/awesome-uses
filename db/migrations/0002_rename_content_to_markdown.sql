ALTER TABLE person_pages RENAME COLUMN content_text TO content_markdown;

ALTER TABLE person_pages DROP COLUMN description;
ALTER TABLE person_pages DROP COLUMN excerpt;
ALTER TABLE person_pages DROP COLUMN word_count;
ALTER TABLE person_pages DROP COLUMN reading_minutes;
