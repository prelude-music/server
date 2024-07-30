CREATE TABLE IF NOT EXISTS `artists`
(
    `id`             CHAR(27) PRIMARY KEY NOT NULL COLLATE binary,
    `name`           TEXT                 NOT NULL COLLATE nocase,
    `external_image` TEXT                 NULL COLLATE nocase
);

CREATE TABLE IF NOT EXISTS `albums`
(
    `id`     CHAR(27) PRIMARY KEY NOT NULL COLLATE binary,
    `title`  TEXT                 NOT NULL COLLATE nocase,
    `artist` CHAR(27)             NOT NULL COLLATE binary,
    FOREIGN KEY (`artist`) REFERENCES `artists` (`id`)
);

CREATE INDEX IF NOT EXISTS `album_artist` ON `albums` (`artist`);

CREATE TABLE IF NOT EXISTS `tracks`
(
    `id`       CHAR(27) PRIMARY KEY NOT NULL COLLATE binary,
    `title`    TEXT                 NOT NULL COLLATE nocase,
    `artist`   CHAR(27)             NOT NULL COLLATE binary,
    `album`    CHAR(27)             NULL COLLATE binary,
    `file`     TEXT UNIQUE          NOT NULL COLLATE binary,
    `year`     INTEGER              NULL,
    `genres`   TEXT                 NOT NULL COLLATE nocase,
    `track_no` INTEGER              NULL,
    `track_of` INTEGER              NULL,
    `disk_no`  INTEGER              NULL,
    `disk_of`  INTEGER              NULL,
    `duration` INTEGER              NOT NULL,
    `meta`     TEXT                 NOT NULL COLLATE nocase,
    FOREIGN KEY (`artist`) REFERENCES `artists` (`id`),
    FOREIGN KEY (`album`) REFERENCES `albums` (`id`)
);

CREATE INDEX IF NOT EXISTS `track_artist` ON `tracks` (`artist`);
CREATE INDEX IF NOT EXISTS `track_album` ON `tracks` (`album`);

CREATE TABLE IF NOT EXISTS `users`
(
    `id`       CHAR(36) PRIMARY KEY NOT NULL COLLATE nocase,
    `username` VARCHAR(24)          NOT NULL COLLATE nocase,
    `scopes`   TEXT                 NOT NULL COLLATE nocase,
    `password` TEXT                 NOT NULL COLLATE nocase,
    `disabled` BOOLEAN              NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `users_username` ON `users` (`username`);

CREATE TABLE IF NOT EXISTS `tokens`
(
    `id`      CHAR(36) PRIMARY KEY NOT NULL COLLATE nocase,
    `user`    CHAR(36)             NOT NULL COLLATE nocase,
    `secret`  CHAR(36)             NOT NULL COLLATE binary,
    `scopes`  TEXT                 NOT NULL COLLATE nocase,
    `expires` DATETIME             NULL,
    `note`    VARCHAR(128)         NOT NULL COLLATE nocase,
    FOREIGN KEY (`user`) REFERENCES `users` (`id`)
);

CREATE INDEX IF NOT EXISTS `tokens_user` ON `tokens` (`user`);
