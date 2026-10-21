/**
 * Builds a Zod schema from the format's JSON Schema subset (the one source
 * `validateViewSpec` and `schema.json` also read), so the three agree by
 * construction; a shared corpus test holds them to it. Shapes map to Zod's own
 * (objects, arrays, unions, literals) so the schema composes like any other;
 * what Zod has no keyword for (`patternProperties`, `propertyNames`,
 * `minProperties`, lengths in code points, whole numbers of any size) is a
 * refinement. Throws on a keyword it does not know, so a new one cannot be
 * silently ignored.
 */

import { z } from "zod";

import { isPlainObject } from "../spec/guards";
import { codePoints, type JsonType, lookupRef, SCHEMA_KEYWORDS, type SchemaDef, type SchemaDefs } from "../spec/validate-schema";

const KNOWN: ReadonlySet<string> = new Set(SCHEMA_KEYWORDS);

type Path = (string | number)[];

function union(options: z.ZodType[]): z.ZodType {
  const [first, second, ...rest] = options;
  if (first === undefined) return z.never();
  if (second === undefined) return first;
  return z.union([first, second, ...rest]);
}

function allOf(parts: z.ZodType[]): z.ZodType {
  const [first, ...rest] = parts;
  if (first === undefined) return z.unknown();
  return rest.reduce<z.ZodType>((all, part) => z.intersection(all, part), first);
}

function relay(ctx: z.RefinementCtx, result: z.ZodSafeParseResult<unknown>, path: Path): void {
  if (result.success) return;
  for (const issue of result.error.issues) ctx.addIssue({ code: "custom", message: issue.message, path: [...path, ...(issue.path as Path)] });
}

export class ZodBuilder {
  private readonly built = new Map<string, z.ZodType>();
  private readonly patterns = new Map<string, RegExp>();

  constructor(private readonly defs: SchemaDefs) {}

  private regex(pattern: string): RegExp {
    let regex = this.patterns.get(pattern);
    if (regex === undefined) {
      regex = new RegExp(pattern, "u");
      this.patterns.set(pattern, regex);
    }
    return regex;
  }

  private ref(target: string): z.ZodType {
    const { name, def } = lookupRef(this.defs, target);
    let schema = this.built.get(name);
    if (schema === undefined) {
      // Registered before it is built, so a cycle meets the lazy wrapper instead of recursing.
      let inner: z.ZodType | undefined;
      schema = z.lazy(() => (inner ??= this.build(def)));
      this.built.set(name, schema);
    }
    return schema;
  }

  build(schema: SchemaDef): z.ZodType {
    for (const key of Object.keys(schema)) {
      if (!KNOWN.has(key)) throw new Error(`The Zod builder does not know the schema keyword ${key}.`);
    }
    if (schema.$ref !== undefined) return this.ref(schema.$ref);

    const parts: z.ZodType[] = [];
    if (typeof schema.type === "string") parts.push(this.typed(schema.type, schema));
    else {
      if (schema.type !== undefined) parts.push(union(schema.type.map((type) => this.typed(type, {}))));
      const loose = this.untyped(schema);
      if (loose !== undefined) parts.push(loose);
    }
    if (schema.const !== undefined) parts.push(z.literal(schema.const));
    if (schema.enum !== undefined) parts.push(union(schema.enum.map((value) => z.literal(value))));
    if (schema.anyOf !== undefined) parts.push(union(schema.anyOf.map((branch) => this.build(branch))));
    return allOf(parts);
  }

