CREATE TABLE `user_photos` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` blob NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `theme` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `reduced_motion` integer DEFAULT false NOT NULL;