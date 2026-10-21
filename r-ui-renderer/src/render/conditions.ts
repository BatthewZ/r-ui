/** `$cond` conditions: truthiness, `not`, and one comparison against a value or a `$ref`. */

import { isPlainObject, isRefMarker } from "../spec/guards";
import { COMPARISON_OPERATORS, type ComparisonOperator } from "../spec/types";
import { readValue } from "../runtime/resolve";

/** Missing, `null`, `false`, `0`, `NaN`, `""` and an empty array are false; everything else, `{}` included, true. */
function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/** Strict equality, deep through arrays and plain objects (own keys). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

function compare(operator: ComparisonOperator, left: unknown, right: unknown): boolean {
  switch (operator) {
    case "eq":
      return deepEqual(left, right);
    case "ne":
      return !deepEqual(left, right);
    case "gt":
    case "lt": {
      const comparable =
        (typeof left === "number" && typeof right === "number") || (typeof left === "string" && typeof right === "string");
      if (!comparable) return false;
      return operator === "gt" ? left > right : left < right;
    }
    case "in":
      return Array.isArray(right) && right.some((item: unknown) => deepEqual(left, item));
  }
}

/** Whether `condition` holds in `scope`. A malformed condition holds nowhere. */
export function evaluateCondition(condition: unknown, scope: Readonly<Record<string, unknown>>): boolean {
  if (typeof condition === "string") return isTruthy(readValue(condition, scope));
  if (!isPlainObject(condition)) return false;
  const keys = Object.keys(condition);
  if (keys.length === 1 && keys[0] === "not") return !evaluateCondition(condition.not, scope);
  if (typeof condition.ref !== "string" || keys.length !== 2) return false;
  const operator = COMPARISON_OPERATORS.find((name) => Object.hasOwn(condition, name));
  if (operator === undefined) return false;
  const operand = condition[operator];
  const right = isRefMarker(operand) ? readValue(operand.$ref, scope) : operand;
  return compare(operator, readValue(condition.ref, scope), right);
}
