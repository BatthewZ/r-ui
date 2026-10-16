import { useEffect, useRef, useState } from "react";

import {
  AvatarUpload,
  type FileUploadContext,
  Field,
  Form,
  FormActions,
  Input,
  Switch,
  useForm,
  useFormValue,
} from "../../../src/components/form";
import { formatBytes } from "../../../src/util/format";
import { LocaleProvider, type LocaleLabels } from "../../../src/util/locale";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "AvatarUpload",
  group: "form",
  order: 165,
  description:
    "A profile photo: Choose (or Replace) and Remove. A picked image is checked (type, size; a refusal is the Field's error), then cropped: the avatar previews a centred square that the zoom Slider tightens, and Use photo draws it to a square canvas. It uploads through FileUpload's onUpload(file, { onProgress, signal }) under a ProgressRing round the avatar, and can be cancelled or tried again. This demo's server takes 2.5 seconds and stores the photo as a data URL.",
};

// A tiny inline PNG portrait, so the demo needs no network (as in the Avatar demo).
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAABaklEQVR42u3U2U7CYBCG4e/SPPYavJvurQmCiKKIIBRK3XdxwX25LE3+hjQpLZ0J0DExeY6/eY8G3+GqKPgaeKLgM/BEwUfgiYL3vicK3nquKPKCXn1XFLz4rih47rqi4KnjiIJRx2FbWV5Kw97EaN/hyaiJmlizeGw7DFNrFMYyHtoOVc4ahTqO+5ZNQqpRSPu4a9kkjCDSPoZ7NgkjiLSPYdMm4QRR9nHbtEkYQaR93OxaJIwg0j6uGxYJI4i0j6uGRcIIIu3jcsciYQSR9slB1CbqOC62TYacNYxlnNdNnqk1vFmc1U22jBr2Jk63TFFwsmmIIi/ouGaIgqOaIQoON4w8GA86Kc8hHFT1bDNJics+h7CqZ5h5jZJxEeG6nmZONVFTylEMKvpEc61RJt5FUNGTFlCjJE+jX9biFpYSFw9Ar6yNFVKjjBvgr2lKgTWKyoBf0n4VXhM1lTR0xdQoEFXzH/QXg34AOrexHWhowWAAAAAASUVORK5CYII=";

const MB = 1024 * 1024;

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("the photo could not be read."));
    reader.readAsDataURL(file);
  });

