import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Issue } from "../spec/types";
import { createIssueChannel } from "./issues";
import { setAtPath, useViewState } from "./state";

describe("setAtPath", () => {
  it("creates missing objects on the way and never mutates", () => {
    const state = Object.freeze({ page: 1 });
    expect(setAtPath(state, ["filters", "region"], "eu")).toEqual({ page: 1, filters: { region: "eu" } });
    expect(state).toEqual({ page: 1 });
  });

  it("merges plain objects shallowly and replaces everything else", () => {
    const state = { filters: { region: "eu", tier: "gold" }, tags: ["a"] };
    expect(setAtPath(state, ["filters"], { tier: "silver" })).toEqual({ filters: { region: "eu", tier: "silver" }, tags: ["a"] });
    expect(setAtPath(state, ["filters"], null)).toEqual({ filters: null, tags: ["a"] });
    expect(setAtPath(state, ["tags"], ["b"])).toEqual({ filters: { region: "eu", tier: "gold" }, tags: ["b"] });
    expect(setAtPath(state, ["filters"], { tier: "silver" }, { replace: true })).toEqual({ filters: { tier: "silver" }, tags: ["a"] });
  });

  it("writes array positions and replaces a scalar in the way with an object", () => {
    expect(setAtPath({ rows: ["a", "b"] }, ["rows", "1"], "c")).toEqual({ rows: ["a", "c"] });
    expect(setAtPath({ count: 3 }, ["count", "x"], 1)).toEqual({ count: { x: 1 } });
  });

  it("never writes through a prototype", () => {
    const next = setAtPath({}, ["toString", "x"], 1);
    expect(Object.hasOwn(next, "toString")).toBe(true);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe("useViewState", () => {
  it("seeds once the object has closed, never again, and refuses non-state paths", () => {
    const { result, rerender } = renderHook(({ seed }: { seed: unknown }) => useViewState(seed), {
      initialProps: { seed: undefined as unknown },
    });
    expect(result.current.state).toEqual({});
    rerender({ seed: { page: 1 } });
    expect(result.current.state).toEqual({ page: 1 });

    let accepted = false;
    act(() => {
      accepted = result.current.setState("state.page", 2);
    });
    expect(accepted).toBe(true);
    expect(result.current.getState()).toEqual({ page: 2 });

    rerender({ seed: { page: 9 } });
    expect(result.current.state).toEqual({ page: 2 });
    expect(result.current.setState("data.page", 3)).toBe(false);
    expect(result.current.setState("state", 3)).toBe(false);
    expect(result.current.setState("state.__proto__.x", 3)).toBe(false);
  });

  it("makes a write visible to the next read at once (before any re-render)", () => {
    const { result } = renderHook(() => useViewState({}));
    const view = result.current;
    act(() => {
      view.setState("state.a", 1);
      expect(view.getState()).toEqual({ a: 1 });
    });
  });
});

const issue = (code: Issue["code"], path: string): Issue => ({ code, path, severity: "warning", message: code });

describe("createIssueChannel", () => {
  it("delivers each code+path once, after the current task, and logs only issues without an element", async () => {
    const onIssue = vi.fn();
    const channel = createIssueChannel(onIssue);
    const listener = vi.fn();
    channel.subscribe(listener);

    channel.report(issue("unknown-icon", "/root/0"), { inPlace: true });
    channel.report(issue("data-error", "/data/a"));
    channel.report(issue("data-error", "/data/a"));
    expect(onIssue).toHaveBeenCalledTimes(0);
    expect(channel.getSnapshot()).toEqual([]);

    await Promise.resolve();
    expect(onIssue).toHaveBeenCalledTimes(2);
    expect(channel.getSnapshot().map((entry) => [entry.code, entry.path])).toEqual([["data-error", "/data/a"]]);
    expect(listener).toHaveBeenCalledTimes(1);

    const before = channel.getSnapshot();
    channel.report(issue("data-error", "/data/a"));
    await Promise.resolve();
    expect(channel.getSnapshot()).toBe(before);
    expect(onIssue).toHaveBeenCalledTimes(2);
  });
});
