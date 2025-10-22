"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
import { getFile, useAppSelector } from "@/app/store";

// Video preview padding (in seconds) - adds context before/after clip boundaries
const VIDEO_PREVIEW_PADDING = 0.5;

// Video Segment Renderer Component
function VideoSegmentRenderer(props: {
  block: any;
  editor: any;
}) {
  const { 
    fileAlias, 
    url, 
    name, 
    startTime, 
    endTime,
    transcript,
    speaker,
    visual,
    initialExpanded
  } = props.block.props;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string>(url || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? false);
  
  // Get sourceFiles from Redux to map fileAlias to fileId
  const { sourceFiles } = useAppSelector((state) => state.projectState);

  // Load video from IndexedDB only when expanded
  useEffect(() => {
    if (!isExpanded || videoSrc || !fileAlias) return;

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
  }, [isExpanded, fileAlias, videoSrc, sourceFiles]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith("blob:")) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  // Handle video time constraints with inline handlers (more reliable than useEffect)
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    // Seek to start time with padding
    const paddedStartTime = Math.max(0, startTime - VIDEO_PREVIEW_PADDING);
    video.currentTime = paddedStartTime;
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    // Pause at end time with padding
    const paddedEndTime = Math.min(
      video.duration || Infinity,
      endTime + VIDEO_PREVIEW_PADDING
    );
    if (video.currentTime >= paddedEndTime) {
      video.pause();
      // Loop back to start
      video.currentTime = Math.max(0, startTime - VIDEO_PREVIEW_PADDING);
    }
  };

  // Determine what content to show
  const hasTranscript = Boolean(transcript || speaker);
  const hasVisual = Boolean(visual);
  const displayTranscript = transcript || "";
  const displayVisual = visual || "";

  return (
    <div className="video-segment-block border border-gray-700 rounded-lg bg-gray-800 hover:border-gray-600 transition-colors" contentEditable={false}>
      {/* Header - Always visible, clickable to toggle */}
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-750 rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-gray-400 select-none">
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="font-medium text-gray-200">{name || fileAlias}</span>
        <span className="text-xs text-gray-500 ml-auto">
          [{startTime.toFixed(1)}s - {endTime.toFixed(1)}s]
        </span>
      </div>

      {/* Content Preview - Always visible (collapsed view) */}
      <div className="px-3 py-2 text-sm space-y-1">
        {hasTranscript && (
          <div className="flex gap-2 text-gray-300">
            <span className="text-gray-500 select-none">📝</span>
            <span className="flex-1">{displayTranscript}</span>
          </div>
        )}
        {hasVisual && (
          <div className="flex gap-2 text-gray-400">
            <span className="text-gray-500 select-none">🎥</span>
            <span className="flex-1">{displayVisual}</span>
          </div>
        )}
        {!hasTranscript && !hasVisual && (
          <div className="text-gray-500 italic">
            No description available
          </div>
        )}
      </div>

      {/* Video Player - Only visible when expanded */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400 text-sm">Loading video...</span>
              </div>
            </div>
          ) : error ? (
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-400 text-sm mb-2">⚠️ {error}</div>
                <div className="text-gray-500 text-xs">{name}</div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden bg-gray-900">
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="w-full"
                style={{ maxHeight: "300px" }}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
              />
              
              {/* Time Range Overlay */}
              <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
                {startTime.toFixed(1)}s - {endTime.toFixed(1)}s
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Define the VideoSegment block spec
export const createVideoSegment = createReactBlockSpec(
  {
    type: "videoSegment",
    propSchema: {
      fileAlias: { default: "" },
      url: { default: "" },
      name: { default: "Video" },
      startTime: { default: 0 },
      endTime: { default: 0 },
      transcript: { default: "" },
      speaker: { default: "" },
      visual: { default: "" },
      initialExpanded: { default: false },
      ...defaultProps,
    },
    content: "none",
  },
  {
    render: VideoSegmentRenderer,
  }
);
