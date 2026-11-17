CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`problem_json` text NOT NULL,
	`answer` text NOT NULL,
	`is_correct` integer NOT NULL,
	`hint_used` integer DEFAULT false NOT NULL,
	`ms_taken` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_user_idx` ON `attempts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`segments_json` text
);
--> statement-breakpoint
CREATE TABLE `roadmaps` (
	`user_id` text PRIMARY KEY NOT NULL,
	`nodes_json` text NOT NULL,
	`generated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_mastery` (
	`user_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`p_mastery` real NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `skill_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`grade` integer NOT NULL,
	`character_id` text DEFAULT 'blokbek' NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`streak_days` integer DEFAULT 0 NOT NULL,
	`last_active_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