  /** A value of one JSON type with that type's keywords. */
  private typed(type: JsonType, schema: SchemaDef): z.ZodType {
    switch (type) {
      case "null":
        return z.null();
      case "boolean":
        return z.boolean();
      case "number":
      case "integer": {
        let number = z.number();
        if (schema.minimum !== undefined) number = number.min(schema.minimum);
        if (schema.maximum !== undefined) number = number.max(schema.maximum);
        return type === "integer" ? number.refine(Number.isInteger, "Expected a whole number") : number;
      }
      case "string": {
        let string = z.string();
        if (schema.pattern !== undefined) string = string.regex(this.regex(schema.pattern));
        const { minLength: min, maxLength: max } = schema;
        if (min === undefined && max === undefined) return string;
        return string.refine((text) => {
          const length = codePoints(text);
          return (min === undefined || length >= min) && (max === undefined || length <= max);
        }, `Between ${min ?? 0} and ${max ?? "any number of"} characters`);
      }
      case "array": {
        const array = z.array(schema.items === undefined ? z.unknown() : this.build(schema.items));
        return schema.minItems === undefined ? array : array.min(schema.minItems);
      }
      case "object":
        return this.object(schema);
    }
  }

  private object(schema: SchemaDef): z.ZodType {
    const required = new Set(schema.required ?? []);
    const shape: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      const built = this.build(value);
      shape[key] = required.has(key) ? built : built.optional();
    }
    for (const key of required) shape[key] ??= z.unknown().refine((value) => value !== undefined, `Missing ${key}`);

    const patterns = Object.entries(schema.patternProperties ?? {}).map(([pattern, value]) => [this.regex(pattern), this.build(value)] as const);
    const additional = schema.additionalProperties;
    let object: z.ZodType;
    // Keys beyond `properties` are checked here rather than by Zod's strict or
    // catchall objects, which would hold a key whose value is undefined to the
    // rule; the validator counts it absent, as JSON does.
    if (patterns.length === 0 && additional === undefined) {
      object = z.object(shape).catchall(z.unknown());
    } else {
      const rest = additional === undefined || additional === false ? additional : this.build(additional);
      object = z
        .object(shape)
        .catchall(z.unknown())
        .superRefine((value, ctx) => {
          for (const key of Object.keys(value)) {
            if (Object.hasOwn(shape, key) || value[key] === undefined) continue;
            const child = patterns.find(([pattern]) => pattern.test(key))?.[1] ?? rest;
            if (child === false) ctx.addIssue({ code: "custom", message: `Unknown key ${key}`, path: [key] });
            else if (child !== undefined) relay(ctx, child.safeParse(value[key]), [key]);
          }
        });
    }
    const keys = this.keyChecks(schema);
    return keys === undefined ? object : z.intersection(object, keys);
  }

  /** `propertyNames` and `minProperties`, which constrain an object's keys. */
  private keyChecks(schema: SchemaDef): z.ZodType | undefined {
    if (schema.propertyNames === undefined && schema.minProperties === undefined) return undefined;
    const names = schema.propertyNames === undefined ? undefined : this.build(schema.propertyNames);
    const min = schema.minProperties;
    return z.unknown().superRefine((value, ctx) => {
      if (!isPlainObject(value)) return;
      const keys = Object.keys(value).filter((key) => value[key] !== undefined);
      if (min !== undefined && keys.length < min) ctx.addIssue({ code: "custom", message: `At least ${min} keys` });
      if (names !== undefined) for (const key of keys) relay(ctx, names.safeParse(key), [key]);
    });
  }

  /** Keywords with no `type` beside them, which constrain only values of their own type. */
  private untyped(schema: SchemaDef): z.ZodType | undefined {
    const objectKeywords =
      schema.properties !== undefined ||
      schema.required !== undefined ||
      schema.additionalProperties !== undefined ||
      schema.patternProperties !== undefined;
    const other =
      schema.items !== undefined ||
      schema.minItems !== undefined ||
      schema.minLength !== undefined ||
      schema.maxLength !== undefined ||
      schema.pattern !== undefined ||
      schema.minimum !== undefined ||
      schema.maximum !== undefined;
    if (objectKeywords || other) throw new Error("The Zod builder takes value keywords only beside a `type`, or key checks alone.");
    return this.keyChecks(schema);
  }
}
