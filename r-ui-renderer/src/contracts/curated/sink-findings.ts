/**
 * Every place in the library's source where a value can become a URL
 * attribute, a heading element or a read of a parent's children, and what the
 * renderer does about it. The keys are what the omission scan prints
 * (`<file> <kind> <code>`, or `<file> children` for a file that reads its
 * children); a finding the scan makes that this table does not hold fails, and
 * so does an entry the scan no longer finds.
 *
 * A classification says who can reach the sink:
 * - `{ component, prop }`: that document prop of an addressable component.
 *   For a URL the contracts must route it through the URL rules (or drop it);
 *   for a heading, bound its levels (or drop it); for a children read, the
 *   prop that opts into it (`asChild`) must be dropped.
 * - `{ component }` (children only): that component's contract declares
 *   `childInspection`.
 * - `{ excluded }`: only a not-addressable component reaches it.
 * - `{ library }`: the library builds the value itself; why.
 */

import type { PropPath } from "../../spec/types";

export type SinkClassification =
  | { readonly component: string; readonly prop?: PropPath }
  | { readonly excluded: string }
  | { readonly library: string };

const ASCHILD_TRIGGERS = [
  "Popover.Trigger",
  "Popover.Close",
  "Dialog.Trigger",
  "Dialog.Close",
  "Drawer.Trigger",
  "Drawer.Close",
  "DropdownMenu.Trigger",
].map((component) => ({ component, prop: "asChild" }));

