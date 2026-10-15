import { useState } from "react";

import { Grid, Stack } from "../../../src/components/layout";
import { Pagination } from "../../../src/components/navigation";
import { Row } from "./parts/demo";

export const meta = {
  title: "Pagination",
  group: "navigation",
  order: 40,
  description:
    "Previous/next plus numbered pages, the current one carrying the accent marker. Under the @md container size, measured on its OWN width, it compacts to “Page 3 of 12”, whatever the viewport. Reaching an end hands focus to the opposite arrow.",
};

export default function PaginationSection() {
  const [page, setPage] = useState(6);
  return (
    <Stack gap="r1">
      <Row label={`Many pages · controlled (page ${page})`}>
        <Pagination pageCount={24} page={page} onPageChange={setPage} />
      </Row>
      <Row label="Few pages · first page (previous disabled)">
        <Pagination pageCount={5} />
      </Row>
      <Row label="Huge counts, locale-formatted">
        <Pagination pageCount={12_480} defaultPage={1_204} />
      </Row>
      <Row label="Narrow containers compact; wide ones do not">
        <Grid columns={{ base: 1, "@3xl": 2 }}>
          <div className="w-1/2 rounded-md border p-r4">
            <Pagination pageCount={24} defaultPage={3} />
          </div>
          <div className="rounded-md border p-r4">
            <Pagination pageCount={24} defaultPage={3} />
          </div>
        </Grid>
      </Row>
      <Row label="Single page">
        <Pagination pageCount={1} />
      </Row>
      <Row label="Right-to-left">
        <div dir="rtl">
          <Pagination pageCount={24} defaultPage={12} />
        </div>
      </Row>
    </Stack>
  );
}
