import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canPlay } from "@/components/VideoGallery/videoSources";
import { VIDEOS } from "./videoList";

const publicFile = (url: string) => join(process.cwd(), "public", decodeURIComponent(url));

describe("videoList", () => {
  it("ids únicos", () => {
    expect(new Set(VIDEOS.map((video) => video.id)).size).toBe(VIDEOS.length);
  });

  it("horizontais são YouTube; verticais são arquivos em public/videos", () => {
    for (const video of VIDEOS) {
      expect(video.sourceType, video.id).toBe(video.orientation === "landscape" ? "youtube" : "local");
    }
  });

  it("todo link/arquivo informado toca, e os arquivos existem na pasta", () => {
    for (const video of VIDEOS.filter((v) => v.source)) {
      expect(canPlay(video), video.id).toBe(true);
      if (video.sourceType !== "local") continue;

      for (const url of [video.source, video.thumbnail].filter((u): u is string => typeof u === "string")) {
        expect(url, video.id).toMatch(/^\/videos\/[^\s]+$/);
        expect(existsSync(publicFile(url)), `${video.id}: ${decodeURIComponent(url)}`).toBe(true);
      }
    }
  });
});
