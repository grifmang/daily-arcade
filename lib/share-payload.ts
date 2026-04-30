/** Pure helper: canonical share payload encoding. Imported by both server and tests. */
export function sharePayload(opts: {
  gameId: string;
  date: string;
  handle: string;
  discriminator: number;
  score: number;
  shareId: string;
}): string {
  return [opts.gameId, opts.date, opts.handle, opts.discriminator, opts.score, opts.shareId].join("|");
}
