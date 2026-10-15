import { Avatar } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Avatar",
  group: "primitives",
  order: 70,
  description:
    "Image with an initials fallback (missing, broken or refused URL). Sizes come from the control and icon tokens, so they follow density; initials scale with the box.",
};

// A tiny inline PNG portrait, so the demo needs no network. (An SVG data URL
// would be refused by safeUrl: SVG can carry script.)
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAABaklEQVR42u3U2U7CYBCG4e/SPPYavJvurQmCiKKIIBRK3XdxwX25LE3+hjQpLZ0J0DExeY6/eY8G3+GqKPgaeKLgM/BEwUfgiYL3vicK3nquKPKCXn1XFLz4rih47rqi4KnjiIJRx2FbWV5Kw97EaN/hyaiJmlizeGw7DFNrFMYyHtoOVc4ahTqO+5ZNQqpRSPu4a9kkjCDSPoZ7NgkjiLSPYdMm4QRR9nHbtEkYQaR93OxaJIwg0j6uGxYJI4i0j6uGRcIIIu3jcsciYQSR9slB1CbqOC62TYacNYxlnNdNnqk1vFmc1U22jBr2Jk63TFFwsmmIIi/ouGaIgqOaIQoON4w8GA86Kc8hHFT1bDNJics+h7CqZ5h5jZJxEeG6nmZONVFTylEMKvpEc61RJt5FUNGTFlCjJE+jX9biFpYSFw9Ar6yNFVKjjBvgr2lKgTWKyoBf0n4VXhM1lTR0xdQoEFXzH/QXg34AOrexHWhowWAAAAAASUVORK5CYII=";

export default function AvatarSection() {
  return (
    <Stack>
      <Row label="Image · initials · single name · no name (decorative) · broken image · refused scheme">
        <div className="flex flex-wrap items-center gap-r4">
          <Avatar src={PHOTO} name="Ada Lovelace" />
          <Avatar name="Grace Hopper" />
          <Avatar name="Plato" />
          <Avatar />
          {/* Undecodable bytes: fails like a 404 without a network error in the console. */}
          <Avatar src="data:image/png;base64,AAAA" name="Broken Image" />
          <Avatar src="javascript:alert(1)" name="Mallory Refused" />
        </div>
      </Row>

      <Row label="Icon size, inline in text and in a dense row · compact density · custom size via className">
        <div className="grid gap-r4">
          <p className="text-body-1">
            Assigned to <Avatar size="icon" name="Grace Hopper" alt="" /> Grace Hopper and{" "}
            <Avatar size="icon" src={PHOTO} name="Ada Lovelace" alt="" /> Ada Lovelace.
          </p>
          <div data-density="compact" className="flex items-center gap-r4">
            <Avatar name="Compact Person" />
            <Avatar size="icon" name="Compact Person" />
            <span className="text-body-2">compact</span>
          </div>
          <div className="flex items-center gap-r4">
            <Avatar name="Large Profile" className="size-chart" />
            <Avatar name="Row Height" className="size-row" />
          </div>
        </div>
      </Row>
    </Stack>
  );
}
