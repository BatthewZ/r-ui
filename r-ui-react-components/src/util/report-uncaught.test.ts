import { afterEach, describe, expect, it, vi } from "vitest";

import { reportUncaught } from "./report-uncaught";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reportUncaught", () => {
  it("hands the error to the global handler once, not to the console", () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("background check failed");
    reportUncaught(error);
    expect(reportError.mock.calls).toEqual([[error]]);
    expect(log).toHaveBeenCalledTimes(0);
  });

  it("logs it where there is no global handler", () => {
    vi.stubGlobal("reportError", undefined);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("native submit failed");
    reportUncaught(error);
    expect(log.mock.calls).toEqual([[error]]);
  });
});
