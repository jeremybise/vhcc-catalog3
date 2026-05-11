import React, { useState, useEffect, useRef, useCallback } from "react";

interface SearchResult {
  id: string;
  url: string;
  title?: string;
  excerpt?: string;
  meta?: Record<string, string>;
}

interface SearchResultWithMeta extends SearchResult {
  meta?: { year?: string; title?: string; image?: string };
}

declare global {
  interface Window {
    pagefind?: {
      search: (
        query: string,
      ) => Promise<{ results: SearchResult[] } | { id: string }>;
      init: () => Promise<void>;
    };
  }
}

export interface CatalogSearchProps {
  currentYear: string;
}

export default function CatalogSearch({ currentYear }: CatalogSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultWithMeta[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [pagefindReady, setPagefindReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const selectedResultRef = useRef<HTMLAnchorElement>(null);

  // Initialize Pagefind
  useEffect(() => {
    const initPagefind = async () => {
      if (typeof window !== "undefined") {
        try {
          // Load Pagefind library dynamically
          if (!window.pagefind) {
            const script = document.createElement("script");
            script.src = "/pagefind/pagefind.js";
            script.async = true;
            script.onload = async () => {
              if (window.pagefind) {
                await window.pagefind.init();
                setPagefindReady(true);
              }
            };
            script.onerror = () => {
              console.warn("Failed to load Pagefind library");
            };
            document.head.appendChild(script);
          } else {
            setPagefindReady(true);
          }
        } catch (error) {
          console.warn("Pagefind initialization failed:", error);
        }
      }
    };

    initPagefind();
  }, []);

  // Perform search with year filtering
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !window.pagefind) {
        setResults([]);
        setSelectedIndex(-1);
        return;
      }

      setIsSearching(true);
      try {
        const searchResults = await window.pagefind.search(searchQuery);

        if ("results" in searchResults) {
          // Filter results by current year by parsing the URL
          // URLs should look like /2026-2027/... so extract the year from the path
          const yearFiltered = (
            searchResults.results as SearchResultWithMeta[]
          ).filter((result) => {
            // Parse year from URL: /2026-2027/... → 2026-2027
            const urlPath = new URL(result.url, window.location.href).pathname;
            const pathParts = urlPath.split("/").filter(Boolean);
            const resultYear = pathParts[0]; // First path segment should be the year
            return resultYear === currentYear;
          });

          setResults(yearFiltered);
          setSelectedIndex(-1);
        }
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Slash to open/focus search
      if (e.key === "/" && !isOpen && e.target === document.body) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }

      // Arrow keys to navigate results
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        isOpen &&
        results.length > 0
      ) {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (e.key === "ArrowDown") {
            return prev < results.length - 1 ? prev + 1 : 0;
          } else {
            return prev > 0 ? prev - 1 : results.length - 1;
          }
        });
      }

      // Enter to navigate to selected result
      if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        const url = new URL(results[selectedIndex].url);
        window.location.href = url.toString();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && selectedResultRef.current) {
      selectedResultRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <>
      {/* Search button in header */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-vhcc-navy/50 hover:bg-vhcc-navy/70 text-slate-200 hover:text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vhcc-blue"
        aria-label="Open search"
        title="Press / to search"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M14 14l4 4" />
        </svg>
        <span className="hidden md:inline">Search</span>
        <kbd className="text-xs font-semibold text-slate-300">/</kbd>
      </button>

      {/* Mobile search button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="sm:hidden p-1.5 rounded-md hover:bg-vhcc-blue/50 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vhcc-blue"
        aria-label="Open search"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M14 14l4 4" />
        </svg>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            className="fixed inset-x-0 top-0 sm:inset-0 sm:flex sm:items-start sm:justify-center pt-12 sm:pt-16 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl flex flex-col max-h-[70vh] sm:max-h-[80vh]">
              {/* Search input */}
              <div className="flex-shrink-0 border-b border-gray-200 p-4">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={`Search ${currentYear} catalog...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-4 py-2 text-lg border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vhcc-blue focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">
                  {results.length > 0 && (
                    <>
                      Found{" "}
                      <span className="font-semibold">{results.length}</span>{" "}
                      result
                      {results.length !== 1 ? "s" : ""}
                      {query && <> for "{query}"</>}
                    </>
                  )}
                  {query && results.length === 0 && !isSearching && (
                    <>
                      No results found for "{query}" in {currentYear} catalog
                    </>
                  )}
                  {isSearching && <>Searching...</>}
                </p>
              </div>

              {/* Results */}
              <div
                ref={resultsRef}
                className="flex-1 overflow-y-auto"
                role="listbox"
              >
                {results.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {results.map((result, index) => (
                      <li
                        key={result.id}
                        role="option"
                        aria-selected={index === selectedIndex}
                      >
                        <a
                          ref={
                            index === selectedIndex ? selectedResultRef : null
                          }
                          href={result.url}
                          className={`block p-4 transition-colors ${
                            index === selectedIndex
                              ? "bg-vhcc-blue/10 border-l-4 border-vhcc-blue"
                              : "hover:bg-gray-50"
                          }`}
                          onMouseEnter={() => setSelectedIndex(index)}
                        >
                          <h3 className="font-semibold text-gray-900 text-sm mb-1">
                            {result.meta?.title || "Untitled"}
                          </h3>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {result.excerpt || result.meta?.image || ""}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 font-mono">
                            {new URL(result.url, window.location.href).pathname}
                          </p>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : query && !isSearching ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <p>No results found</p>
                  </div>
                ) : null}
              </div>

              {/* Footer hint */}
              {results.length > 0 && (
                <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs font-semibold">
                    ↑↓
                  </kbd>{" "}
                  to navigate •{" "}
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs font-semibold">
                    Enter
                  </kbd>{" "}
                  to select •{" "}
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs font-semibold">
                    Esc
                  </kbd>{" "}
                  to close
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
