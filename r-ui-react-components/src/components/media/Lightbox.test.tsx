import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { stubDialog } from "../overlays/overlay-stubs.test.helpers";
import { Image } from "./Image";
import { Lightbox, type LightboxItem, type LightboxProps } from "./Lightbox";

let dialogStub: ReturnType<typeof stubDialog>;
beforeEach(() => {
  dialogStub = stubDialog();
});
afterEach(() => {
  dialogStub.restore();
});

const ITEMS: LightboxItem[] = ["dunes", "fjord", "salt", "pines", "cliffs"].map((id, i) => ({
  id,
  src: `/photos/${id}.jpg`,
  alt: `Photo ${i + 1}: ${id}`,
  width: 1200,
  height: 800,
  caption: i === 2 ? "Twelve kilometres of crust" : undefined,
}));

function Gallery({ dir, ...props }: Partial<LightboxProps> & { dir?: "rtl" }) {
  return (
    <div dir={dir}>
      <Lightbox items={ITEMS} label="Field trip" {...props}>
        {ITEMS.map((item, i) => (
          <Lightbox.Trigger key={item.id} index={i}>
            <Image src={`/thumbs/${item.id}.jpg`} alt={item.alt} width={300} height={200} />
          </Lightbox.Trigger>
        ))}
      </Lightbox>
    </div>
  );
}

const thumb = (n: number) => screen.getByRole("button", { name: ITEMS[n - 1]!.alt });
const viewer = () => screen.getByRole("dialog", { name: "Field trip" });
const counter = () => viewer().querySelector('[aria-live="polite"]')!;
const slide = () => viewer().querySelector<HTMLElement>("figure[aria-roledescription]")!;

