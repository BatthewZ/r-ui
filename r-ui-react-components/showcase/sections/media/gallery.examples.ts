// The media demos' photographs: data, not styling. Each one carries the colour a
// build step would pick as its dominant colour and a tiny blurred-up preview (an
// 8px-wide SVG of the same scene), the way a CMS or an image pipeline hands them
// over. A consumer's data, so the token gates skip this file (see AGENTS.md).
// `?no-inline`: real files, never data URIs, so a replay can add a query to the
// address and a browser check can hold the responses back.
import type { LightboxItem } from "../../../src";
import canyon from "./art/canyon.svg?no-inline";
import cliffs from "./art/cliffs.svg?no-inline";
import dunes from "./art/dunes.svg?no-inline";
import fjord from "./art/fjord.svg?no-inline";
import glacier from "./art/glacier.svg?no-inline";
import lake from "./art/lake.svg?no-inline";
import lavender from "./art/lavender.svg?no-inline";
import meadow from "./art/meadow.svg?no-inline";
import pines from "./art/pines.svg?no-inline";
import road from "./art/road.svg?no-inline";
import salt from "./art/salt.svg?no-inline";
import terraces from "./art/terraces.svg?no-inline";

export interface Photo {
  id: string;
  title: string;
  caption: string;
  src: string;
  width: number;
  height: number;
  /** The dominant colour, as an image pipeline would report it. */
  color: string;
  /** A tiny preview, scaled up and blurred while the photo loads. */
  placeholder: string;
}

