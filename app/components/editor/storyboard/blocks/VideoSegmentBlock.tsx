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
  const { fileAlias, url, name, caption, startTime, endTime } = props.block.props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string>(url || "");
  const [isLoading, setIsLoading] = useState(!url);
  const [error, setError] = useState<string>("");
  
  // Get sourceFiles from Redux to map fileAlias to fileId
  const { sourceFiles } = useAppSelector((state) => state.projectState);

  // Load video from IndexedDB if not already loaded
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

  if (isLoading) {
    return (
      <div className="video-segment-block loading">
        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Loading video...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-segment-block error">
        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-400 text-sm mb-2">⚠️ {error}</div>
            <div className="text-gray-500 text-xs">{name}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-segment-block" contentEditable={false}>
      <div className="relative rounded-lg overflow-hidden bg-gray-800">
        {/* Video Player */}
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          className="w-full"
          style={{ maxHeight: "400px" }}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
        />
        
        {/* Time Range Overlay */}
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
          {startTime.toFixed(1)}s - {endTime.toFixed(1)}s
        </div>
      </div>
      
      {/* Caption/Metadata */}
      <div className="mt-2 px-2">
        <div className="text-sm font-medium text-gray-200">{name}</div>
        {caption && (
          <div className="text-xs text-gray-400 mt-1">{caption}</div>
        )}
      </div>
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
      caption: { default: "" },
      startTime: { default: 0 },
      endTime: { default: 0 },
      ...defaultProps,
    },
    content: "none",
  },
  {
    render: VideoSegmentRenderer,
  }
);

