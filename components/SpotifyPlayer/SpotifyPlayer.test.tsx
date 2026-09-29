import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpotifyPlayer } from "./SpotifyPlayer";

const ID = "3ISf1oztSc4M7Fj8tex0FP";
const OTHER_ID = "66aHceSvEnoETv7vWisfQq";

function iframe() {
  return document.querySelector("iframe");
}

describe("SpotifyPlayer", () => {
  it("renderiza o iframe oficial com título acessível e carregamento lazy", () => {
    render(<SpotifyPlayer trackId={ID} title="Foi Deus" />);

    const frame = screen.getByTitle("Player do Spotify: Foi Deus");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe(
      `https://open.spotify.com/embed/track/${ID}?utm_source=generator&theme=0`,
    );
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(frame.getAttribute("allow")).toContain("encrypted-media");
    expect(frame.getAttribute("width")).toBe("100%");
  });

  it("aplica a variante (altura) e as classes extras", () => {
    const { container } = render(
      <SpotifyPlayer trackId={ID} title="Foi Deus" variant="compact" className="extra" id="p" />,
    );
    const root = container.firstElementChild!;
    expect(root.getAttribute("data-variant")).toBe("compact");
    expect(root.className).toContain("extra");
    expect(root.id).toBe("p");
    expect(iframe()!.getAttribute("height")).toBe("152");
  });

  it.each([undefined, null, "", "id-invalido"])("sem Track ID válido (%s) mostra aviso e nenhum iframe", (trackId) => {
    render(<SpotifyPlayer trackId={trackId} title="Foi Deus" />);
    expect(iframe()).toBeNull();
    expect(screen.getByRole("note").textContent).toBe("Música indisponível no momento.");
  });

  it("trocar a música monta um iframe novo com a nova URL", () => {
    const { rerender } = render(<SpotifyPlayer trackId={ID} title="Foi Deus" />);
    const first = iframe();

    rerender(<SpotifyPlayer trackId={OTHER_ID} title="Amigo" />);
    const second = iframe();

    expect(second).not.toBe(first);
    expect(second!.getAttribute("src")).toContain(`/embed/track/${OTHER_ID}`);
    expect(second!.getAttribute("title")).toBe("Player do Spotify: Amigo");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("remove o iframe ao desmontar", () => {
    const { unmount } = render(<SpotifyPlayer trackId={ID} title="Foi Deus" />);
    unmount();
    expect(iframe()).toBeNull();
  });
});
