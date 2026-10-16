import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { centerCropRect } from "./avatar-crop";
import { AvatarUpload, type AvatarUploadProps } from "./AvatarUpload";
import { Field } from "./Field";
import type { FileUploadContext } from "./FileUpload";

const PORTRAIT = new File([new Uint8Array(2048)], "portrait.png", { type: "image/png" });
const NOTES = new File([new Uint8Array(10)], "notes.pdf", { type: "application/pdf" });

function Profile<T>(props: Partial<AvatarUploadProps<T>>) {
  return (
    <Field>
      <Field.Label>Profile photo</Field.Label>
      <AvatarUpload<T> personName="Ada Lovelace" {...(props as AvatarUploadProps<T>)} />
    </Field>
  );
}

const choose = () => screen.getByRole("button", { name: /^Profile photo (Choose|Replace) photo$/ });
const picker = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]:not([name])')!;
const pick = (container: HTMLElement, file: File) => fireEvent.change(picker(container), { target: { files: [file] } });
const spoken = () => screen.getByRole("status").textContent?.trim();

/** The crop preview's image, decoded by "the browser" at `width` × `height`. */
function decode(container: HTMLElement, width: number, height: number) {
  const image = container.querySelector<HTMLImageElement>("[data-phase='crop'] img")!;
  Object.defineProperty(image, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(image, "naturalHeight", { value: height, configurable: true });
  fireEvent.load(image);
  return image;
}

/** An `onUpload` whose calls the test settles by hand. */
function deferredUploads() {
  const calls: { file: File; context: FileUploadContext; resolve: (url: string) => void; reject: (error: unknown) => void }[] = [];
  const onUpload = vi.fn(
    (file: File, context: FileUploadContext) =>
      new Promise<string>((resolve, reject) => {
        calls.push({ file, context, resolve, reject });
      }),
  );
  return { calls, onUpload };
}

let drawImage: ReturnType<typeof vi.fn>;
beforeEach(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
  // jsdom draws and encodes nothing: the canvas is the browser's boundary, so it is stubbed at it.
  drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({ drawImage, imageSmoothingQuality: "low" }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, done, type) {
    done(new Blob([`${this.width}x${this.height}`], { type: type ?? "image/png" }));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("centerCropRect", () => {
  it("keeps the largest centred square, tightened by zoom", () => {
    expect(centerCropRect(800, 400, 1)).toEqual({ sx: 200, sy: 0, side: 400 });
    expect(centerCropRect(400, 800, 2)).toEqual({ sx: 100, sy: 300, side: 200 });
    expect(centerCropRect(300, 300, 0.5)).toEqual({ sx: 0, sy: 0, side: 300 });
  });
});

describe("AvatarUpload", () => {
  it("is a button named by the Field label that opens the picker; a refused file is the Field's error", async () => {
    const user = userEvent.setup();
    const { container } = render(<Profile maxSize={1024} />);
    expect(choose()).toHaveAccessibleName("Profile photo Choose photo");
    await user.click(choose());
    expect(HTMLInputElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(picker(container)).toHaveAttribute("accept", "image/*");

    pick(container, NOTES);
    expect(choose()).toHaveAttribute("aria-invalid", "true");
    expect(choose()).toHaveAccessibleDescription("“notes.pdf” is not an image this field takes.");
    pick(container, PORTRAIT);
    expect(choose()).toHaveAccessibleDescription("“portrait.png” is larger than 1 kB.");
    expect(spoken()).toBe("“portrait.png” is larger than 1 kB.");
  });

  it("crops to a centred square at the zoom picked, uploads it with progress, and takes the result as its value", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const onValueChange = vi.fn();
    const { container } = render(<Profile onUpload={onUpload} onValueChange={onValueChange} outputSize={256} />);
    await user.click(choose());
    pick(container, PORTRAIT);

    const zoom = screen.getByRole("slider", { name: "Zoom" });
    expect(zoom).toHaveFocus();
    expect(zoom).toHaveAttribute("aria-valuetext", "100%");
    const use = screen.getByRole("button", { name: "Use photo" });
    // Not before the browser has decoded the image.
    expect(use).toHaveAttribute("aria-disabled", "true");
    const image = decode(container, 800, 400);
    expect(use).not.toHaveAttribute("aria-disabled");

    await user.keyboard("{End}");
    expect(zoom).toHaveAttribute("aria-valuetext", "300%");
    expect(image.style.transform).toBe("scale(3)");
    await user.click(use);

    expect(drawImage).toHaveBeenCalledTimes(1);
    const [source, sx, sy, sw, sh, dx, dy, dw, dh] = drawImage.mock.calls[0]!;
    expect(source).toBe(image);
    expect([sx, sy, sw, sh].map((n: number) => Math.round(n * 100) / 100)).toEqual([333.33, 133.33, 133.33, 133.33]);
    expect([dx, dy, dw, dh]).toEqual([0, 0, 256, 256]);

    expect(onUpload).toHaveBeenCalledTimes(1);
    const { file, context } = calls[0]!;
    expect(file.name).toBe("portrait.png");
    expect(file.type).toBe("image/png");
    expect(await file.text()).toBe("256x256");

    const ring = screen.getByRole("progressbar", { name: "Uploading photo" });
    expect(ring).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByRole("button", { name: "Cancel upload" })).toHaveFocus();
    act(() => context.onProgress(0.4));
    expect(ring).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("40%")).toBeInTheDocument();

    await act(async () => calls[0]!.resolve("https://cdn.example/ada.png"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("https://cdn.example/ada.png");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(choose()).toHaveAccessibleName("Profile photo Replace photo");
    expect(choose()).toHaveFocus();
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.example/ada.png");
    expect(spoken()).toBe("Photo updated.");

    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(choose()).toHaveAccessibleName("Profile photo Choose photo");
    expect(choose()).toHaveFocus();
    expect(spoken()).toBe("Photo removed.");
  });

  it("cancels an upload through its signal and keeps the photo it had", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const onValueChange = vi.fn();
    const { container } = render(<Profile onUpload={onUpload} defaultValue="https://cdn.example/old.png" onValueChange={onValueChange} />);
    await user.click(choose());
    pick(container, PORTRAIT);
    decode(container, 400, 400);
    await user.click(screen.getByRole("button", { name: "Use photo" }));
    await user.click(screen.getByRole("button", { name: "Cancel upload" }));
    expect(calls[0]!.context.signal.aborted).toBe(true);
    expect(choose()).toHaveFocus();
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.example/old.png");
    await act(async () => calls[0]!.resolve("https://cdn.example/late.png"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("reports a failed upload, and Try again uploads the same crop", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const { container } = render(<Profile onUpload={onUpload} />);
    await user.click(choose());
    pick(container, PORTRAIT);
    decode(container, 400, 400);
    await user.click(screen.getByRole("button", { name: "Use photo" }));
    await act(async () => calls[0]!.reject(new Error("the server is busy")));
    expect(screen.getByText("Upload failed: the server is busy", { selector: "p > span" })).toBeInTheDocument();
    expect(spoken()).toBe("Upload failed: the server is busy");
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toHaveFocus();
    await user.click(retry);
    expect(onUpload).toHaveBeenCalledTimes(2);
    expect(calls[1]!.file).toBe(calls[0]!.file);
    await act(async () => calls[1]!.resolve("https://cdn.example/ada.png"));
    expect(choose()).toHaveAccessibleName("Profile photo Replace photo");
  });

  it("leaves the crop with Cancel, changing nothing", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<Profile onValueChange={onValueChange} />);
    await user.click(choose());
    pick(container, PORTRAIT);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(choose()).toHaveFocus();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
  });

  it("without onUpload, the value is the cropped File, submitted from a file input of its own", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<Profile name="avatar" outputType="image/jpeg" onValueChange={onValueChange} />);
    await user.click(choose());
    pick(container, PORTRAIT);
    decode(container, 600, 600);
    await user.click(screen.getByRole("button", { name: "Use photo" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const value = onValueChange.mock.calls[0]![0] as File;
    expect(value).toBeInstanceOf(File);
    expect(value.name).toBe("portrait.jpg");
    expect(value.type).toBe("image/jpeg");
    expect(container.querySelector('input[type="file"][name="avatar"]')).toBeInTheDocument();
    expect(choose()).toHaveAccessibleName("Profile photo Replace photo");
  });

  it("refuses an image the browser cannot decode", async () => {
    const user = userEvent.setup();
    const { container } = render(<Profile />);
    await user.click(choose());
    pick(container, PORTRAIT);
    fireEvent.error(container.querySelector("[data-phase='crop'] img")!);
    expect(choose()).toHaveAccessibleDescription("“portrait.png” could not be read as an image.");
    expect(choose()).toHaveFocus();
  });

  it("is disabled with its Field, and read-only offers nothing to press", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Field disabled>
        <Field.Label>Profile photo</Field.Label>
        <AvatarUpload defaultValue="https://cdn.example/ada.png" />
      </Field>,
    );
    expect(choose()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeDisabled();
    rerender(
      <Field readOnly>
        <Field.Label>Profile photo</Field.Label>
        <AvatarUpload defaultValue="https://cdn.example/ada.png" />
      </Field>,
    );
    expect(choose()).toHaveAttribute("aria-disabled", "true");
    await user.click(choose());
    expect(HTMLInputElement.prototype.click).not.toHaveBeenCalled();
  });
});
