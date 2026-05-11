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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResolvedResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedResultRef = useRef<HTMLAnchorElement>(null);
  const pagefindRef = useRef<PagefindModule | null>(null);

  // Load Pagefind via dynamic import (ES module with named exports)
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

  // Perform search: resolve each lazy result via .data()
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
    const timer = setTimeout(() => {
      performSearch(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Click outside to dismiss results
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // / focuses the search input
      if (e.key === "/" && e.target === document.body) {
        e.preventDefault();
        inputRef.current?.focus();
        setShowResults(true);
      }
      // Escape clears and blurs
      if (e.key === "Escape" && showResults) {
        setShowResults(false);
        setQuery("");
        setResults([]);
        inputRef.current?.blur();
      }
      // Arrow keys navigate results
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        showResults &&
        results.length > 0
      ) {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (e.key === "ArrowDown")
            return prev < results.length - 1 ? prev + 1 : 0;
          return prev > 0 ? prev - 1 : results.length - 1;
        });
      }
      // Enter navigates to selected result
      if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        window.location.href = results[selectedIndex].url;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResults, results, selectedIndex]);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && selectedResultRef.current) {
      selectedResultRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div ref={containerRef} className="relative w-40 sm:w-56 md:w-72">
      {/* Inline search input */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M14 14l4 4" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search catalog…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => {
            if (query || results.length > 0) setShowResults(true);
          }}
          aria-label={`Search ${currentYear} catalog`}
          aria-expanded={showResults && (results.length > 0 || !!query)}
          aria-autocomplete="list"
          className="w-full rounded-md border border-white/20 bg-white/10 py-1.5 pl-8 pr-7 text-sm text-white placeholder:text-slate-400 transition-colors focus:border-transparent focus:bg-white focus:text-gray-900 focus:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-vhcc-blue"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 text-xs text-slate-400 sm:block">
          /
        </kbd>
      </div>

      {/* Results dropdown */}
      {showResults && (query || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 flex max-h-[70vh] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
          {/* Status bar */}
          {query && (
            <div className="shrink-0 border-b border-gray-100 px-3 py-1.5 text-xs text-gray-500">
              {isSearching
                ? "Searching…"
                : results.length > 0
                  ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`
                  : `No results for "${query}"`}
            </div>
          )}

          {/* Results list */}
          <div className="overflow-y-auto" role="listbox">
            {results.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {results.map((result, index) => (
                  <li
                    key={result.id}
                    role="option"
                    aria-selected={index === selectedIndex}
                  >
                    <a
                      ref={index === selectedIndex ? selectedResultRef : null}
                      href={result.url}
                      className={`block px-3 py-2.5 transition-colors ${
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
              <p className="px-3 py-6 text-center text-sm text-gray-500">
                No results found
              </p>
            ) : null}
          </div>

          {/* Footer hints */}
          {results.length > 0 && (
            <div className="shrink-0 flex gap-3 border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
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
      )}
    </div>
  );
}
