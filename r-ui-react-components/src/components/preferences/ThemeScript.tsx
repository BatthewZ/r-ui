import { type ThemeConfig, themeScript } from "../../util/preferences";

export interface ThemeScriptProps extends ThemeConfig {
  /** For a Content-Security-Policy that allows inline scripts by nonce. */
  nonce?: string;
}

/**
 * A blocking `<script>` for the document `<head>` (server or static rendering)
 * that applies the saved theme, density and input to `<html>` before the first
 * paint. Pass the same `themes` and `storageKey` as `useTheme` / the switchers.
 * Since it changes `<html>` attributes before hydration, give `<html>`
 * `suppressHydrationWarning`. A client-only app inlines `themeScript()` in its
 * HTML instead: a script React creates on the client never runs.
 */
export function ThemeScript({ nonce, ...config }: ThemeScriptProps) {
  return <script nonce={nonce}>{themeScript(config)}</script>;
}
