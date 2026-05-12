import React, { useState, useEffect, useRef, useCallback } from "react";

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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, openModal, closeModal]);

  return (
    <>
      {/* Trigger button in header */}
      <button
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
          <div className="relative w-full max-w-xl rounded-xl bg-white shadow-2xl ring-1 ring-black/10 flex flex-col max-h-[70vh]">
            {/* Input row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
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
                placeholder={`Search ${currentYear} catalog…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 text-xs text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-md border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                aria-label="Close search"
              >
                Esc
              </button>
            </div>

            {/* Status / results */}
            <div className="overflow-y-auto flex-1">
              {query && (
                <div className="px-4 py-1.5 text-xs text-gray-400 border-b border-gray-100">
                  {isSearching
                    ? "Searching…"
                    : results.length > 0
                      ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`
                      : `No results for "${query}"`}
                </div>
              )}

              {results.length > 0 ? (
                <ul className="divide-y divide-gray-100" role="listbox">
                  {results.map((result, index) => (
                    <li
                      key={result.id}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <a
                        ref={index === selectedIndex ? selectedResultRef : null}
                        href={result.url}
                        onClick={closeModal}
                        className={`block px-4 py-3 transition-colors ${
                          index === selectedIndex
                            ? "border-l-2 border-vhcc-blue bg-vhcc-blue/10"
                            : "hover:bg-gray-50"
                        }`}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <p className="text-sm font-semibold text-gray-900">
                          {result.title}
                        </p>
                        <p
                          className="mt-0.5 line-clamp-1 text-xs text-gray-500"
                          dangerouslySetInnerHTML={{ __html: result.excerpt }}
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : query && !isSearching ? (
                <p className="px-4 py-10 text-center text-sm text-gray-500">
                  No results found
                </p>
              ) : !query ? (
                <p className="px-4 py-10 text-center text-sm text-gray-400">
                  Start typing to search the catalog…
                </p>
              ) : null}
            </div>

            {/* Keyboard hint footer */}
            {results.length > 0 && (
              <div className="shrink-0 flex gap-4 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-400 rounded-b-xl">
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
