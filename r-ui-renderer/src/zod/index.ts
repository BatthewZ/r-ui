// @batthewz/r-ui-renderer/zod: the format as a Zod schema. It agrees with
// `validateViewSpec` on `ok` (conformance); the validator's warnings have no
// counterpart here. Built from the same JSON Schema source as `schema.json`,
// so for a JSON Schema (a model's structured output) use `./schema.json`.

import type { z } from "zod";

import type { ViewSpec } from "../spec/types";
import { VIEWSPEC_SCHEMA } from "../spec/validate-schema";
import { ZodBuilder } from "./from-schema";

const { $defs, ...document } = VIEWSPEC_SCHEMA;

// The builder's output type is the schema's, which TypeScript cannot follow;
// the agreement corpus is what holds it to `ViewSpec`.
export const viewSpecSchema = new ZodBuilder($defs).build(document) as z.ZodType<ViewSpec>;
