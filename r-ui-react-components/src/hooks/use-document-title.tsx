"use client";
import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";

export interface DocumentTitleOptions {
  /** The app's name, appended to every page title ("Billing | Acme"). Default: none. */
  base?: string;
  /** Between the page title and the base. Default " | ". */
  separator?: string;
}

const DocumentTitleContext = createContext<DocumentTitleOptions>({});

/** Sets the title base and separator for every `useDocumentTitle` beneath it. */
export function DocumentTitleProvider({ base, separator, children }: DocumentTitleOptions & { children?: ReactNode }) {
  const value = useMemo(() => ({ base, separator }), [base, separator]);
  return <DocumentTitleContext value={value}>{children}</DocumentTitleContext>;
}

/**
 * The title a page would get: `title`, then the base after the separator. An
 * empty title is the base alone; with no base, the title alone.
 */
export function formatDocumentTitle(title: string, { base, separator = " | " }: DocumentTitleOptions = {}): string {
  return [title, base].filter(Boolean).join(separator);
}

/**
 * Sets `document.title` while the component is mounted and restores the
 * previous title on unmount. `options` override the nearest
 * `DocumentTitleProvider`; with neither, the title is exactly `title`. When
 * both title and base are empty the title is left alone.
 */
export function useDocumentTitle(title: string, options: DocumentTitleOptions = {}) {
  const inherited = useContext(DocumentTitleContext);
  const base = options.base ?? inherited.base;
  const separator = options.separator ?? inherited.separator;

  useEffect(() => {
    const next = formatDocumentTitle(title, { base, separator });
    if (!next) return;
    const prev = document.title;
    document.title = next;
    return () => {
      document.title = prev;
    };
  }, [title, base, separator]);
}
