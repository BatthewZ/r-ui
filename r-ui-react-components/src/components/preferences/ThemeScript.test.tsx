import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { themeScript } from "../../util/preferences";
import { ThemeScript } from "./ThemeScript";

const html = document.documentElement;

beforeEach(() => {
  html.removeAttribute("data-theme");
  localStorage.clear();
});

describe("ThemeScript", () => {
  it("server-renders an inline script whose body is themeScript(), unescaped and runnable", () => {
    const markup = renderToStaticMarkup(<ThemeScript themes={["default", "aurora"]} storageKey="app:view" nonce="n0nce" />);
    const body = themeScript({ themes: ["default", "aurora"], storageKey: "app:view" });
    expect(markup).toBe(`<script nonce="n0nce">${body}</script>`);

    localStorage.setItem("app:view", JSON.stringify({ theme: "aurora" }));
    new Function(body)();
    expect(html.getAttribute("data-theme")).toBe("aurora");
  });
});
