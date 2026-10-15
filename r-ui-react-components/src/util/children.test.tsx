import { describe, expect, it } from "vitest";

import { elementChildren } from "./children";

function Part({ label }: { label: string }) {
  return <span>{label}</span>;
}
function Other() {
  return null;
}

const labels = (els: ReturnType<typeof elementChildren<{ label: string }>>) => els.map((e) => e.props.label);

describe("elementChildren", () => {
  it("drops text, numbers and holes, keeping elements in order", () => {
    const els = elementChildren<{ label: string }>(
      <>
        text
        {0}
        {null}
        {false}
        {undefined}
        <Part label="a" />
        {"more"}
        <Part label="b" />
      </>,
    );
    expect(labels(els)).toEqual(["a", "b"]);
  });

  it("flattens fragments, nested ones included, with keys that never collide", () => {
    const els = elementChildren<{ label: string }>(
      <>
        <Part label="a" />
        <>
          <Part label="b" />
          <>
            <Part label="c" />
          </>
        </>
        <>
          <Part label="d" />
        </>
      </>,
    );
    expect(labels(els)).toEqual(["a", "b", "c", "d"]);
    const keys = els.map((e) => e.key);
    expect(new Set(keys).size).toBe(4);
  });

  it("keeps only the given component type when one is passed", () => {
    const els = elementChildren(
      [<Part key="1" label="a" />, <Other key="2" />, <div key="3" />, <Part key="4" label="b" />],
      Part,
    );
    expect(labels(els)).toEqual(["a", "b"]);
  });
});