export const SINK_FINDINGS: { readonly [finding: string]: readonly SinkClassification[] } = {
  // URLs
  "components/content/Markdown.tsx url href={href}": [{ library: "Markdown's default link renders a Link, which judges the parsed target with safeUrl." }],
  "components/content/Markdown.tsx url href={node.href}": [{ library: "A parsed Markdown link, rendered through the Link that judges it." }],
  // Markdown images load only under the host's allowlist, which a document cannot set.
  "components/content/Markdown.tsx url src={node.src}": [{ component: "Markdown", prop: "imageAllowlist" }],
  "components/content/Markdown.tsx url src={src}": [{ component: "Markdown", prop: "imageAllowlist" }],
  "components/data/Timeline.tsx url src={actor.avatar}": [{ component: "Timeline", prop: "events[].actor.avatar" }],
  "components/data/Timeline.tsx url src={who.avatar}": [{ component: "ActivityFeed", prop: "items[].actor.avatar" }],
  "components/form/AvatarUpload.tsx url src={ownUrl}": [{ excluded: "AvatarUpload" }],
  "components/form/AvatarUpload.tsx url src={phase.url}": [{ excluded: "AvatarUpload" }],
  "components/form/AvatarUpload.tsx url src={valueSrc}": [{ excluded: "AvatarUpload" }],
  'components/form/ErrorSummary.tsx url href={element.id ? `#${element.id}` : "#"}': [
    { library: "A fragment link to a field the form registered." },
  ],
  "components/form/FileUpload.tsx url src={preview}": [{ excluded: "FileUpload" }],
  "components/guards/RequireAuth.tsx url href={signInHref}": [{ excluded: "RequireAuth" }],
  "components/marketing/FeatureGrid.tsx url href={safeHref}": [{ component: "FeatureGrid.Item", prop: "href" }],
  "components/marketing/MediaCard.tsx url href={safeHref}": [{ component: "MediaCard", prop: "href" }],
  "components/marketing/NavigationMenu.tsx url href={item.href}": [{ excluded: "NavigationMenu" }],
  "components/marketing/NavigationMenu.tsx url href={link.href}": [{ excluded: "NavigationMenu" }],
  "components/marketing/SiteHeader.tsx url href={skipTo}": [{ excluded: "SiteHeader" }],
  "components/marketing/Testimonial.tsx url cite={typeof sourceUrl === \"string\" ? safeUrl(sourceUrl) || undefined : undefined}": [
    { component: "Testimonial", prop: "sourceUrl" },
  ],
  "components/marketing/Testimonial.tsx url src={avatar}": [{ component: "Testimonial", prop: "avatar" }],
  "components/media/Image.tsx url src={placeholder}": [
    { component: "Image", prop: "placeholder" },
    { component: "MediaCard", prop: "image.placeholder" },
    { component: "Lightbox", prop: "items[].placeholder" },
  ],
  "components/media/Image.tsx url src={address}": [
    { component: "Image", prop: "src" },
    { component: "MediaCard", prop: "image.src" },
    { component: "Lightbox", prop: "items[].src" },
  ],
  "components/media/Image.tsx url srcSet={srcSet}": [
    { component: "Image", prop: "srcSet" },
    { component: "MediaCard", prop: "image.srcSet" },
    { component: "Lightbox", prop: "items[].srcSet" },
  ],
  'components/media/Lightbox.tsx url preload(near.src, { as: "image", imageSrcSet: near.srcSet, imageSizes: near.sizes, fetchPriority: "low" })':
    [
      { component: "Lightbox", prop: "items[].src" },
      { component: "Lightbox", prop: "items[].srcSet" },
    ],
  "components/media/Lightbox.tsx url src={item.src}": [{ component: "Lightbox", prop: "items[].src" }],
  "components/media/Lightbox.tsx url srcSet={item.srcSet}": [{ component: "Lightbox", prop: "items[].srcSet" }],
  "components/navigation/AppShell.tsx url href={`#${mainId}`}": [{ excluded: "AppShell" }],
  "components/navigation/Breadcrumbs.tsx url href": [{ component: "Breadcrumbs.Item", prop: "href" }],
  "components/navigation/NavLink.tsx url href": [{ component: "NavList.Item", prop: "href" }, { excluded: "AppShell.NavItem" }],
  // `getHref` is a function, so a document cannot set it and Pagination stays in button mode.
  "components/navigation/Pagination.tsx url href={getHref(slot)}": [{ component: "Pagination", prop: "getHref" }],
  "components/navigation/Pagination.tsx url href={getHref(target)}": [{ component: "Pagination", prop: "getHref" }],
  "components/navigation/TreeView.tsx url href={href}": [{ component: "TreeView", prop: "items[].href" }],
  "components/primitives/Avatar.tsx url src={url}": [{ component: "Avatar", prop: "src" }],
  "components/primitives/AvatarGroup.tsx url src={item.src}": [{ component: "AvatarGroup", prop: "items[].src" }],
  "components/primitives/Link.tsx url href: safeHref": [{ component: "Link", prop: "href" }],
  "components/steps/Stepper.tsx url href: safeHref": [{ component: "Stepper.Step", prop: "href" }],

  // Heading levels
  "components/data/EmptyState.tsx heading `h${headingLevel}`": [{ component: "EmptyState", prop: "headingLevel" }],
  "components/data/Timeline.tsx heading `h${headingLevel}`": [
    { component: "Timeline", prop: "headingLevel" },
    { component: "ActivityFeed", prop: "headingLevel" },
  ],
  "components/disclosure/Accordion.tsx heading `h${headingLevel}`": [{ component: "Accordion", prop: "headingLevel" }],
  "components/marketing/CallToAction.tsx heading `h${headingLevel}`": [{ component: "CallToAction", prop: "headingLevel" }],
  "components/marketing/FeatureGrid.tsx heading `h${headingLevel}`": [{ component: "FeatureGrid", prop: "headingLevel" }],
  "components/marketing/FeatureRows.tsx heading `h${context.headingLevel}`": [{ component: "FeatureRows", prop: "headingLevel" }],
  "components/marketing/Footer.tsx heading `h${level}`": [{ excluded: "Footer" }],
  "components/marketing/Hero.tsx heading `h${headingLevel}`": [{ component: "Hero", prop: "headingLevel" }],
  "components/marketing/HowItWorks.tsx heading `h${headingLevel}`": [{ component: "HowItWorks", prop: "headingLevel" }],
  "components/marketing/Pricing.tsx heading `h${headingLevel}`": [{ component: "Pricing", prop: "headingLevel" }],
  "components/marketing/SectionHeading.tsx heading `h${headingLevel}`": [{ component: "SectionHeading", prop: "headingLevel" }],
  "components/steps/Wizard.tsx heading `h${headingLevel}`": [{ component: "Wizard", prop: "headingLevel" }],

  // Reads of a parent's children
  "components/layout/Splitter.tsx children": [{ excluded: "Splitter" }],
  "components/marketing/Carousel.tsx children": [{ component: "Carousel" }],
  "components/marketing/FeatureRows.tsx children": [{ component: "FeatureRows" }],
  "components/marketing/Footer.tsx children": [{ excluded: "Footer" }],
  "components/marketing/HowItWorks.tsx children": [{ component: "HowItWorks" }],
  "components/marketing/LogoCloud.tsx children": [{ component: "LogoCloud" }],
  "components/media/Lightbox.tsx children": [{ component: "Lightbox.Trigger", prop: "asChild" }],
  "components/motion/Stagger.tsx children": [{ component: "Stagger" }],
  "components/navigation/Breadcrumbs.tsx children": [{ component: "Breadcrumbs" }],
  // TreeView keeps only `TreeView.Item` children, which no document can write; it takes `items`.
  "components/navigation/TreeView.tsx children": [{ excluded: "TreeView.Item" }],
  "components/overlays/HoverCard.tsx children": [{ component: "HoverCard.Trigger" }],
  "components/overlays/Tooltip.tsx children": [{ component: "Tooltip" }],
  "components/overlays/internal.tsx children": ASCHILD_TRIGGERS,
  "components/primitives/Card.tsx children": [{ component: "Card.Header" }],
  "components/steps/Stepper.tsx children": [{ component: "Stepper" }],
  "components/steps/Wizard.tsx children": [{ component: "Wizard" }],
  "components/toolbar/Toolbar.tsx children": [{ component: "Toolbar" }, { component: "Toolbar.Group" }],
  "util/children.ts children": [{ library: "The elementChildren helper itself; each caller is its own finding." }],
};
