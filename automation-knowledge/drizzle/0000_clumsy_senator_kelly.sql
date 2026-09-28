CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_language` text DEFAULT 'vi' NOT NULL,
	`document_json` text NOT NULL,
	`layout_json` text NOT NULL,
	`annotations_json` text NOT NULL,
	`assets_json` text NOT NULL,
	`content_vi` text DEFAULT '' NOT NULL,
	`published_content_vi` text DEFAULT '' NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`original_key` text NOT NULL,
	`thumb_key` text,
	`article_key` text,
	`zoom_key` text,
	`width` integer,
	`height` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
