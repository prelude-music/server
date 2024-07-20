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
