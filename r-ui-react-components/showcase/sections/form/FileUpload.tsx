import { useRef, useState } from "react";

import {
  Field,
  FileUpload,
  type FileUploadContext,
  type FileUploadItemInfo,
  Form,
  FormActions,
  useForm,
} from "../../../src/components/form";
import { Button } from "../../../src/components/primitives";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "FileUpload",
  group: "form",
  order: 160,
  description:
    "A drop zone that is a real button (Enter or Space opens the picker), with type, size and count checks whose refusals are the Field's error. Uploads report progress and can be cancelled, retried after a failure and removed; the value is what the server returned. “Add sample files” drops three files here: one is an image (thumbnail), one fails at 60%.",
};

const MB = 1024 * 1024;

/** A pretend server: progress over a few seconds, a file named “…corrupt…” fails part-way. */
function simulateUpload(file: File, { onProgress, signal }: FileUploadContext): Promise<string> {
  return new Promise((resolve, reject) => {
    const duration = Math.min(8000, Math.max(2500, file.size / 800));
    const fails = /corrupt/i.test(file.name);
    const started = performance.now();
    const timer = setInterval(() => {
      const fraction = Math.min(1, (performance.now() - started) / duration);
      if (fails && fraction >= 0.6) {
        clearInterval(timer);
        reject(new Error("the server could not read the spreadsheet."));
        return;
      }
      onProgress(fraction);
      if (fraction >= 1) {
        clearInterval(timer);
        resolve(`doc_${file.name.replace(/\W+/g, "-")}_${Math.round(started)}`);
      }
    }, 150);
    signal.addEventListener(
      "abort",
      () => {
        clearInterval(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** Files attached before this visit: the server knows their names and sizes. */
const EARLIER: Record<string, FileUploadItemInfo> = {
  doc_runbook: { name: "checkout-runbook-v3.pdf", size: 412_000, type: "application/pdf" },
};
const describeDoc = (id: string): FileUploadItemInfo => EARLIER[id] ?? { name: id };

/** An image drawn in the theme's own colours, so the thumbnail has something to show. */
async function sampleImage(name: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 120;
  const context = canvas.getContext("2d");
  const style = getComputedStyle(document.documentElement);
  if (context) {
    context.fillStyle = style.getPropertyValue("--C-SURFACE-2").trim();
    context.fillRect(0, 0, 160, 120);
    context.fillStyle = style.getPropertyValue("--C-ACCENT").trim();
    context.beginPath();
    context.arc(80, 60, 34, 0, Math.PI * 2);
    context.fill();
  }
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  return new File([blob ?? new Blob()], name, { type: "image/png" });
}

const bytes = (size: number) => new Uint8Array(size);

/** Drops files on a zone the way a browser does, for the demo button. */
function dropOn(zone: Element | null, files: File[]) {
  if (!zone) return;
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  zone.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
}

function IncidentAttachments() {
  const [saved, setSaved] = useState<string[] | null>(null);
  const form = useForm({
    defaultValues: { documents: ["doc_runbook"] as string[] },
    onSubmit: (values) => setSaved(values.documents),
  });
  const zoneRef = useRef<HTMLButtonElement>(null);
  return (
    <Form form={form} className="grid gap-r3" data-testid="upload-documents">
      <Field name="documents">
        <Field.Label>Incident attachments</Field.Label>
        <FileUpload
          ref={zoneRef}
          multiple
          paste
          accept=".pdf,.docx,.xlsx,.csv,image/*"
          maxSize={10 * MB}
          maxFiles={5}
          onUpload={simulateUpload}
          describe={describeDoc}
        />
        <Field.Description>Runbooks, screenshots and exports. You can also paste a screenshot.</Field.Description>
      </Field>
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            dropOn(zoneRef.current, [
              new File([bytes(2_400_000)], "site-survey.pdf", { type: "application/pdf" }),
              await sampleImage("error-dialog.png"),
              new File([bytes(1_900_000)], "q3-budget-corrupt.xlsx", {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              }),
            ]);
          }}
        >
          Add sample files
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => dropOn(zoneRef.current, [new File([bytes(11 * MB)], "full-disk-image.pdf", { type: "application/pdf" })])}
        >
          Drop an 11 MB file
        </Button>
        <FormActions.Submit>Save attachments</FormActions.Submit>
      </FormActions>
      {saved && (
        <p className="text-body-2 text-fg-secondary" role="status">
          Saved: {saved.length === 0 ? "no files" : saved.join(", ")}
        </p>
      )}
    </Form>
  );
}

export default function FileUploadSection() {
  return (
    <Stack>
      <Row label="Documents · bound to useForm · progress, cancel, a failure with retry, remove">
        <IncidentAttachments />
      </Row>
      <Row label="Profile photo · one image, the next replaces it · File values with a native name (no onUpload)">
        <Grid>
          <Field data-testid="upload-avatar">
            <Field.Label>Profile photo</Field.Label>
            <FileUpload accept="image/png,image/jpeg,image/webp" maxSize={2 * MB} name="avatar" paste />
            <Field.Description>Square works best. Shown to your team.</Field.Description>
          </Field>
          <Field required>
            <Field.Label>Signed contract</Field.Label>
            <FileUpload accept=".pdf" />
            <Field.Error>Attach the signed contract.</Field.Error>
          </Field>
        </Grid>
      </Row>
      <Row label="States: disabled · read-only · compact subtree · RTL">
        <Grid>
          <Field disabled>
            <Field.Label>Exports</Field.Label>
            <FileUpload multiple accept=".csv" />
          </Field>
          <Field readOnly>
            <Field.Label>Runbooks</Field.Label>
            <FileUpload multiple onUpload={simulateUpload} defaultValue={["doc_runbook"]} describe={describeDoc} />
          </Field>
          <div data-density="compact">
            <Field>
              <Field.Label>Logs</Field.Label>
              <FileUpload multiple accept=".log,.txt,.gz" maxSize={50 * MB} />
            </Field>
          </div>
          <div dir="rtl">
            <Field>
              <Field.Label>المرفقات</Field.Label>
              <FileUpload
                multiple
                labels={{
                  prompt: () => "أفلت الملفات هنا أو تصفّح",
                  dropping: () => "أفلت لإضافة الملفات",
                  hint: () => "حتى ٥ ميغابايت لكل ملف.",
                }}
              />
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
