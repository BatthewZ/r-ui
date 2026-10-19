import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import BannerSection from "../sections/feedback/Banner";

const KEY = "r-ui-showcase:feedback-banner-maintenance";

afterEach(() => {
  localStorage.clear();
});

describe("the Banner demo's Restore", () => {
  it("brings back a banner dismissed for good and forgets its stored key", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BannerSection />);
    const maintenance = () => screen.queryByRole("region", { name: "Scheduled maintenance on Sunday" });
    await user.click(within(maintenance()!).getByRole("button", { name: "Dismiss" }));
    expect(maintenance()).toBeNull();
    expect(localStorage.getItem(KEY)).not.toBeNull();

    // Dismissed for good: a fresh mount (a reload) keeps it hidden.
    unmount();
    render(<BannerSection />);
    expect(maintenance()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Restore banners" }));
    expect(maintenance()).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
