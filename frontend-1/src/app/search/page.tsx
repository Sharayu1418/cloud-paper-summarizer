'use client';
import { useState, useCallback } from 'react';
import {
  Search as SearchIcon,
  Filter,
  ExternalLink,
  Download,
  Library,
  Globe,
  FileText,
  BookOpen,
  Plus,
  Check,
  Loader2,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button, Input, EmptyState, useToast } from '@/components/ui';
import { searchPapers, importPaper, ImportPaperParams } from '@/lib/api';
import { SearchResult } from '@/lib/types';
import clsx from 'clsx';

type SourceFilter = 'all' | 'library' | 'semantic_scholar' | 'arxiv';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const { addToast } = useToast();

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      setHasSearched(true);
      const response = await searchPapers(query.trim(), sourceFilter);
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, sourceFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleImportPaper = useCallback(async (result: SearchResult, confirmMetadataOnly = false) => {
    const resultId = result.external_id || result.document_id || result.title;
    if (!resultId || importingIds.has(resultId) || importedIds.has(resultId)) return;

    try {
      setImportingIds((prev) => new Set(prev).add(resultId));
      
      const importParams: ImportPaperParams = {
        url: result.url,
        pdf_url: result.pdf_url,
        title: result.title,
        authors: result.authors,
        abstract: result.abstract,
        source: result.source as 'semantic_scholar' | 'arxiv',
        external_id: result.external_id,
        year: result.year,
        citations: result.citations,
        confirm_metadata_only: confirmMetadataOnly,
      };

      const response = await importPaper(importParams);

      if (response.requires_confirmation && response.pdf_available === false) {
        setImportingIds((prev) => {
          const next = new Set(prev);
          next.delete(resultId);
          return next;
        });

        addToast({
          type: 'warning',
          title: 'PDF Not Available',
          message: `Could not fetch PDF for "${result.title.substring(0, 50)}...". Add with abstract only for limited chat functionality?`,
          duration: 0,
          actions: [
            {
              label: 'Add with Abstract',
              variant: 'primary',
              onClick: () => {
                handleImportPaper(result, true);
              },
            },
            {
              label: "I'll Upload Manually",
              variant: 'secondary',
              onClick: () => {
                addToast({
                  type: 'info',
                  title: 'Import Cancelled',
                  message: 'You can download the PDF and upload it manually from the Library page.',
                  duration: 5000,
                });
              },
            },
          ],
        });
        return;
      }

      setImportedIds((prev) => new Set(prev).add(resultId));
      
      addToast({
        type: 'success',
        title: 'Paper Added',
        message: response.metadata_only 
          ? `"${result.title.substring(0, 40)}..." added with abstract only.`
          : `"${result.title.substring(0, 40)}..." added and processing.`,
        duration: 4000,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import paper');
      addToast({
        type: 'error',
        title: 'Import Failed',
        message: err instanceof Error ? err.message : 'Failed to import paper',
        duration: 5000,
      });
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(resultId);
        return next;
      });
    }
  }, [importingIds, importedIds, addToast]);

  const sourceFilters: { value: SourceFilter; label: string; icon: typeof Library }[] = [
    { value: 'all', label: 'All Sources', icon: Globe },
    { value: 'library', label: 'My Library', icon: Library },
    { value: 'semantic_scholar', label: 'Semantic Scholar', icon: BookOpen },
    { value: 'arxiv', label: 'arXiv', icon: FileText },
  ];

  const getSourceBadge = (source: string) => {
    const config: Record<string, { label: string; className: string }> = {
      library: {
        label: 'Library',
        className: 'bg-[var(--color-forest)]/10 text-[var(--color-forest)]',
      },
      semantic_scholar: {
        label: 'Semantic Scholar',
        className: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
      },
      arxiv: {
        label: 'arXiv',
        className: 'bg-[var(--color-amber)]/10 text-[var(--color-amber)]',
      },
    };
    return config[source] || { label: source, className: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Search Papers"
        description="Find research across Semantic Scholar, arXiv, and your library"
      />

      <div className="p-8 bg-white">
        {/* Search Section - Top Card */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-white rounded-2xl border border-[var(--color-parchment)] p-8 shadow-sm">
            {/* Search Bar */}
            <div className="flex gap-3 mb-6">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-stone)]">
                  <SearchIcon size={20} />
                </div>
                <input
                  type="text"
                  placeholder="Search for research papers..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-12 pr-4 py-4 bg-[var(--color-parchment)]/30 border-none rounded-xl text-base text-[var(--color-ink)] placeholder:text-[var(--color-stone)] focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]/20"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                isLoading={isLoading}
                className="px-8 py-4 text-base"
              >
                Search
              </Button>
            </div>

            {/* Source Filters */}
            <div>
              <div className="text-xs font-bold text-[var(--color-stone)] uppercase tracking-wide mb-3">
                Search Sources
              </div>
              <div className="flex flex-wrap gap-3">
                {sourceFilters.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <button
                      key={filter.value}
                      onClick={() => setSourceFilter(filter.value)}
                      className={clsx(
                        'flex items-center gap-2 px-5 py-2.5 rounded-full text-base font-medium transition-all',
                        sourceFilter === filter.value
                          ? 'bg-[var(--color-forest)] text-white shadow-sm'
                          : 'bg-white border-2 border-[var(--color-parchment)] text-[var(--color-slate)] hover:border-[var(--color-forest)]/30'
                      )}
                    >
                      <Icon size={16} />
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="max-w-3xl mx-auto mb-6 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-lg text-[var(--color-error)]">
            {error}
          </div>
        )}

        {/* Discover Section - Only show when not searched */}
        {!hasSearched && !isLoading && (
          <div className="max-w-3xl mx-auto text-center py-12">
            <div className="w-20 h-20 rounded-full bg-[var(--color-parchment)] flex items-center justify-center mx-auto mb-6">
              <SearchIcon size={36} className="text-[var(--color-stone)]" />
            </div>
            <h2 className="text-xl font-serif font-bold text-[var(--color-ink)] mb-2">
              Discover Research Papers
            </h2>
            <p className="text-[var(--color-stone)] mb-6 max-w-2xl mx-auto">
              Search across millions of papers from Semantic Scholar and arXiv,
              plus your own library.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'machine learning',
                'climate change',
                'quantum computing',
                'CRISPR',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setQuery(suggestion);
                    setTimeout(() => handleSearch(), 0);
                  }}
                  className="px-4 py-2 rounded-full bg-[var(--color-parchment)] text-[var(--color-slate)] hover:bg-[var(--color-sand)] transition-colors text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="max-w-3xl mx-auto space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[var(--color-parchment)] p-6"
              >
                <div className="skeleton h-6 w-3/4 rounded mb-3" />
                <div className="skeleton h-4 w-1/2 rounded mb-4" />
                <div className="skeleton h-20 w-full rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {hasSearched && !isLoading && (
          <div className="max-w-3xl mx-auto">
            {results.length === 0 ? (
              <EmptyState
                icon={<SearchIcon size={32} />}
                title="No results found"
                description={`We couldn't find any papers matching "${query}". Try different keywords or check your spelling.`}
              />
            ) : (
              <>
                <p className="text-sm text-[var(--color-stone)] mb-4">
                  Found {results.length} result{results.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-4 stagger-children">
                  {results.map((result, index) => {
                    const sourceBadge = getSourceBadge(result.source);
                    return (
                      <div
                        key={result.document_id || result.external_id || index}
                        className="bg-white rounded-xl border border-[var(--color-parchment)] p-6 card-hover"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={clsx(
                                  'px-2 py-0.5 rounded-full text-xs font-medium',
                                  sourceBadge.className
                                )}
                              >
                                {sourceBadge.label}
                              </span>
                              {result.year && (
                                <span className="text-xs text-[var(--color-stone)]">
                                  {result.year}
                                </span>
                              )}
                              {result.citations !== undefined && result.citations > 0 && (
                                <span className="text-xs text-[var(--color-stone)]">
                                  {result.citations.toLocaleString()} citations
                                </span>
                              )}
                            </div>
                            <h3 className="font-serif font-bold text-lg text-[var(--color-ink)] leading-tight">
                              {result.title}
                            </h3>
                          </div>
                        </div>

                        {/* Authors */}
                        <p className="text-sm text-[var(--color-slate)] mb-3">
                          {result.authors}
                        </p>

                        {/* Abstract */}
                        {result.abstract && (
                          <p className="text-sm text-[var(--color-stone)] line-clamp-3 mb-4">
                            {result.abstract}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-3 border-t border-[var(--color-parchment)]">
                          {result.source === 'library' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                window.location.href = `/sessions?addPaper=${result.document_id}`;
                              }}
                            >
                              Add to Session
                            </Button>
                          ) : (
                            <>
                              {/* Add to Library button */}
                              {(() => {
                                const resultId = result.external_id || result.document_id || result.title;
                                const isImporting = importingIds.has(resultId);
                                const isImported = importedIds.has(resultId);
                                
                                return (
                                  <Button
                                    variant={isImported ? 'secondary' : 'primary'}
                                    size="sm"
                                    onClick={() => handleImportPaper(result)}
                                    disabled={isImporting || isImported}
                                  >
                                    {isImporting ? (
                                      <>
                                        <Loader2 size={14} className="animate-spin mr-1.5" />
                                        Adding...
                                      </>
                                    ) : isImported ? (
                                      <>
                                        <Check size={14} className="mr-1.5" />
                                        Added to Library
                                      </>
                                    ) : (
                                      <>
                                        <Plus size={14} className="mr-1.5" />
                                        Add to Library
                                      </>
                                    )}
                                  </Button>
                                );
                              })()}
                              
                              {result.url && (
                                <a
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-forest)] hover:text-[var(--color-forest-light)] transition-colors"
                                >
                                  <ExternalLink size={14} />
                                  View Paper
                                </a>
                              )}
                              {result.pdf_url && (
                                <a
                                  href={result.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-forest)] hover:text-[var(--color-forest-light)] transition-colors"
                                >
                                  <Download size={14} />
                                  Download PDF
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Hint */}
        {hasSearched && results.length > 0 && (
          <div className="max-w-3xl mx-auto mt-8 p-4 bg-[var(--color-parchment)]/50 rounded-lg border border-[var(--color-sand)]">
            <p className="text-sm text-[var(--color-slate)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-amber)]" />
              <span className="font-medium">Tip:</span>
              Click &quot;Add to Library&quot; to import papers directly. Papers with available PDFs will be fully indexed; others will use the abstract for chat.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}