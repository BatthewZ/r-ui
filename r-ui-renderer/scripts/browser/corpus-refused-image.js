// @covers media, corpus
// @cost   6
//
// Browser check: an image the host's policy refuses is never requested, and
// shows the Image's fallback instead of an empty or broken box.
//
// On the control document `refused-image` (two photos: one under the
// playground's image path, one from `images.example`, which its policy refuses):
//   1. no request goes to `images.example`, while the page loads or after;
//   2. the refused photo's box is in its error state and shows the fallback,
//      still named by its `alt`, with no `<img>` inside;
//   3. the allowed photo loads, so the policy refused one image, not every image;
//   4. the page shows exactly the diagnostics the document declares (the refusal).
async (page) => {
  const problems = [];
  const NAME = "refused-image";
  const refused = collectRequests(page, "images.example");
  try {
    await openView(page, NAME);
    // 3. the allowed photo loads
    const loaded = await page
      .waitForFunction(
        (alt) => document.querySelector(`img[alt="${CSS.escape(alt)}"]`)?.closest("[data-state]")?.getAttribute("data-state") === "loaded",
        "The Rotterdam cross-dock at first light",
        { timeout: 5_000 },
      )
      .then(
        () => true,
        () => false,
      );
    if (!loaded) problems.push("the allowed photo never loaded");

    // 2. the fallback, named, with nothing requested in it
    const fallback = await page.getByRole("img", { name: "The Porto site from the yard gate" }).evaluate((element) => {
      const box = element.closest("[data-state]");
      const rect = element.getBoundingClientRect();
      return { state: box?.getAttribute("data-state") ?? null, images: box?.querySelectorAll("img").length ?? -1, shown: rect.width > 0 && rect.height > 0 };
    });
    if (fallback.state !== "error") problems.push(`the refused photo's box is in state ${JSON.stringify(fallback.state)}, not "error"`);
    if (fallback.images !== 0) problems.push(`the refused photo's box holds ${fallback.images} <img> element(s)`);
    if (!fallback.shown) problems.push("the refused photo's fallback has no size");

    await frames(page);
    // 1. never requested
    if (refused.urls.length > 0) problems.push(`the refused host was requested: ${refused.urls.join(", ")}`);
  } finally {
    refused.stop();
  }

  // 4.
  const found = (await diagnostics(page)).map((d) => d.code);
  if (JSON.stringify(found) !== JSON.stringify(CORPUS.controls[NAME])) {
    problems.push(`diagnostics ${JSON.stringify(found)}, the document declares ${JSON.stringify(CORPUS.controls[NAME])}`);
  }
  return report(problems, "the refused photo shows its fallback and was never requested; the allowed one loaded");
};
