import { useState } from "react";

import { Grid, Stack } from "../../../src/components/layout";
import { Pagination } from "../../../src/components/navigation";
import { Row } from "./parts/demo";
import { DemoRouter } from "./parts/demo-router";

export const meta = {
  title: "Pagination",
  group: "navigation",
  order: 40,
  description:
    "Previous/next plus numbered pages, the current one carrying the accent marker. Under the @md container size, measured on its OWN width, it compacts to “Page 3 of 12”, whatever the viewport. Reaching an end hands focus to the opposite arrow. With getHref every page is a real link (the router's, via RouterProvider).",
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
      <Row label="Two pages: each arrow hands focus to the other">
        <div data-sc="pagination-two">
          <Pagination pageCount={2} />
        </div>
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
      <Row label="Link mode (getHref): real links, the page read from the URL">
        <DemoRouter initial="/invoices?page=3">
          {(location) => (
            <Stack gap="r5">
              <code className="text-body-2 text-fg-muted">
                {location.pathname}
                {location.search}
              </code>
              <Pagination
                labels={{ nav: "Invoice pages" }}
                pageCount={24}
                page={Number(location.searchParams.get("page") ?? "1")}
                getHref={(p) => `/invoices?page=${p}`}
              />
            </Stack>
          )}
        </DemoRouter>
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
