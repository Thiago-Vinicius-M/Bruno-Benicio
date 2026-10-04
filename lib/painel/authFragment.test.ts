import { describe, expect, it } from "vitest";
import { parseAuthFragment } from "./authFragment";

describe("parseAuthFragment", () => {
  it("sessão do convite", () => {
    expect(parseAuthFragment("#access_token=a&refresh_token=r&expires_in=3600&token_type=bearer&type=invite")).toEqual({
      kind: "session",
      accessToken: "a",
      refreshToken: "r",
      type: "invite",
    });
  });

  it("link expirado", () => {
    expect(parseAuthFragment("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid")).toEqual({
      kind: "error",
      code: "otp_expired",
    });
  });

  it("sem tokens completos não há sessão", () => {
    expect(parseAuthFragment("")).toEqual({ kind: "empty" });
    expect(parseAuthFragment("#access_token=a")).toEqual({ kind: "empty" });
  });
});
