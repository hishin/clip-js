"use client";
import { useState, useEffect } from "react";
import { FileInfo } from "@/app/types";

interface BRollSuggestion {
  fileAlias: string;
  sourceStartMs: number;
  sourceEndMs: number;
  thumbnail?: string;
}

interface BRollSuggestionModalProps {
  isOpen: boolean;
  suggestions: BRollSuggestion[];
  onInsert: (selectedSuggestions: BRollSuggestion[]) => void;
  onClose: () => void;
  sourceFiles: FileInfo[];
}

export default function BRollSuggestionModal({
  isOpen,
  suggestions,
  onInsert,
  onClose,
  sourceFiles,
}: BRollSuggestionModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIndices(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const handleInsert = () => {
    const selectedSuggestions = suggestions.filter((_, index) =>
      selectedIndices.has(index)
    );
    if (selectedSuggestions.length > 0) {
      onInsert(selectedSuggestions);
      onClose();
    }
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === suggestions.length) {
      // Deselect all
      setSelectedIndices(new Set());
    } else {
      // Select all
      setSelectedIndices(new Set(suggestions.map((_, i) => i)));
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSourceFile = (fileAlias: string): FileInfo | undefined => {
    return sourceFiles.find((file) => file.alias === fileAlias);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Suggested B-Roll Clips
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select clips to insert into your timeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {suggestions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No suggestions available
              </p>
            </div>
          ) : (
            <>
              {/* Select All Checkbox */}
              <div className="mb-4 flex items-center">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectedIndices.size === suggestions.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded 
                           focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 
                           focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                />
                <label
                  htmlFor="select-all"
                  className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Select All ({suggestions.length})
                </label>
              </div>

              {/* Grid of Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestions.map((suggestion, index) => {
                  const sourceFile = getSourceFile(suggestion.fileAlias);
                  const isSelected = selectedIndices.has(index);
                  const duration = suggestion.sourceEndMs - suggestion.sourceStartMs;

                  return (
                    <div
                      key={index}
                      className={`border rounded-lg overflow-hidden transition-all cursor-pointer
                                ${
                                  isSelected
                                    ? "border-blue-500 ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                }`}
                      onClick={() => handleToggleSelection(index)}
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
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg
                              className="w-16 h-16 text-gray-600"
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
                            checked={isSelected}
                            onChange={() => handleToggleSelection(index)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded 
                                     focus:ring-blue-500 focus:ring-2 cursor-pointer"
                          />
                        </div>

                        {/* Duration Badge */}
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                          {formatTime(duration)}
                        </div>
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
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedIndices.size} of {suggestions.length} selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                       bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                       rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 
                       focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={selectedIndices.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 
                       rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 
                       focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed 
                       transition-colors"
            >
              Insert {selectedIndices.size > 0 && `(${selectedIndices.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

