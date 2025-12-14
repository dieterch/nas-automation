export interface ParsedRecording {
  seriesTitle?: string;
  episodeTitle?: string;

  seasonNumber?: number;
  episodeNumber?: number;

  displayTitle: string;

  aufnahmeStart: Date;
  aufnahmeEnde: Date;
  einschaltZeit: Date;
  ausschaltZeit: Date;
}

/* ------------------------------------------------------------------
   RECORD PARSER
------------------------------------------------------------------ */

export function parseRecording(
  rec: any,
  config: any
): ParsedRecording | null {
  const meta = rec.Metadata;
  const media = meta?.Media?.[0];
  if (!meta || !media) return null;

  const begins = media.beginsAt * 1000;
  const ends = media.endsAt * 1000;

  const startOffset =
    Number(media.startOffsetSeconds ?? 0) * 1000;
  const endOffset =
    Number(media.endOffsetSeconds ?? 0) * 1000;

  const aufnahmeStart = new Date(begins - startOffset);
  const aufnahmeEnde = new Date(ends + endOffset);

  // Plex Meta
  const seriesTitle =
    meta.grandparentTitle ?? meta.parentTitle;

  const episodeTitle =
    meta.type === "episode" ? meta.displayTitle : undefined;

  const seasonNumber =
    meta.parentIndex != null
      ? Number(meta.parentIndex)
      : undefined;

  const episodeNumber =
    meta.index != null
      ? Number(meta.index)
      : undefined;

  // S02E05 Format
  const seasonEpisode =
    seasonNumber != null && episodeNumber != null
      ? `S${String(seasonNumber).padStart(2, "0")}E${String(
          episodeNumber
        ).padStart(2, "0")}`
      : undefined;

  // DISPLAY TITLE (zentral!)
  let displayTitle = meta.displayTitle ?? "Unbekannte Aufnahme";

  if (meta.type === "episode" && seriesTitle) {
    displayTitle = seasonEpisode
      ? episodeTitle
        ? `${seriesTitle} – ${seasonEpisode} – ${episodeTitle}`
        : `${seriesTitle} – ${seasonEpisode}`
      : episodeTitle
      ? `${seriesTitle} – ${episodeTitle}`
      : seriesTitle;
  }

  return {
    seriesTitle,
    episodeTitle,
    seasonNumber,
    episodeNumber,
    displayTitle,

    aufnahmeStart,
    aufnahmeEnde,
    einschaltZeit: new Date(
      aufnahmeStart.getTime() -
        config.VORLAUF_AUFWACHEN_MIN * 60000
    ),
    ausschaltZeit: new Date(
      aufnahmeEnde.getTime() +
        config.AUSSCHALT_NACHLAUF_MIN * 60000
    ),
  };
}