import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { FileUpload, type FileUploadContext, type FileUploadProps, matchesAccept } from "./FileUpload";
import { Form, useForm } from "./use-form";

const file = (name: string, size: number, type: string) => new File([new Uint8Array(size)], name, { type });
const PDF = file("report.pdf", 1536, "application/pdf");
const PNG = file("avatar.png", 2048, "image/png");
const ZIP = file("archive.zip", 100, "application/zip");
const HUGE = file("scan.pdf", 6 * 1024 * 1024, "application/pdf");

function Attachments<T>(props: FileUploadProps<T> & { fieldProps?: Partial<React.ComponentProps<typeof Field>> }) {
  const { fieldProps, ...rest } = props;
  return (
    <Field {...fieldProps}>
      <Field.Label>Attachments</Field.Label>
      <FileUpload<T> {...(rest as FileUploadProps<T>)} />
      <Field.Description>Shared with the team.</Field.Description>
    </Field>
  );
}

const zone = () => screen.getByRole("button", { name: /^Attachments Drop/ });
const picker = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;
const names = () => {
  const list = screen.queryByRole("list", { name: "Files" });
  return list ? within(list).getAllByRole("listitem").map((li) => li.querySelector("[title]")?.textContent) : [];
};
const spoken = () => screen.getByRole("status").textContent?.trim();
/** A drop with these files, as the browser delivers it. */
const drop = (target: Element, files: File[]) =>
  fireEvent.drop(target, { dataTransfer: { files, types: ["Files"], dropEffect: "none" } });

/** An `onUpload` whose calls the test settles by hand. */
function deferredUploads() {
  const calls: { file: File; context: FileUploadContext; resolve: (id: string) => void; reject: (error: unknown) => void }[] = [];
  const onUpload = vi.fn(
    (file: File, context: FileUploadContext) =>
      new Promise<string>((resolve, reject) => {
        calls.push({ file, context, resolve, reject });
      }),
  );
  return { calls, onUpload };
}

