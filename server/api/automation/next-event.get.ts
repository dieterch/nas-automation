import { loadConfig } from "../../utils/config";

type ParsedRecording = {
  title: string;
  aufnahmeStart: Date;
  aufnahmeEnde: Date;
  einschaltZeit: Date;
  ausschaltZeit: Date;
};

export default defineEventHandler(async () => {
  const config = loadConfig();

  const res: any = await $fetch("http://localhost:4800/api/plex/scheduled");
  const raw = res?.data?.MediaContainer?.MediaGrabOperation ?? [];

  if (!raw.length) {
    return { nextEvent: null };
  }

  const now = new Date();

  const recordings = raw
    .map((rec: any) => parseRecording(rec, config))
    .filter(Boolean)
    .sort(
      (a: any, b: any) => a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime()
    );

  const next = recordings.find((r: ParsedRecording) => r.aufnahmeEnde > now);

  if (!next) {
    return { nextEvent: null };
  }

  return {
    nextEvent: {
      title: next.title,
      einschaltZeit: next.einschaltZeit,
      aufnahmeStart: next.aufnahmeStart,
      aufnahmeEnde: next.aufnahmeEnde,
      ausschaltZeit: next.ausschaltZeit,
    },
  };
});

function parseRecording(rec: any, config: any) {
  const media = rec.Metadata?.Media?.[0];
  if (!media) return null;

  const begins = media.beginsAt * 1000;
  const ends = media.endsAt * 1000;

  const startOffset = Number(media.startOffsetSeconds ?? 0) * 1000;
  const endOffset = Number(media.endOffsetSeconds ?? 0) * 1000;

  const aufnahmeStart = new Date(begins - startOffset);
  const aufnahmeEnde = new Date(ends + endOffset);

  return {
    title: rec.Metadata?.grandparentTitle || rec.Metadata?.title || "unknown",

    aufnahmeStart,
    aufnahmeEnde,

    einschaltZeit: new Date(
      aufnahmeStart.getTime() - config.VORLAUF_AUFWACHEN_MIN * 60000
    ),

    ausschaltZeit: new Date(
      aufnahmeEnde.getTime() + config.AUSSCHALT_NACHLAUF_MIN * 60000
    ),
  };
}
