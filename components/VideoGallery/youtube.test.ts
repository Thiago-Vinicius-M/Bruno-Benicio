import { describe, expect, it } from "vitest";
import { parseYouTubeId } from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeId", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abc123`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube.com/live/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [` ${ID} `],
  ])("%s", (link) => {
    expect(parseYouTubeId(link)).toBe(ID);
  });

  it.each([
    [""],
    ["https://example.com/watch?v=dQw4w9WgXcQ"],
    ["https://www.youtube.com/@brunoebenicio"],
    ["https://www.youtube.com/watch?v=curto"],
    ["não é link"],
  ])("rejeita %j", (link) => {
    expect(parseYouTubeId(link)).toBeNull();
  });
});