let urls: string[];
beforeEach(() => {
  urls = [];
  let n = 0;
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${++n}`;
    urls.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("matchesAccept", () => {
  it("speaks the accept attribute's grammar", () => {
    expect(matchesAccept(PDF, ".pdf")).toBe(true);
    expect(matchesAccept(PDF, "image/*, .PDF")).toBe(true);
    expect(matchesAccept(PNG, "image/*")).toBe(true);
    expect(matchesAccept(PNG, "image/jpeg")).toBe(false);
    expect(matchesAccept(file("notes", 1, ""), "text/*")).toBe(false);
    expect(matchesAccept(ZIP, undefined)).toBe(true);
  });
});

describe("FileUpload", () => {
  it("is a button named by the Field label and its prompt that opens the native picker", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<Attachments accept="image/*,.pdf" maxSize={5 * 1024 * 1024} multiple maxFiles={4} />);
    expect(zone()).toHaveAccessibleName("Attachments Drop files here or browse");
    expect(zone()).toHaveAccessibleDescription("Images or PDF, up to 5 MB each, 4 files at most. Shared with the team.");
    zone().focus();
    await user.keyboard("{Enter}");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("lists picked files with name and size, and removes one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<Attachments multiple onValueChange={onValueChange} />);
    await user.upload(picker(container), [PDF, ZIP]);
    expect(onValueChange.mock.calls).toEqual([[[PDF, ZIP]]]);
    expect(names()).toEqual(["report.pdf", "archive.zip"]);
    expect(screen.getByText("1.5 kB")).toBeInTheDocument();
    expect(spoken()).toBe("Added report.pdf, archive.zip.");
    expect(screen.getByRole("button", { name: "Remove report.pdf" }).closest("[data-print~='hide']")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove report.pdf" }));
    expect(onValueChange.mock.calls[1]).toEqual([[ZIP]]);
    expect(names()).toEqual(["archive.zip"]);
    // The removed row's button is gone; focus goes back to the zone.
    expect(zone()).toHaveFocus();
  });

  it("refuses a wrong type and an oversize file with a message the Field counts as its error", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onValueChange = vi.fn();
    const { container } = render(
      <Attachments multiple accept=".pdf" maxSize={5 * 1024 * 1024} onValueChange={onValueChange} />,
    );
    await user.upload(picker(container), [PNG, HUGE, PDF]);
    expect(onValueChange.mock.calls).toEqual([[[PDF]]]);
    expect(zone()).toHaveAttribute("aria-invalid", "true");
    expect(zone()).toHaveAccessibleDescription(
      "PDF, up to 5 MB each. “avatar.png” is not a file type this field takes. “scan.pdf” is larger than 5 MB. Shared with the team.",
    );
    // The Field itself is invalid (its root), not only the zone.
    expect(container.firstElementChild).toHaveAttribute("data-invalid");
    // A good pick clears the refusal.
    await user.upload(picker(container), [file("b.pdf", 10, "application/pdf")]);
    expect(zone()).not.toHaveAttribute("aria-invalid");
  });

  it("stops at maxFiles and says how many were left out", async () => {
    const user = userEvent.setup();
    const { container } = render(<Attachments multiple maxFiles={2} defaultValue={[PDF]} />);
    await user.upload(picker(container), [PNG, ZIP]);
    expect(names()).toEqual(["report.pdf", "avatar.png"]);
    expect(screen.getByText("Up to 2 files: 1 not added.")).toBeInTheDocument();
  });

  it("replaces the file when it takes one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<Attachments onValueChange={onValueChange} />);
    expect(picker(container)).not.toHaveAttribute("multiple");
    await user.upload(picker(container), PDF);
    await user.upload(picker(container), ZIP);
    expect(onValueChange.mock.calls).toEqual([[[PDF]], [[ZIP]]]);
    expect(names()).toEqual(["archive.zip"]);
  });

  it("keeps the current upload until a new one replaces it, when it takes one", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const onValueChange = vi.fn();
    const { container } = render(<Attachments onUpload={onUpload} defaultValue={["old"]} onValueChange={onValueChange} />);
    await user.upload(picker(container), PNG);
    expect(names()).toEqual(["old", "avatar.png"]);
    await act(async () => calls[0]!.resolve("new"));
    expect(onValueChange.mock.calls).toEqual([[["new"]]]);
    expect(names()).toEqual(["avatar.png"]);
  });

  it("takes dropped files, and says so in words while they are dragged over it", () => {
    const onValueChange = vi.fn();
    render(<Attachments multiple onValueChange={onValueChange} />);
    fireEvent.dragOver(zone(), { dataTransfer: { types: ["Files"], dropEffect: "none" } });
    expect(zone()).toHaveAttribute("data-dragging");
    expect(zone()).toHaveAccessibleName("Attachments Drop to add the files");
    fireEvent.dragLeave(zone(), { relatedTarget: document.body });
    expect(zone()).not.toHaveAttribute("data-dragging");
    drop(zone(), [PDF]);
    expect(onValueChange.mock.calls).toEqual([[[PDF]]]);
  });

  it("takes pasted files only when asked to", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Attachments multiple onValueChange={onValueChange} />);
    fireEvent.paste(zone(), { clipboardData: { files: [PNG] } });
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(<Attachments multiple paste onValueChange={onValueChange} />);
    fireEvent.paste(zone(), { clipboardData: { files: [PNG] } });
    expect(onValueChange.mock.calls).toEqual([[[PNG]]]);
  });

  it("uploads with progress, and the value is what the upload resolved with", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const onValueChange = vi.fn();
    const { container } = render(<Attachments multiple name="docs" onUpload={onUpload} onValueChange={onValueChange} />);
    await user.upload(picker(container), PDF);
    expect(onUpload).toHaveBeenCalledTimes(1);
    const bar = screen.getByRole("progressbar", { name: "Uploading report.pdf" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    act(() => calls[0]!.context.onProgress(0.42));
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(onValueChange).not.toHaveBeenCalled();
    await act(async () => calls[0]!.resolve("doc_1"));
    expect(onValueChange.mock.calls).toEqual([[["doc_1"]]]);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
    expect(names()).toEqual(["report.pdf"]);
    // Native submission: one hidden input per id; the file input carries no name.
    expect(container.querySelector('input[type="hidden"][name="docs"]')).toHaveValue("doc_1");
    expect(picker(container)).not.toHaveAttribute("name");
    expect(spoken()).toBe("report.pdf uploaded.");
  });

  it("cancels through the signal, then retries; a failure shows its reason and retries too", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const { container } = render(<Attachments multiple onUpload={onUpload} />);
    await user.upload(picker(container), PDF);
    await user.click(screen.getByRole("button", { name: "Cancel upload of report.pdf" }));
    expect(calls[0]!.context.signal.aborted).toBe(true);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    // Focus stays in the row: the Cancel button became Retry and Remove.
    expect(screen.getByRole("button", { name: "Retry upload of report.pdf" })).toHaveFocus();
    // A late answer from the cancelled upload changes nothing.
    await act(async () => calls[0]!.resolve("late"));
    expect(screen.getByText("Cancelled")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry upload of report.pdf" }));
    expect(onUpload).toHaveBeenCalledTimes(2);
    await act(async () => calls[1]!.reject(new Error("The server said no.")));
    expect(screen.getByText("Upload failed: The server said no.")).toBeInTheDocument();
    expect(spoken()).toBe("report.pdf failed to upload.");
    await user.click(screen.getByRole("button", { name: "Retry upload of report.pdf" }));
    expect(onUpload).toHaveBeenCalledTimes(3);
    await act(async () => calls[2]!.resolve("doc_9"));
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });

  it("keeps focus in the row when the upload it waits on finishes", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const { container } = render(<Attachments multiple onUpload={onUpload} />);
    await user.upload(picker(container), [PDF, ZIP]);
    screen.getByRole("button", { name: "Cancel upload of archive.zip" }).focus();
    // Another row finishing leaves focus where it is.
    await act(async () => calls[0]!.resolve("doc_1"));
    expect(screen.getByRole("button", { name: "Cancel upload of archive.zip" })).toHaveFocus();
    // Cancel is gone with the finished upload; its row's Remove takes focus, not the page.
    await act(async () => calls[1]!.resolve("doc_2"));
    expect(screen.getByRole("button", { name: "Remove archive.zip" })).toHaveFocus();
  });

  it("leaves focus on the page once it has left the row for nowhere, when the upload fails", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const { container } = render(<Attachments multiple onUpload={onUpload} />);
    await user.upload(picker(container), PDF);
    const cancel = screen.getByRole("button", { name: "Cancel upload of report.pdf" });
    cancel.focus();
    // A press on the page's background: the blur's relatedTarget is null.
    await act(async () => cancel.blur());
    expect(document.body).toHaveFocus();
    // The row's buttons swap (Cancel becomes Retry and Remove) with no focus of its to keep.
    await act(async () => calls[0]!.reject(new Error("The server said no.")));
    expect(screen.getByText("Upload failed: The server said no.")).toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it("keeps both values when two uploads finish before a re-render, bound to a Form", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    let read: () => unknown = () => undefined;
    function Docs() {
      const form = useForm({ defaultValues: { docs: [] as string[] } });
      read = () => form.getValues().docs;
      return (
        <Form form={form}>
          <Field name="docs">
            <Field.Label>Attachments</Field.Label>
            <FileUpload multiple onUpload={onUpload} />
          </Field>
        </Form>
      );
    }
    const { container } = render(<Docs />);
    await user.upload(picker(container), [PDF, ZIP]);
    await act(async () => {
      calls[0]!.resolve("a");
      calls[1]!.resolve("b");
    });
    expect(read()).toEqual(["a", "b"]);
    expect(container.querySelectorAll('input[type="hidden"][name="docs"]')).toHaveLength(2);
  });

  it("shows a thumbnail for an image and revokes its object URL on removal and unmount", async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<Attachments multiple />);
    await user.upload(picker(container), [PNG, file("b.png", 1, "image/png")]);
    expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual(urls);
    expect(urls).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Remove avatar.png" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(urls[0]);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenLastCalledWith(urls[1]);
  });

  it("aborts what is still uploading when it unmounts", async () => {
    const user = userEvent.setup();
    const { calls, onUpload } = deferredUploads();
    const { container, unmount } = render(<Attachments multiple onUpload={onUpload} />);
    await user.upload(picker(container), PDF);
    unmount();
    expect(calls[0]!.context.signal.aborted).toBe(true);
  });

  it("shows values it did not upload through describe", () => {
    render(
      <Attachments
        multiple
        onUpload={async () => "x"}
        defaultValue={["doc_7"]}
        describe={(id: string) => ({ name: `${id}.pdf`, size: 2048, type: "application/pdf" })}
      />,
    );
    expect(names()).toEqual(["doc_7.pdf"]);
    expect(screen.getByText("2 kB")).toBeInTheDocument();
    expect(screen.queryByText("Uploaded")).toBeNull();
  });

  it("binds File values to a Form, and is disabled by the Field", async () => {
    const user = userEvent.setup();
    let read: () => unknown = () => undefined;
    function Avatar() {
      const form = useForm({ defaultValues: { avatar: [] as File[] } });
      read = () => form.getValues().avatar;
      return (
        <Form form={form}>
          <Field name="avatar">
            <Field.Label>Attachments</Field.Label>
            <FileUpload accept="image/*" />
          </Field>
        </Form>
      );
    }
    const { container, unmount } = render(<Avatar />);
    await user.upload(picker(container), PNG);
    expect(read()).toEqual([PNG]);
    unmount();
    render(<Attachments fieldProps={{ disabled: true }} />);
    expect(zone()).toBeDisabled();
  });
});
