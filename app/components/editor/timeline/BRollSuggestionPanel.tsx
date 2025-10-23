"use client";
import React, { useRef, useEffect } from "react";
import { FileInfo } from "@/app/types";
import { useAppSelector } from "@/app/store";
import { shallowEqual } from "react-redux";

interface BRollSuggestion {
  id: string;
  fileAlias: string;
  sourceStartMs: number;
  sourceEndMs: number;
  thumbnail?: string;
}

interface BRollSuggestionPanelProps {
  suggestions: BRollSuggestion[];
  onTogglePreview: (suggestion: BRollSuggestion, clipId?: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

// Memoized suggestion card component - only re-renders when its own clip changes
const SuggestionCard = React.memo(function SuggestionCard({
  suggestion,
  index,
  onToggle,
}: {
  suggestion: BRollSuggestion;
  index: number;
  onToggle: (suggestion: BRollSuggestion, clipId?: string) => void;
}) {
  // Each card selects its own data from Redux
  const sourceFiles = useAppSelector((state) => state.projectState.sourceFiles);
  const timelineClip = useAppSelector(
    (state) =>
      state.projectState.mediaFiles.find(
        (clip) => clip.suggestionId === suggestion.id
      ),
    shallowEqual
  );

  // Find the specific file this card needs
  const sourceFile = sourceFiles.find((file) => file.alias === suggestion.fileAlias);

  const isPreviewed = !!timelineClip;
  const duration = suggestion.sourceEndMs - suggestion.sourceStartMs;

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all cursor-pointer
        ${
          isPreviewed
            ? "border-green-500 ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20"
            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
        }`}
      onClick={(e) => {
        e.preventDefault();
        onToggle(suggestion, timelineClip?.id);
      }}
    >
      {/* Video Preview */}
      <div className="relative bg-gray-900 aspect-video">
        {sourceFile?.src ? (
          <video
            src={sourceFile.src}
            className="w-full h-full object-cover"
            muted
            onMouseEnter={(e) => {
              const video = e.currentTarget;
              video.currentTime = suggestion.sourceStartMs / 1000;
              video.play().catch(() => {});
            }}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
            }}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              // Pause when reaching the end of the segment
              if (video.currentTime >= suggestion.sourceEndMs / 1000) {
                video.pause();
                video.currentTime = suggestion.sourceStartMs / 1000;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Checkbox Overlay */}
        <div className="absolute top-2 left-2">
          <input
            type="checkbox"
            checked={isPreviewed}
            onChange={() => onToggle(suggestion, timelineClip?.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 text-green-600 bg-white border-gray-300 rounded 
                     focus:ring-green-500 focus:ring-2 cursor-pointer"
          />
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          {formatTime(duration)}
        </div>

        {/* Previewed Indicator */}
        {isPreviewed && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-medium">
            On Timeline
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 bg-white dark:bg-gray-800">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
          {sourceFile?.fileName || suggestion.fileAlias}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {formatTime(suggestion.sourceStartMs)} -{" "}
          {formatTime(suggestion.sourceEndMs)}
        </p>
      </div>
    </div>
  );
});

export default function BRollSuggestionPanel({
  suggestions,
  onTogglePreview,
  onConfirm,
  onCancel,
}: BRollSuggestionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate previewed count from Redux
  const previewedCount = useAppSelector(
    (state) =>
      state.projectState.mediaFiles.filter(
        (clip) => clip.suggestedState === "suggested_addition"
      ).length
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Suggested B-Rolls
        </h3>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {suggestions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400 text-center">
              No suggestions available
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                index={index}
                onToggle={onTogglePreview}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {previewedCount} {previewedCount === 1 ? "clip" : "clips"} on timeline
          </p>
          {previewedCount > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              Preview active • Play timeline to see
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                     bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                     rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 
                     focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={previewedCount === 0}
            className="flex-1 px-4 py-2 text-sm font-medium text-white 
                     bg-green-600 rounded-md hover:bg-green-700 
                     focus:outline-none focus:ring-2 focus:ring-green-500 
                     disabled:opacity-50 disabled:cursor-not-allowed 
                     transition-colors"
          >
            Confirm {previewedCount > 0 && `(${previewedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

