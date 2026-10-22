const GIF_TAG = /\[gif:\s*([^\]]{1,60})\]/i;
const GIF_TAG_ALL = /\[gif:[^\]]*\]/gi;

/** Splits the model output into the visible text and the gif search terms (if any). */
export function extractGifTag(reply: string): {
  text: string;
  query: string | null;
} {
  const match = reply.match(GIF_TAG);
  const text = reply
    .replace(GIF_TAG_ALL, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text, query: match?.[1]?.trim() ?? null };
}

/** Returns a random gif link for the query, or null if anything goes wrong. */
export async function searchGif(query: string): Promise<string | null> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return null;

  try {
    const params = new URLSearchParams({
      api_key: key,
      q: query,
      limit: "10",
      rating: process.env.GIPHY_RATING ?? "pg-13",
      lang: "en",
    });

    const res = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Giphy HTTP ${res.status}`);

    const json = (await res.json()) as { data?: { url: string }[] };
    const results = json.data ?? [];

    const pick = results[Math.floor(Math.random() * results.length)];
    return pick?.url ?? null;
  } catch (err) {
    console.error("GIF error:", err); // a gif failure never breaks the reply
    return null;
  }
}
