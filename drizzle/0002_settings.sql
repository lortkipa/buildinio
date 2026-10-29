CREATE TABLE `avatars` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content_type` text NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `avatars_user_id_idx` ON `avatars` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `theme` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `autocorrect` integer DEFAULT true NOT NULL;