/** A pretend server: progress over 2.5 seconds, then the photo back as a data URL (or a failure at 50%). */
function simulateUpload(fails: () => boolean) {
  return (file: File, { onProgress, signal }: FileUploadContext) =>
    new Promise<string>((resolve, reject) => {
      const failing = fails();
      const started = performance.now();
      const timer = setInterval(() => {
        const fraction = Math.min(1, (performance.now() - started) / 2500);
        if (failing && fraction >= 0.5) {
          clearInterval(timer);
          reject(new Error("the server is busy. Try again in a moment."));
          return;
        }
        onProgress(fraction);
        if (fraction >= 1) {
          clearInterval(timer);
          readAsDataUrl(file).then(resolve, reject);
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

/** The saved photo's pixel size and bytes, read back from its data URL. */
function SavedPhoto({ src }: { src: string | null }) {
  const [measured, setMeasured] = useState<{ src: string; size: string } | null>(null);
  useEffect(() => {
    if (!src) return;
    const image = new Image();
    image.onload = () =>
      setMeasured({ src, size: `${image.naturalWidth} × ${image.naturalHeight} px, ${formatBytes(Math.round((src.length * 3) / 4))}` });
    image.src = src;
  }, [src]);
  const size = measured && measured.src === src ? measured.size : "…";
  return (
    <span className="text-body-2 text-fg-secondary" data-sc="avatar-result">
      {src ? `Saved photo: ${size}` : "No photo saved"}
    </span>
  );
}

function AvatarValue() {
  return <SavedPhoto src={useFormValue<string | null>("avatar")} />;
}

/** The photo field, its initials following the name typed above it. */
function PhotoField({ upload }: { upload: (file: File, context: FileUploadContext) => Promise<string> }) {
  const personName = useFormValue<string>("name");
  return (
    <Field name="avatar" data-sc="avatar-photo-field">
      <Field.Label>Profile photo</Field.Label>
      <AvatarUpload personName={personName} accept="image/png,image/jpeg,image/webp" maxSize={8 * MB} onUpload={upload} />
      <Field.Description>PNG, JPEG or WebP, up to 8 MB. Cropped to a square.</Field.Description>
    </Field>
  );
}

/** A profile: name and photo bound through Field name; the photo uploads as soon as it is cropped. */
function ProfileForm() {
  const [failNext, setFailNext] = useState(false);
  const failing = useRef(failNext);
  failing.current = failNext;
  const [upload] = useState(() =>
    simulateUpload(() => {
      const fail = failing.current;
      if (fail) setFailNext(false);
      return fail;
    }),
  );
  const [posted, setPosted] = useState("—");
  const form = useForm<{ name: string; avatar: string | null }>({
    defaultValues: { name: "Ada Lovelace", avatar: null },
    onSubmit: ({ name, avatar }) => setPosted(`${name}, ${avatar ? "with a photo" : "no photo"}`),
  });
  return (
    <Form form={form} className="grid max-w-column-lg content-start gap-r3" data-sc="avatar-profile">
      <Field name="name">
        <Field.Label>Display name</Field.Label>
        <Input autoComplete="name" />
      </Field>
      <PhotoField upload={upload} />
      <Switch checked={failNext} onCheckedChange={setFailNext}>
        Fail the next upload
      </Switch>
      <AvatarValue />
      <FormActions>
        <FormActions.Submit>Save profile</FormActions.Submit>
      </FormActions>
      <output className="text-body-2 text-fg-secondary">Posted: {posted}</output>
    </Form>
  );
}

/** Module scope: a provider's labels object must stay stable. */
const ARABIC: LocaleLabels = {
  AvatarUpload: {
    choose: "اختر صورة",
    replace: "استبدل الصورة",
    remove: "احذف الصورة",
    zoom: "تكبير",
    cropHint: "يُحتفظ بوسط الصورة. كبّر لتقريبها.",
    apply: "استخدم الصورة",
    cancel: "إلغاء",
  },
};

export default function AvatarUploadSection() {
  return (
    <Stack>
      <Row label="Profile: crop with the zoom Slider, upload with progress round the avatar, cancel, a failure and Try again (switch on “Fail the next upload”) · bound through Field name">
        <ProfileForm />
      </Row>
      <Row label="No upload (the value is the cropped File) · an existing photo · no name and no photo · a refused type or size is the Field's error">
        <Grid>
          <Field>
            <Field.Label>Team logo</Field.Label>
            <AvatarUpload name="logo" personName="Northwind Ops" outputSize={256} />
            <Field.Description>Kept as a file and sent with the form.</Field.Description>
          </Field>
          <Field>
            <Field.Label>Profile photo</Field.Label>
            <AvatarUpload personName="Ada Lovelace" defaultValue={PHOTO} />
          </Field>
          <Field>
            <Field.Label>Contact photo</Field.Label>
            <AvatarUpload maxSize={200 * 1024} accept="image/png" />
            <Field.Description>PNG only, up to 200 kB.</Field.Description>
          </Field>
        </Grid>
      </Row>
      <Row label="Invalid · disabled · read-only · compact subtree · RTL with translated labels">
        <Grid>
          <Field invalid>
            <Field.Label>Profile photo</Field.Label>
            <AvatarUpload personName="Grace Hopper" />
            <Field.Error>A photo is required for your badge.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Profile photo</Field.Label>
            <AvatarUpload personName="Ada Lovelace" defaultValue={PHOTO} />
          </Field>
          <Field readOnly>
            <Field.Label>Profile photo</Field.Label>
            <AvatarUpload personName="Ada Lovelace" defaultValue={PHOTO} />
          </Field>
          <div data-density="compact">
            <Field>
              <Field.Label>Profile photo</Field.Label>
              <AvatarUpload personName="Katherine Johnson" />
            </Field>
          </div>
          <LocaleProvider dir="rtl" locale="ar" labels={ARABIC}>
            <Field>
              <Field.Label>الصورة الشخصية</Field.Label>
              <AvatarUpload personName="Layla Haddad" defaultValue={PHOTO} />
            </Field>
          </LocaleProvider>
        </Grid>
      </Row>
    </Stack>
  );
}
