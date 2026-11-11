import { describe, expect, test } from "bun:test";

import { tagline } from "../src/lib/pitch.js";

describe("site pitch", () => {
  test("tagline is stable", () => {
    expect(tagline()).toContain("WinDirStat");
  });
});
