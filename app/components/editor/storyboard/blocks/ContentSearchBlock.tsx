"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
import { getFile, useAppSelector } from "@/app/store";
import { BACKEND_URL } from "@/app/utils/backend";

// Configuration
const COLUMNS_PER_ROW = 3; // Number of video columns when inserting selected results

// Video preview padding (in seconds)
const VIDEO_PREVIEW_PADDING = 0.5;

// Type for search results from backend
interface SearchResult {
  segmentId: string;
  sourceFileAlias: string;
  sourceStartMs: number;
  sourceEndMs: number;
  visual: string;
  query_index?: number;
  query_text?: string;
}

// Video Preview Component
function VideoPreview({
  fileAlias,
  startTime,
  endTime,
  caption,
  isSelected,
  onToggle,
}: {
  fileAlias: string;
  startTime: number;
  endTime: number;
  caption: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  // Get sourceFiles from Redux to map fileAlias to fileId
  const { sourceFiles } = useAppSelector((state) => state.projectState);

  // Load video from IndexedDB
  useEffect(() => {
    if (videoSrc || !fileAlias) return;

    const loadVideo = async () => {
      try {
        setIsLoading(true);
        
        // Find the source file with matching alias
        const sourceFile = sourceFiles.find((file) => file.alias === fileAlias);
        if (!sourceFile) {
          setError(`Source file not found for alias: ${fileAlias}`);
          return;
        }
        
        // Load from IndexedDB using the fileId
        const file = await getFile(sourceFile.fileId);
        if (file) {
          const blobUrl = URL.createObjectURL(file);
          setVideoSrc(blobUrl);
        } else {
          setError("Video file not found in IndexedDB");
        }
      } catch (err) {
        console.error("Error loading video:", err);
        setError("Failed to load video");
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [fileAlias, videoSrc, sourceFiles]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith("blob:")) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  // Handle video time constraints
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const paddedStartTime = Math.max(0, startTime - VIDEO_PREVIEW_PADDING);
    video.currentTime = paddedStartTime;
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const paddedEndTime = Math.min(
      video.duration || Infinity,
      endTime + VIDEO_PREVIEW_PADDING
    );
    if (video.currentTime >= paddedEndTime) {
      video.pause();
      video.currentTime = Math.max(0, startTime - VIDEO_PREVIEW_PADDING);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg overflow-hidden border-2 border-transparent">
        <div className="aspect-video bg-gray-900 flex items-center justify-center">
          <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg overflow-hidden border-2 border-transparent">
        <div className="aspect-video bg-gray-900 flex items-center justify-center">
          <div className="text-xs text-red-400">Error loading video</div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onToggle}
      className={`cursor-pointer bg-gray-800 rounded-lg overflow-hidden border-2 transition-all ${
        isSelected ? "border-blue-500 ring-2 ring-blue-500/50" : "border-transparent hover:border-gray-600"
      }`}
    >
      <div className="relative">
        {/* Video Player */}
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full"
          style={{ maxHeight: "200px" }}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onClick={(e) => {
            e.stopPropagation();
            if (videoRef.current) {
              if (videoRef.current.paused) {
                videoRef.current.play();
              } else {
                videoRef.current.pause();
              }
            }
          }}
        />
        
        {/* Checkbox Overlay */}
        <div className="absolute top-2 left-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded cursor-pointer"
          />
        </div>
        
        {/* Time Range Overlay */}
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
          {startTime.toFixed(1)}s - {endTime.toFixed(1)}s
        </div>
      </div>
      
      {/* Caption */}
      <div className="p-2 bg-gray-800">
        <div className="text-xs text-gray-300 line-clamp-2">{caption}</div>
      </div>
    </div>
  );
}

// Content Search Block Renderer Component
function ContentSearchRenderer(props: {
  block: any;
  editor: any;
}) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Get project data from Redux
  const { sourceFiles, id: projectId } = useAppSelector((state) => state.projectState);

  // Focus input when block is mounted
  useEffect(() => {
    if (inputRef.current) {
      // Small delay to ensure BlockNote has finished its operations
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, []);

  // Real search function that calls the backend API
  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setHasSearched(true);
    setSearchError("");
    
    try {
      // Get all file aliases from the project
      const file_aliases = sourceFiles.map(f => f.alias);
      
      if (file_aliases.length === 0) {
        setSearchError("No source files found in project");
        setResults([]);
        setIsSearching(false);
        return;
      }
      
      // Call backend search API
      const response = await fetch(
        `${BACKEND_URL}/api/v1/projects/${projectId}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query,
            file_aliases: file_aliases,
          }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.matches || []);
        console.log(`Found ${data.matches?.length || 0} visual matches for "${query}"`);
      } else {
        setSearchError(data.error || "Search failed");
        setResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchError(error instanceof Error ? error.message : "An error occurred");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelection = (segmentId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(segmentId)) {
      newSelected.delete(segmentId);
    } else {
      newSelected.add(segmentId);
    }
    setSelectedIds(newSelected);
  };

  const handleAddSelected = () => {
    if (selectedIds.size === 0) return;
    
    // Get selected results
    const selectedResults = results.filter(r => selectedIds.has(r.segmentId));
    
    // Group results into rows of COLUMNS_PER_ROW
    const rows: typeof selectedResults[] = [];
    for (let i = 0; i < selectedResults.length; i += COLUMNS_PER_ROW) {
      rows.push(selectedResults.slice(i, i + COLUMNS_PER_ROW));
    }
    
    // Create columnList blocks for each row
    const blocksToInsert = rows.map(rowResults => ({
      type: "columnList",
      children: rowResults.map(result => ({
        type: "column",
        children: [
          {
            type: "videoSegment",
            props: {
              fileAlias: result.sourceFileAlias,
              startTime: result.sourceStartMs / 1000,
              endTime: result.sourceEndMs / 1000,
              name: result.sourceFileAlias,
              caption: result.visual,
            },
          }
        ]
      }))
    }));
    
    // Insert blocks after the current block
    const currentBlock = props.editor.getBlock(props.block.id);
    if (currentBlock) {
      props.editor.insertBlocks(blocksToInsert, currentBlock, "after");
      
      // Remove this search block
      props.editor.removeBlocks([props.block.id]);
    }
  };

  return (
    <div className="content-search-block p-4 bg-gray-900 rounded-lg border border-gray-700" contentEditable={false}>
      {/* Search Input */}
      <div className="flex gap-2 mb-4">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="search for content"
          className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Loading Spinner */}
      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Searching for content...</span>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {!isSearching && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Found {results.length} result{results.length !== 1 ? 's' : ''} • {selectedIds.size} selected
            </div>
            <button
              onClick={handleAddSelected}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Add Selected ({selectedIds.size})
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {results.map((result) => (
              <VideoPreview
                key={result.segmentId}
                fileAlias={result.sourceFileAlias}
                startTime={result.sourceStartMs / 1000}
                endTime={result.sourceEndMs / 1000}
                caption={result.visual}
                isSelected={selectedIds.has(result.segmentId)}
                onToggle={() => toggleSelection(result.segmentId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {!isSearching && searchError && (
        <div className="text-center py-4 text-red-400 text-sm">
          ⚠️ {searchError}
        </div>
      )}

      {/* No Results */}
      {!isSearching && hasSearched && !searchError && results.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No results found. Try a different search query.
        </div>
      )}
    </div>
  );
}

// Define the ContentSearch block spec
export const createContentSearch = createReactBlockSpec(
  {
    type: "contentSearch",
    propSchema: {
      ...defaultProps,
    },
    content: "none",
  },
  {
    render: ContentSearchRenderer,
  }
);

