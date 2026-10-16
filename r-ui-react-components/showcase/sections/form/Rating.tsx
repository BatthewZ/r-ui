import { Heart } from "lucide-react";
import { useState } from "react";

import { Field, Form, FormActions, Rating, Textarea, useForm } from "../../../src/components/form";
import { MediaCard } from "../../../src/components/marketing";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Rating",
  group: "form",
  order: 103,
  description:
    "A rating out of n icons. Interactive, it is one APG slider: a single tab stop speaking \"3.5 out of 5\", arrows (mirrored in RTL), Page Up/Down, Home/End and digits; a press picks an icon (its start half under allowHalf) and a mouse previews. clearable lets a second press, Delete or Home clear it. Read-only, it is an image named by its value at any fraction.",
};

function ReviewForm() {
  const [posted, setPosted] = useState("—");
  const form = useForm<{ overall: number | null; cleanliness: number | null; comment: string }>({
    defaultValues: { overall: null, cleanliness: 4, comment: "" },
    onSubmit: (values) => setPosted(JSON.stringify(values)),
  });
  return (
    <Form form={form} className="grid content-start gap-r3" data-sc="rating-review">
      <Field name="overall" validate={(value) => (value === null ? "Pick a rating before posting." : undefined)}>
        <Field.Label>Overall</Field.Label>
        <Rating allowHalf clearable />
        <Field.Description>Half stars allowed. Press your rating again to clear it.</Field.Description>
        <Field.Error />
      </Field>
      <Field name="cleanliness">
        <Field.Label>Cleanliness</Field.Label>
        <Rating />
      </Field>
      <Field name="comment">
        <Field.Label>Comment</Field.Label>
        <Textarea rows={3} />
      </Field>
      <FormActions>
        <FormActions.Submit>Post review</FormActions.Submit>
      </FormActions>
      <output className="text-body-2 text-fg-secondary">Posted: {posted}</output>
    </Form>
  );
}

const STAYS = [
  { title: "Harbourside loft with a long balcony", rating: 4.5, reviews: 128 },
  { title: "Cabin above the tree line", rating: 4.8, reviews: 61 },
  { title: "New listing in the old town", rating: null, reviews: 0 },
];

export default function RatingSection() {
  return (
    <Stack>
      <Row label="Review form: bound through Field name; posting with no overall rating shows the Field error">
        <ReviewForm />
      </Row>
      <Row label="Read-only in cards: an image named by its value (4.5 out of 5); none yet reads No rating">
        <div className="@container">
          <div className="grid gap-r3 @lg:grid-cols-2 @3xl:grid-cols-3" data-sc="rating-cards">
            {STAYS.map((stay) => (
              <MediaCard
                key={stay.title}
                href="#/overview/form-rating"
                title={stay.title}
                meta={
                  <span className="inline-flex flex-wrap items-center gap-x-r6">
                    <Rating readOnly value={stay.rating} />
                    <span>{stay.reviews === 0 ? "No reviews yet" : `${stay.rating} · ${stay.reviews} reviews`}</span>
                  </span>
                }
              />
            ))}
          </div>
        </div>
      </Row>
      <Row label="States: invalid · disabled · read-only fractions · custom icon and count · retinted">
        <Grid>
          <Field>
            <Field.Label>Support experience</Field.Label>
            <Rating />
            <Field.Error>Tell us how it went.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Locked after 30 days</Field.Label>
            <Rating defaultValue={3} />
          </Field>
          <div className="grid gap-r6 text-body-2 text-fg-secondary">
            <Rating readOnly value={4.3} />
            <Rating readOnly value={2.75} />
            <Rating readOnly value={null} />
          </div>
          <Field>
            <Field.Label>How much do you love it?</Field.Label>
            <Rating max={3} defaultValue={2} icon={<Heart />} labels={{ value: (v, max) => `${v} of ${max} hearts` }} />
          </Field>
          <Field>
            <Field.Label>Difficulty (out of 10)</Field.Label>
            <Rating max={10} defaultValue={7} className="text-fg-primary" />
          </Field>
        </Grid>
      </Row>
      <Row label="Long label · compact · RTL (fills from the right; ArrowLeft raises it)">
        <Grid>
          <Field>
            <Field.Label>How likely are you to recommend this hosting provider to a colleague who runs a similar workload?</Field.Label>
            <Rating allowHalf defaultValue={3.5} />
          </Field>
          <div data-density="compact">
            <Field>
              <Field.Label>Compact</Field.Label>
              <Rating defaultValue={4} />
            </Field>
          </div>
          <div dir="rtl" data-sc="rating-rtl">
            <Field>
              <Field.Label>التقييم</Field.Label>
              <Rating allowHalf defaultValue={2.5} labels={{ value: (v, max) => `${v} من ${max}`, none: "بلا تقييم" }} />
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
