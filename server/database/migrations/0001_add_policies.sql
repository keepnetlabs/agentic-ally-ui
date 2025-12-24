CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`companyId` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`blobUrl` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `companyIdIdx` ON `policies` (`companyId`);