export const PHOTOS: readonly Photo[] = [
  {
    id: "dunes",
    title: "Dunes at first light",
    caption: "Wind sorts the sand by grain: the crests are finest.",
    src: dunes,
    width: 1600,
    height: 1000,
    color: "#c9804f",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%205%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%225%22%20fill%3D%22%23f3b48a%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%222.00%22%20fill%3D%22%23f6d6b8%22%2F%3E%3Crect%20y%3D%222.90%22%20width%3D%228%22%20height%3D%222.10%22%20fill%3D%22%23e2a072%22%2F%3E%3Crect%20y%3D%223.60%22%20width%3D%228%22%20height%3D%221.40%22%20fill%3D%22%23c9804f%22%2F%3E%3Crect%20y%3D%224.30%22%20width%3D%228%22%20height%3D%220.70%22%20fill%3D%22%23a8623a%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "fjord",
    title: "Fjord, late afternoon",
    caption: "The water stays glass-still for an hour after the ferry.",
    src: fjord,
    width: 1000,
    height: 1500,
    color: "#4e6d87",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%2012%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%2212%22%20fill%3D%22%239fbfd8%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%224.80%22%20fill%3D%22%23cfe0ee%22%2F%3E%3Crect%20y%3D%226.96%22%20width%3D%228%22%20height%3D%225.04%22%20fill%3D%22%236f8ea8%22%2F%3E%3Crect%20y%3D%228.64%22%20width%3D%228%22%20height%3D%223.36%22%20fill%3D%22%234e6d87%22%2F%3E%3Crect%20y%3D%2210.32%22%20width%3D%228%22%20height%3D%221.68%22%20fill%3D%22%232f4a61%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "salt",
    title: "Salt flats",
    caption: "Twelve kilometres of crust, and no horizon to speak of.",
    src: salt,
    width: 1500,
    height: 1500,
    color: "#bcc5cc",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%208%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23dfe5ea%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%223.20%22%20fill%3D%22%23eef1f4%22%2F%3E%3Crect%20y%3D%224.64%22%20width%3D%228%22%20height%3D%223.36%22%20fill%3D%22%23cfd6dc%22%2F%3E%3Crect%20y%3D%225.76%22%20width%3D%228%22%20height%3D%222.24%22%20fill%3D%22%23bcc5cc%22%2F%3E%3Crect%20y%3D%226.88%22%20width%3D%228%22%20height%3D%221.12%22%20fill%3D%22%23e8ecef%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "pines",
    title: "Pine ridge in fog",
    caption: "Fog pools in the valley until about ten.",
    src: pines,
    width: 1200,
    height: 1600,
    color: "#6b8170",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%2011%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%2211%22%20fill%3D%22%23c4cdc6%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%224.40%22%20fill%3D%22%23dfe4e0%22%2F%3E%3Crect%20y%3D%226.38%22%20width%3D%228%22%20height%3D%224.62%22%20fill%3D%22%2397a89a%22%2F%3E%3Crect%20y%3D%227.92%22%20width%3D%228%22%20height%3D%223.08%22%20fill%3D%22%236b8170%22%2F%3E%3Crect%20y%3D%229.46%22%20width%3D%228%22%20height%3D%221.54%22%20fill%3D%22%233f5646%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "cliffs",
    title: "Coastal cliffs",
    caption: "The path keeps three metres from the edge, mostly.",
    src: cliffs,
    width: 1800,
    height: 900,
    color: "#3f7f78",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%204%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%224%22%20fill%3D%22%23a8d3cf%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%221.60%22%20fill%3D%22%23d5ece9%22%2F%3E%3Crect%20y%3D%222.32%22%20width%3D%228%22%20height%3D%221.68%22%20fill%3D%22%235fa49d%22%2F%3E%3Crect%20y%3D%222.88%22%20width%3D%228%22%20height%3D%221.12%22%20fill%3D%22%233f7f78%22%2F%3E%3Crect%20y%3D%223.44%22%20width%3D%228%22%20height%3D%220.56%22%20fill%3D%22%232a5c57%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "lavender",
    title: "Lavender rows",
    caption: "Harvest starts in July; the rows are cut by hand at the ends.",
    src: lavender,
    width: 1200,
    height: 900,
    color: "#8467a8",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%206%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%226%22%20fill%3D%22%23d7c6e4%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%222.40%22%20fill%3D%22%23ece3f1%22%2F%3E%3Crect%20y%3D%223.48%22%20width%3D%228%22%20height%3D%222.52%22%20fill%3D%22%23a68cc4%22%2F%3E%3Crect%20y%3D%224.32%22%20width%3D%228%22%20height%3D%221.68%22%20fill%3D%22%238467a8%22%2F%3E%3Crect%20y%3D%225.16%22%20width%3D%228%22%20height%3D%220.84%22%20fill%3D%22%235f4683%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "canyon",
    title: "Canyon bend",
    caption: "The river took six million years over this bend.",
    src: canyon,
    width: 900,
    height: 1350,
    color: "#a95a2f",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%2012%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%2212%22%20fill%3D%22%23eab48c%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%224.80%22%20fill%3D%22%23f4dcc4%22%2F%3E%3Crect%20y%3D%226.96%22%20width%3D%228%22%20height%3D%225.04%22%20fill%3D%22%23cf7a46%22%2F%3E%3Crect%20y%3D%228.64%22%20width%3D%228%22%20height%3D%223.36%22%20fill%3D%22%23a95a2f%22%2F%3E%3Crect%20y%3D%2210.32%22%20width%3D%228%22%20height%3D%221.68%22%20fill%3D%22%237c3d1d%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "lake",
    title: "Night over the lake",
    caption: "A long exposure: the moon moved half its width.",
    src: lake,
    width: 1600,
    height: 900,
    color: "#1d2740",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%205%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%225%22%20fill%3D%22%233a4a6b%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%222.00%22%20fill%3D%22%231f2a44%22%2F%3E%3Crect%20y%3D%222.90%22%20width%3D%228%22%20height%3D%222.10%22%20fill%3D%22%232b3756%22%2F%3E%3Crect%20y%3D%223.60%22%20width%3D%228%22%20height%3D%221.40%22%20fill%3D%22%231d2740%22%2F%3E%3Crect%20y%3D%224.30%22%20width%3D%228%22%20height%3D%220.70%22%20fill%3D%22%23121a2e%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "meadow",
    title: "Meadow after rain",
    caption: "Taken from the stile at the top of the lane.",
    src: meadow,
    width: 1000,
    height: 1250,
    color: "#6a9a52",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%2010%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%2210%22%20fill%3D%22%23c7ddb9%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%224.00%22%20fill%3D%22%23e3eedc%22%2F%3E%3Crect%20y%3D%225.80%22%20width%3D%228%22%20height%3D%224.20%22%20fill%3D%22%238fb874%22%2F%3E%3Crect%20y%3D%227.20%22%20width%3D%228%22%20height%3D%222.80%22%20fill%3D%22%236a9a52%22%2F%3E%3Crect%20y%3D%228.60%22%20width%3D%228%22%20height%3D%221.40%22%20fill%3D%22%234a7638%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "glacier",
    title: "Glacier tongue",
    caption: "The tongue has retreated four hundred metres since 1990.",
    src: glacier,
    width: 1400,
    height: 1000,
    color: "#8fb4cc",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%206%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%226%22%20fill%3D%22%23c6dcea%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%222.40%22%20fill%3D%22%23e6f0f6%22%2F%3E%3Crect%20y%3D%223.48%22%20width%3D%228%22%20height%3D%222.52%22%20fill%3D%22%23b3cfe0%22%2F%3E%3Crect%20y%3D%224.32%22%20width%3D%228%22%20height%3D%221.68%22%20fill%3D%22%238fb4cc%22%2F%3E%3Crect%20y%3D%225.16%22%20width%3D%228%22%20height%3D%220.84%22%20fill%3D%22%23e9f2f7%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "road",
    title: "Desert road",
    caption: "Forty kilometres without a turn.",
    src: road,
    width: 1200,
    height: 1800,
    color: "#b8935e",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%2012%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%2212%22%20fill%3D%22%23e8cfa3%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%224.80%22%20fill%3D%22%23f3e6cf%22%2F%3E%3Crect%20y%3D%226.96%22%20width%3D%228%22%20height%3D%225.04%22%20fill%3D%22%23d4b07c%22%2F%3E%3Crect%20y%3D%228.64%22%20width%3D%228%22%20height%3D%223.36%22%20fill%3D%22%23b8935e%22%2F%3E%3Crect%20y%3D%2210.32%22%20width%3D%228%22%20height%3D%221.68%22%20fill%3D%22%238e6c40%22%2F%3E%3C%2Fsvg%3E",
  },
  {
    id: "terraces",
    title: "Rice terraces",
    caption: "Each step is levelled by eye and kept by the season.",
    src: terraces,
    width: 1500,
    height: 1000,
    color: "#86a456",
    placeholder:
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%205%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%228%22%20height%3D%225%22%20fill%3D%22%23d2deb5%22%2F%3E%3Crect%20width%3D%228%22%20height%3D%222.00%22%20fill%3D%22%23e9efd9%22%2F%3E%3Crect%20y%3D%222.90%22%20width%3D%228%22%20height%3D%222.10%22%20fill%3D%22%23a9c27a%22%2F%3E%3Crect%20y%3D%223.60%22%20width%3D%228%22%20height%3D%221.40%22%20fill%3D%22%2386a456%22%2F%3E%3Crect%20y%3D%224.30%22%20width%3D%228%22%20height%3D%220.70%22%20fill%3D%22%2362803a%22%2F%3E%3C%2Fsvg%3E",
  },
];

/** The photographs as a Lightbox's items: the full file, its preview and colour, a caption. */
export const LIGHTBOX_ITEMS: readonly LightboxItem[] = PHOTOS.map((p) => ({
  id: p.id,
  src: p.src,
  alt: p.title,
  width: p.width,
  height: p.height,
  placeholder: p.placeholder,
  placeholderColor: p.color,
  caption: p.caption,
}));
