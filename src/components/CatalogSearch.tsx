import React, { useState, useEffect, useRef, useCallback, useId } from "react";

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string; image?: string };
}

interface PagefindRawResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}

interface ResolvedResult {
  id: string;
  url: string;
  title: string;
  excerpt: string;
}

interface PagefindModule {
  search: (query: string) => Promise<{ results: PagefindRawResult[] }>;
  init?: () => Promise<void>;
}

export interface CatalogSearchProps {
  currentYear: string;
}

export default function CatalogSearch({ currentYear }: CatalogSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResolvedResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedResultRef = useRef<HTMLAnchorElement>(null);
  const pagefindRef = useRef<PagefindModule | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  // Load Pagefind via dynamic import (escapes Vite's static analysis)
  useEffect(() => {
    if (pagefindRef.current) return;
    const load = new Function(
      'return import("/pagefind/pagefind.js")',
    ) as () => Promise<PagefindModule>;
    load()
      .then((pf) => {
        pagefindRef.current = pf;
      })
      .catch((e) => console.warn("Pagefind failed to load:", e));
  }, []);

  const openModal = useCallback(() => {
    setOpen(true);
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);
    // Return focus to the button that opened the modal, per the
    // standard dialog pattern, instead of leaving it stuck on a
    // now-hidden element.
    triggerRef.current?.focus();
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Perform search with lazy result resolution
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !pagefindRef.current) {
        setResults([]);
        setSelectedIndex(-1);
        return;
      }
      setIsSearching(true);
      try {
        const { results: rawResults } =
          await pagefindRef.current.search(searchQuery);
        const resolved = await Promise.all(
          rawResults.slice(0, 50).map(async (r) => {
            const data = await r.data();
            return { id: r.id, ...data };
          }),
        );
        const yearFiltered = resolved
          .filter((data) => {
            const pathname = new URL(data.url, window.location.href).pathname;
            return pathname.split("/").filter(Boolean)[0] === currentYear;
          })
          .slice(0, 20);
        setResults(
          yearFiltered.map((data) => ({
            id: data.id,
            url: data.url,
            title: data.meta?.title ?? "Untitled",
            excerpt: data.excerpt,
          })),
        );
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [currentYear],
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 150);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && selectedResultRef.current) {
      selectedResultRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" opens modal (unless already typing somewhere)
      if (
        e.key === "/" &&
        (e.target === document.body ||
          (e.target as HTMLElement).tagName === "BUTTON")
      ) {
        e.preventDefault();
        openModal();
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeModal();
      }
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        results.length > 0
      ) {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (e.key === "ArrowDown")
            return prev < results.length - 1 ? prev + 1 : 0;
          return prev > 0 ? prev - 1 : results.length - 1;
        });
      }
      if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        window.location.href = results[selectedIndex].url;
      }
      // Keep Tab from leaving the dialog while it's open — without this,
      // keyboard users can tab past the modal into the page underneath
      // even though it's still visually (and semantically, via
      // aria-modal) blocked.
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, openModal, closeModal]);

  return (
    <>
      {/* Trigger button in header */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        aria-label="Search catalog"
        className="flex items-center justify-center rounded-md p-1.5 text-white hover:bg-vhcc-blue/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vhcc-blue transition-colors"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M15 15l3.5 3.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Modal backdrop + panel */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 sm:pt-24"
          role="dialog"
          aria-modal="true"
          aria-label={`Search ${currentYear} catalog`}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeModal}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            ref={panelRef}
            className="relative w-full max-w-xl rounded-xl bg-white shadow-2xl ring-1 ring-black/10 flex flex-col max-h-[70vh] dark:bg-gray-800 dark:ring-black/30"
          >
            {/* Input row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <svg
                className="shrink-0 h-5 w-5 text-gray-400"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="M15 15l3.5 3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-label={`Search ${currentYear} catalog`}
                aria-expanded={results.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  selectedIndex >= 0 ? optionId(selectedIndex) : undefined
                }
                placeholder={`Search ${currentYear} catalog…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vhcc-blue rounded-sm dark:text-gray-100 dark:placeholder:text-gray-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 text-xs text-gray-500 hover:text-gray-600 dark:text-gray-400"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-md border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label="Close search (Esc)"
              >
                Esc
              </button>
            </div>

            {/* Status / results */}
            <div className="overflow-y-auto flex-1">
              {query && (
                <div
                  className="px-4 py-1.5 text-xs text-gray-500 border-b border-gray-100 dark:text-gray-400 dark:border-gray-700"
                  role="status"
                >
                  {isSearching
                    ? "Searching…"
                    : results.length > 0
                      ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`
                      : `No results for "${query}"`}
                </div>
              )}

              {results.length > 0 ? (
                <ul
                  id={listboxId}
                  className="divide-y divide-gray-100 dark:divide-gray-700"
                  role="listbox"
                >
                  {results.map((result, index) => (
                    <li
                      key={result.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <a
                        ref={index === selectedIndex ? selectedResultRef : null}
                        href={result.url}
                        onClick={closeModal}
                        className={`block px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vhcc-blue focus-visible:ring-inset ${
                          index === selectedIndex
                            ? "border-l-2 border-vhcc-blue bg-vhcc-blue/10 dark:bg-vhcc-blue/20"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {result.title}
                        </p>
                        <p
                          className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400"
                          dangerouslySetInnerHTML={{ __html: result.excerpt }}
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : query && !isSearching ? (
                <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No results found
                </p>
              ) : !query ? (
                <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  Start typing to search the catalog…
                </p>
              ) : null}
            </div>

            {/* Keyboard hint footer */}
            {results.length > 0 && (
              <div className="shrink-0 flex gap-4 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500 rounded-b-xl dark:border-gray-700 dark:bg-gray-700/50 dark:text-gray-400">
                <span>
                  <kbd className="font-semibold">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="font-semibold">↵</kbd> select
                </span>
                <span>
                  <kbd className="font-semibold">Esc</kbd> close
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
