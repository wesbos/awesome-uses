CREATE TABLE `generated_avatars` (
	`person_slug` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`batch_id` text,
	`grid_position` integer,
	`generated_at` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_generated_avatars_status` ON `generated_avatars` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_generated_avatars_batch_id` ON `generated_avatars` (`batch_id`);