describe("Lightbox", () => {
  it("a trigger opens it modally on its own picture, named, counted, with focus on Close", async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    expect(thumb(3)).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(thumb(3));
    expect(dialogStub.showModal).toHaveBeenCalledTimes(1);
    expect(counter()).toHaveTextContent("3 of 5");
    expect(counter()).toHaveAttribute("aria-atomic", "true");
    expect(slide()).toHaveAttribute("aria-label", "3 of 5");
    expect(slide()).toHaveAttribute("aria-roledescription", "slide");
    expect(within(viewer()).getByRole("group", { name: "Field trip" })).toHaveAttribute("aria-roledescription", "carousel");
    const shown = within(slide()).getByRole("img", { name: "Photo 3: salt" });
    expect(shown).toHaveAttribute("src", "/photos/salt.jpg");
    expect(shown).toHaveAttribute("loading", "eager");
    expect(within(slide()).getByText("Twelve kilometres of crust").tagName).toBe("FIGCAPTION");
    expect(document.activeElement).toBe(within(viewer()).getByRole("button", { name: "Close" }));
  });

  it("previous / next step one picture and stop at both ends", async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    await user.click(thumb(1));
    const prev = within(viewer()).getByRole("button", { name: "Previous image" });
    const next = within(viewer()).getByRole("button", { name: "Next image" });
    expect(prev).toHaveAttribute("aria-disabled", "true");
    await user.click(prev);
    expect(counter()).toHaveTextContent("1 of 5");

    await user.click(next);
    expect(counter()).toHaveTextContent("2 of 5");
    expect(within(slide()).getByRole("img", { name: "Photo 2: fjord" })).toBeInTheDocument();
    expect(prev).not.toHaveAttribute("aria-disabled");
    for (let i = 0; i < 5; i++) await user.click(next);
    expect(counter()).toHaveTextContent("5 of 5");
    expect(next).toHaveAttribute("aria-disabled", "true");
  });

  it("arrow keys move in reading direction, Home and End jump", async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    await user.click(thumb(2));
    await user.keyboard("{ArrowRight}");
    expect(counter()).toHaveTextContent("3 of 5");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(counter()).toHaveTextContent("1 of 5");
    await user.keyboard("{End}");
    expect(counter()).toHaveTextContent("5 of 5");
    await user.keyboard("{Home}");
    expect(counter()).toHaveTextContent("1 of 5");
  });

  it("under dir=rtl ArrowLeft goes forward and ArrowRight back", async () => {
    const user = userEvent.setup();
    render(<Gallery dir="rtl" />);
    await user.click(thumb(2));
    await user.keyboard("{ArrowLeft}");
    expect(counter()).toHaveTextContent("3 of 5");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(counter()).toHaveTextContent("1 of 5");
  });

  it("closing (Escape or Close) returns focus to the originating thumbnail, after moving through the gallery", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Gallery onOpenChange={onOpenChange} />);
    await user.click(thumb(2));
    await user.keyboard("{ArrowRight}{ArrowRight}");
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(viewer(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(document.activeElement).toBe(thumb(2));

    await user.click(thumb(4));
    await user.click(within(viewer()).getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(thumb(4));
  });

  it("opened from outside (controlled), it reopens at the given index and returns focus to what had it", async () => {
    const user = userEvent.setup();
    function Outside() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            View all
          </button>
          <Lightbox items={ITEMS} label="Field trip" open={open} onOpenChange={setOpen} defaultIndex={4} />
        </>
      );
    }
    render(<Outside />);
    const viewAll = screen.getByRole("button", { name: "View all" });
    await user.click(viewAll);
    expect(counter()).toHaveTextContent("5 of 5");
    await user.click(within(viewer()).getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(viewAll);
  });

  describe("swipe", () => {
    const touch = { pointerId: 7, pointerType: "touch", isPrimary: true };
    const swipe = (stage: Element, dx: number, dy: number, kind = touch) => {
      fireEvent.pointerDown(stage, { ...kind, clientX: 200, clientY: 300 });
      fireEvent.pointerUp(stage, { ...kind, clientX: 200 + dx, clientY: 300 + dy });
    };
    const stage = () => within(viewer()).getByRole("group", { name: "Field trip" });

    it("a horizontal touch swipe against reading direction goes forward, with it back; a mostly vertical one or a mouse drag does nothing", async () => {
      const user = userEvent.setup();
      render(<Gallery />);
      await user.click(thumb(2));
      swipe(stage(), -120, 10);
      expect(counter()).toHaveTextContent("3 of 5");
      swipe(stage(), 120, -10);
      expect(counter()).toHaveTextContent("2 of 5");
      swipe(stage(), -60, 140);
      expect(counter()).toHaveTextContent("2 of 5");
      swipe(stage(), -120, 0, { ...touch, pointerType: "mouse" });
      expect(counter()).toHaveTextContent("2 of 5");
    });

    it("mirrors under dir=rtl, and a cancelled touch (the browser took the pan) is no swipe", async () => {
      const user = userEvent.setup();
      render(<Gallery dir="rtl" />);
      await user.click(thumb(2));
      swipe(stage(), 120, 0);
      expect(counter()).toHaveTextContent("3 of 5");
      fireEvent.pointerDown(stage(), { ...touch, clientX: 200, clientY: 300 });
      fireEvent.pointerCancel(stage(), { ...touch });
      fireEvent.pointerUp(stage(), { ...touch, clientX: 400, clientY: 300 });
      expect(counter()).toHaveTextContent("3 of 5");
    });
  });

  it("preloads the shown picture's neighbours, and only them", async () => {
    const user = userEvent.setup();
    // Files no other test has preloaded: React keeps one preload per address for the document's life.
    const fresh = ITEMS.map((item) => ({ ...item, src: item.src.replace("/photos/", "/preload-only/") }));
    render(<Gallery items={fresh} />);
    const preloaded = () =>
      [...document.head.querySelectorAll('link[rel="preload"][as="image"]')]
        .map((link) => link.getAttribute("href"))
        .filter((href) => href?.startsWith("/preload-only/"))
        .sort();
    expect(preloaded()).toEqual([]);
    await user.click(thumb(3));
    expect(preloaded()).toEqual(["/preload-only/fjord.jpg", "/preload-only/pines.jpg"]);
    // On to 4: its neighbours are 3 (just shown) and 5; the earlier preloads stay.
    await user.keyboard("{ArrowRight}");
    expect(preloaded()).toEqual([
      "/preload-only/cliffs.jpg",
      "/preload-only/fjord.jpg",
      "/preload-only/pines.jpg",
      "/preload-only/salt.jpg",
    ]);
  });

  it("one picture: no previous / next; no pictures: the triggers render and no viewer", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Lightbox items={ITEMS.slice(0, 1)} label="One">
        <Lightbox.Trigger index={0}>Open</Lightbox.Trigger>
      </Lightbox>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog", { name: "One" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous image" })).toBeNull();
    unmount();

    render(
      <Lightbox items={[]} label="None">
        <Lightbox.Trigger index={0}>Open</Lightbox.Trigger>
      </Lightbox>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("asChild on a link to the file: a plain click opens the viewer instead of following it, a modified click is the browser's", async () => {
    const user = userEvent.setup();
    const own = vi.fn();
    const prevented: boolean[] = [];
    const watch = (event: Event) => {
      prevented.push(event.defaultPrevented);
      event.preventDefault(); // jsdom does not navigate
    };
    document.addEventListener("click", watch);
    try {
      render(
        <Lightbox items={ITEMS} label="Field trip">
          <Lightbox.Trigger index={1} asChild>
            <a href="/photos/fjord.jpg" onClick={own}>
              Fjord
            </a>
          </Lightbox.Trigger>
        </Lightbox>,
      );
      const link = screen.getByRole("link", { name: "Fjord" });
      expect(link).toHaveAttribute("aria-haspopup", "dialog");
      await user.keyboard("{Control>}");
      await user.click(link);
      await user.keyboard("{/Control}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(prevented).toEqual([false]);

      await user.click(link);
      expect(own).toHaveBeenCalledTimes(2);
      expect(prevented).toEqual([false, true]);
      expect(counter()).toHaveTextContent("2 of 5");
    } finally {
      document.removeEventListener("click", watch);
    }
  });

  it("words come from labels: the provider's under the instance's", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider labels={{ Lightbox: { position: (i, n) => `${i} von ${n}`, next: "Weiter" } }}>
        <Gallery labels={{ next: "Nächstes Bild" }} />
      </LocaleProvider>,
    );
    await user.click(thumb(2));
    expect(counter()).toHaveTextContent("2 von 5");
    expect(slide()).toHaveAttribute("aria-label", "2 von 5");
    expect(within(viewer()).getByRole("button", { name: "Nächstes Bild" })).toBeInTheDocument();
    expect(within(viewer()).getByRole("button", { name: "Previous image" })).toBeInTheDocument();
  });

  it("the index is controllable", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<Gallery defaultOpen index={1} onIndexChange={onIndexChange} />);
    expect(counter()).toHaveTextContent("2 of 5");
    await user.click(within(viewer()).getByRole("button", { name: "Next image" }));
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(counter()).toHaveTextContent("2 of 5");
  });
});
