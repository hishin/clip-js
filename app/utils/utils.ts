import { MediaType, Track } from "../types";

export const categorizeFile = (mimeType: string): MediaType => {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return "unknown";
};

export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function generateFileAlias(
  existingAliases: string[],
  fileName: string
): string {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  let type = "file";
  if (["mp4", "mov", "webm"].includes(extension)) type = "video";
  if (["mp3", "wav", "aac"].includes(extension)) type = "audio";
  if (["png", "jpg", "jpeg", "gif"].includes(extension)) type = "image";

  let count = 1;
  let nextAlias = `${type}-${count}`;
  while (existingAliases.includes(nextAlias)) {
    count++;
    nextAlias = `${type}-${count}`;
  }
  return nextAlias;
}

/**
 * Generate the next sequential clip ID for a given media type.
 * Format: {type}-clip-{number} (e.g., "video-clip-1", "audio-clip-2")
 *
 * Each track type has its own sequence:
 * - Video: video-clip-1, video-clip-2, video-clip-3, ...
 * - Audio: audio-clip-1, audio-clip-2, ...
 * - Image: image-clip-1, image-clip-2, ...
 * - Text: text-clip-1, text-clip-2, ...
 * - Unknown: unknown-clip-1, unknown-clip-2, ...
 *
 * @param existingElements - Array of existing elements with id fields
 * @param type - The media type (video, audio, image, text, unknown)
 * @returns The next sequential clip ID for this type
 */
export function generateNextClipId(
  existingElements: { id: string }[],
  type: MediaType | "text"
): string {
  // Extract all IDs that match this type's pattern (e.g., "video-clip-1", "video-clip-2")
  const typePrefix = `${type}-clip-`;
  const existingNumbers = existingElements
    .map((el) => el.id)
    .filter((id) => id.startsWith(typePrefix))
    .map((id) => {
      const num = parseInt(id.replace(typePrefix, ""));
      return isNaN(num) ? 0 : num;
    });

  // Find the highest number and return next
  const maxNumber =
    existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  return `${typePrefix}${maxNumber + 1}`;
}

/**
 * Default z-index values for each track.
 * Higher values render on top of lower values.
 *
 * Usage: DEFAULT_TRACK_Z_INDEX[track] or DEFAULT_TRACK_Z_INDEX.v1
 */
export const DEFAULT_TRACK_Z_INDEX: Record<Track, number> = {
  text: 1000,
  image: 100,
  v2: 50,
  v1: 10,
  audio: 0,
};

/**
 * Determine the default track for a given media type.
 * Videos default to v1 (A-roll), audio to audio track, images to image track.
 */
export function getDefaultTrackForMediaType(mediaType: MediaType): Track {
  switch (mediaType) {
    case "video":
      return "v1";
    case "audio":
      return "audio";
    case "image":
      return "image";
    default:
      return "v1";
  }
}

/**
 * Extract duration from a media file (video/audio) using HTML5 Media API.
 * Returns duration in seconds, or null if unable to extract.
 */
export async function extractMediaDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const mediaType = categorizeFile(file.type);

    if (mediaType === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(isFinite(video.duration) ? video.duration : null);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };

      video.src = URL.createObjectURL(file);
    } else if (mediaType === "audio") {
      const audio = document.createElement("audio");
      audio.preload = "metadata";

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(isFinite(audio.duration) ? audio.duration : null);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        resolve(null);
      };

      audio.src = URL.createObjectURL(file);
    } else {
      resolve(null);
    }
  });
}
