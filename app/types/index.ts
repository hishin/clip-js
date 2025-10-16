export type MediaType = "video" | "audio" | "image" | "unknown";

export type Track = "a-roll" | "b-roll" | "audio" | "image" | "text";

export interface UploadedFile {
  id: string;
  file: File;
  fileName?: string;
  type?: MediaType;
  src?: string;
}

export interface SourceFileAlias {
  fileName: string;
  alias: string;
}

// A lightweight, serializable object for our source files' metadata
export interface FileInfo {
  fileId: string;
  fileName: string;
  alias: string;
  type: MediaType;
  src?: string;
  videoMapIndex?: number;
  metadata?: Record<string, any>;
}

// For backend communication
export interface TimelineClip {
  clipId: string;
  sourceFileAlias?: string; // e.g., "video-1"
  track?: Track; // "a-roll" (primary narration), "b-roll" (overlay footage), "audio", "image", "text"
  timelineStartMs: number;
  timelineEndMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
  text?: string;
}

// The context object to be sent to the backend
export interface TimelineContext {
  timeline: TimelineClip[];
  playheadPositionMs: number;
  totalDurationMs: number;
  selectedRangeStartMs?: number;
  selectedRangeEndMs?: number;
}

export interface MediaFile {
  id: string;
  fileName: string;
  fileId: string;
  type: MediaType;
  startTime: number; // within the source video
  src?: string;
  endTime: number;
  positionStart: number; // position in the final video
  positionEnd: number;
  includeInMerge: boolean;
  playbackSpeed: number;
  volume: number;
  zIndex: number;
  track?: Track; // NEW: optional track assignment (a-roll=primary narration, b-roll=overlay footage)

  // Optional visual settings
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;

  // Effects
  crop?: { x: number; y: number; width: number; height: number };
}

export interface TextElement {
  id: string;
  text: string; // The actual text content
  includeInMerge?: boolean;

  // Timing
  positionStart: number; // When text appears in final video
  positionEnd: number; // When text disappears

  // Position & Size (canvas-based)
  x: number;
  y: number;
  width?: number;
  height?: number;

  // Styling
  font?: string; // Font family (e.g., 'Arial', 'Roboto')
  fontSize?: number; // Font size in pixels
  color?: string; // Text color (hex or rgba)
  backgroundColor?: string; // Background behind text
  align?: "left" | "center" | "right"; // Horizontal alignment
  zIndex?: number; // Layering
  track?: Track; // NEW: optional track assignment (defaults to "text")

  // Effects
  opacity?: number; // Transparency (0 to 1)
  rotation?: number; // Rotation in degrees
  fadeInDuration?: number; // Seconds to fade in
  fadeOutDuration?: number; // Seconds to fade out
  animation?: "slide-in" | "zoom" | "bounce" | "none"; // Optional animation

  // Runtime only (not persisted)
  visible?: boolean; // Internal flag for rendering logic
}

export type ExportFormat = "mp4" | "webm" | "gif" | "mov";

export interface ExportConfig {
  resolution: string;
  quality: string;
  speed: string;
  fps: number; // TODO: add this as an option
  format: ExportFormat; // TODO: add this as an option
  includeSubtitles: boolean; // TODO: add this as an option
}

export type ActiveElement = "media" | "text" | "export" | "notes";

export interface ProjectState {
  id: string;
  mediaFiles: MediaFile[];
  textElements: TextElement[];
  sourceFiles: FileInfo[];
  currentTime: number;
  isPlaying: boolean;
  isMuted: boolean;
  duration: number;
  zoomLevel: number;
  timelineZoom: number;
  enableMarkerTracking: boolean;
  projectName: string;
  directoryPath?: string; // Absolute path to the project directory
  createdAt: string;
  lastModified: string;
  activeSection: ActiveElement;
  activeElement: ActiveElement | null;
  activeElementIndex: number;
  selectedClips: {
    media: string[];
    text: string[];
  };
  selectedRangeStart?: number; // Selected range start time in seconds
  selectedRangeEnd?: number; // Selected range end time in seconds

  resolution: { width: number; height: number };
  fps: number;
  aspectRatio: string;
  history: ProjectState[]; // stack for undo
  future: ProjectState[]; // stack for redo
  exportSettings: ExportConfig;
}

export const mimeToExt = {
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/webm": "webm",
  // TODO: Add more as needed
};
