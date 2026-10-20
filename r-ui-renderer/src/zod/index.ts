// @batthewz/r-ui-renderer/zod: the format as a Zod schema. It agrees with
// `validateViewSpec` on `ok` (conformance); the validator's warnings have no
// counterpart here.

import { z } from "zod";

import type { ViewSpec } from "../spec/types";

export const viewSpecSchema: z.ZodType<ViewSpec> = z.lazy(() => {
  throw new Error("not implemented");
});
