// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createValidationHandler, type ValidationResponseBody } from "./handler";

const valid = JSON.stringify({ version: 2, title: "t", root: "Hello" });
const post = (body: BodyInit | null, headers: HeadersInit = {}) => new Request("https://app.example/validate", { method: "POST", body, headers });

async function json(response: Response): Promise<ValidationResponseBody> {
  expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  return (await response.json()) as ValidationResponseBody;
}

describe("createValidationHandler", () => {
  it("answers a POSTed document with ok, the issues and the producer's feedback, 200 either way", async () => {
    const handle = createValidationHandler();
    const good = await handle(post(valid));
    expect(good.status).toBe(200);
    expect(await json(good)).toEqual({ ok: true, renderable: true, issues: [], feedback: "The document is valid: no issues.", spec: JSON.parse(valid) });

    const fenced = await json(await handle(post(`\`\`\`json\n${valid}\n\`\`\``)));
    expect(fenced.spec).toEqual(JSON.parse(valid));

    const bad = await handle(post('{"version": 2}'));
    expect(bad.status).toBe(200);
    const body = await json(bad);
    expect(body).toMatchObject({ ok: false, renderable: false });
    expect(body).not.toHaveProperty("spec");
    expect(body.issues.map((issue) => [issue.code, issue.path])).toEqual([["missing-key", ""], ["missing-key", ""]]);
    expect(body.feedback.split("\n")[0]).toBe("The document is not valid: 2 errors, 0 warnings. Fix each one and send the whole document again.");
  });

  it("passes the validation options through: the host's policy, strict", async () => {
    const doc = JSON.stringify({ version: 2, title: "t", root: { component: "Card", props: { className: "p-4" } } });
    expect((await json(await createValidationHandler()(post(doc)))).issues.map((issue) => issue.code)).toEqual(["unknown-class"]);
    expect((await json(await createValidationHandler({ classes: false })(post(doc)))).issues).toEqual([]);
    expect(await json(await createValidationHandler({ strict: true })(post(doc)))).toMatchObject({ ok: false, renderable: true });

    const secret = JSON.stringify({ version: 2, title: "t", root: { component: "PasswordInput" } });
    expect((await json(await createValidationHandler()(post(secret)))).renderable).toBe(false);
    const allowed = await json(await createValidationHandler({ policy: { allowSensitive: ["PasswordInput"] } })(post(secret)));
    expect(allowed).toMatchObject({ ok: true, renderable: true, issues: [] });
  });

  it("refuses other methods with 405 and an Allow header", async () => {
    const response = await createValidationHandler()(new Request("https://app.example/validate"));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("refuses a body past maxBytes with 413, by its declared length or by what arrives", async () => {
    const handle = createValidationHandler({ maxBytes: 64 });
    expect((await handle(post(valid))).status).toBe(200);
    expect((await handle(post("x".repeat(65)))).status).toBe(413);
    // Two-byte characters: 40 characters, 80 bytes.
    expect((await handle(post("é".repeat(40)))).status).toBe(413);
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(32));
      },
    });
    const streamed = new Request("https://app.example/validate", { method: "POST", body: endless, duplex: "half" } as RequestInit);
    expect((await handle(streamed)).status).toBe(413);
    expect(pulled).toBeLessThan(10);
  });

  it("validates an empty body as an empty document", async () => {
    const body = await json(await createValidationHandler()(post(null)));
    expect(body.issues.map((issue) => issue.code)).toEqual(["invalid-json"]);
  });
});
