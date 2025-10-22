import { getFile } from "@/app/store";
import {
  setMediaFiles,
  setTextElements,
} from "@/app/store/slices/projectSlice";
import { MediaFile, Track, TextElement } from "@/app/types";
import {
  categorizeFile,
  generateNextClipId,
  DEFAULT_TRACK_Z_INDEX,
  getDefaultTrackForMediaType,
} from "@/app/utils/utils";
import { ActionHandler, ActionSchema } from "./types";

/**
 * Check if a clip overlaps with the insertion range
 */
function hasOverlap(
  clipStart: number,
  clipEnd: number,
  insertStart: number,
  insertEnd: number
): boolean {
  return clipStart < insertEnd && clipEnd > insertStart;
}

/**
 * Split an A-roll clip at the insertion point, adjusting source timing
 */
function splitArollClip(
  clip: MediaFile,
  insertStart: number,
  insertEnd: number,
  insertedDuration: number,
  existingClips: MediaFile[]
): MediaFile[] {
  const results: MediaFile[] = [];

  // Clip before insertion (if any)
  if (clip.positionStart < insertStart) {
    const beforeDuration = insertStart - clip.positionStart;
    results.push({
      ...clip,
      id: generateNextClipId(existingClips, "video"),
      positionEnd: insertStart,
      endTime: clip.startTime + beforeDuration,
    });
  }

  // Clip after insertion (if any)
  if (clip.positionEnd > insertStart) {
    const skippedDuration = insertStart - clip.positionStart;
    results.push({
      ...clip,
      id: generateNextClipId([...existingClips, ...results], "video"),
      positionStart: insertEnd,
      positionEnd: clip.positionEnd + insertedDuration,
      startTime: clip.startTime + skippedDuration,
    });
  }

  return results;
}

/**
 * Trim overlapping clips on overlay tracks (b-roll, text, image, audio)
 */
function trimOverlappingClip(
  clip: MediaFile,
  insertStart: number,
  insertEnd: number
): MediaFile[] {
  const results: MediaFile[] = [];

  // Keep portion before insertion (if any)
  if (clip.positionStart < insertStart) {
    const beforeDuration = insertStart - clip.positionStart;
    results.push({
      ...clip,
      id: `${clip.id}-before`,
      positionEnd: insertStart,
      endTime: clip.startTime + beforeDuration,
    });
  }

  // Keep portion after insertion (if any)
  if (clip.positionEnd > insertEnd) {
    const skippedDuration = insertEnd - clip.positionStart;
    results.push({
      ...clip,
      id: `${clip.id}-after`,
      positionStart: insertEnd,
      startTime: clip.startTime + skippedDuration,
    });
  }

  return results;
}

/**
 * Trim overlapping text elements
 */
function trimOverlappingTextElement(
  text: TextElement,
  insertStart: number,
  insertEnd: number
): TextElement[] {
  const results: TextElement[] = [];

  if (text.positionStart < insertStart) {
    results.push({
      ...text,
      id: `${text.id}-before`,
      positionEnd: insertStart,
    });
  }

  if (text.positionEnd > insertEnd) {
    results.push({
      ...text,
      id: `${text.id}-after`,
      positionStart: insertEnd,
    });
  }

  return results;
}

/**
 * Internal handler for inserting a single clip into the timeline.
 * Called by insert_clips_in_timeline for each clip.
 *
 * This follows the same pattern as AddMedia.tsx but with custom timing parameters
 * instead of hardcoded defaults (0-30 seconds).
 */
export const _insert_single_clip_in_timeline: ActionHandler = async (
  parameters,
  context
) => {
  const { projectState, dispatch } = context;

  console.log(
    `📎 insert_clip_in_timeline: Starting with parameters:`,
    parameters
  );
  console.log(
    `📎 insert_clip_in_timeline: Current timeline has ${projectState.mediaFiles.length} media files`
  );

  try {
    // Resolve fileAlias to fileId from project's sourceFiles
    console.log(
      `📎 insert_clip_in_timeline: Looking up fileId for alias "${parameters.fileAlias}"`
    );
    const sourceFile = projectState.sourceFiles.find(
      (sf) => sf.alias === parameters.fileAlias
    );
    if (!sourceFile) {
      console.error(
        `📎 insert_clip_in_timeline: No source file found with alias: ${parameters.fileAlias}`
      );
      return {
        success: false,
        error: `No source file found with alias: ${parameters.fileAlias}`,
      };
    }
    const fileId = sourceFile.fileId;
    console.log(
      `📎 insert_clip_in_timeline: Resolved alias "${parameters.fileAlias}" to fileId: ${fileId}`
    );

    // Get file from storage (like AddMedia.tsx:17)
    console.log(
      `📎 insert_clip_in_timeline: Fetching file ${fileId} from storage`
    );
    const file = await getFile(fileId);
    if (!file) {
      console.error(`📎 insert_clip_in_timeline: File not found: ${fileId}`);
      return { success: false, error: `File not found: ${fileId}` };
    }
    console.log(
      `📎 insert_clip_in_timeline: Found file: ${file.name} (${file.type})`
    );

    // Create new MediaFile (like AddMedia.tsx:26-47)
    const mediaType = categorizeFile(file.type);
    const mediaId = generateNextClipId(
      [...projectState.mediaFiles, ...projectState.textElements],
      mediaType
    );
    const track: Track =
      parameters.track || getDefaultTrackForMediaType(mediaType);
    const newMediaFile: MediaFile = {
      id: mediaId,
      fileName: file.name,
      fileId: fileId, // Resolved from fileAlias
      startTime: parameters.clipStart, // CUSTOM: from parameter (not hardcoded to 0)
      endTime: parameters.clipEnd, // CUSTOM: from parameter (not hardcoded to 30)
      positionStart: parameters.timelineStart, // CUSTOM: from parameter (not calculated)
      positionEnd: parameters.timelineEnd, // CUSTOM: from parameter (not calculated)
      src: URL.createObjectURL(file),
      includeInMerge: true,
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      rotation: 0,
      opacity: 100,
      crop: { x: 0, y: 0, width: 1920, height: 1080 },
      playbackSpeed: 1,
      volume: track === "b-roll" && mediaType === "video" ? 0 : 100,
      type: mediaType,
      track: track,
      zIndex: DEFAULT_TRACK_Z_INDEX[track],
    };

    console.log(
      `📎 insert_clip_in_timeline: Created MediaFile with id ${mediaId}, timeline: ${parameters.timelineStart}-${parameters.timelineEnd}s`
    );

    // Track-aware insertion logic
    const insertionPoint = parameters.timelineStart;
    const insertionEnd = parameters.timelineEnd;
    const insertedDuration = insertionEnd - insertionPoint;
    const insertedTrack = track;

    let updatedMediaFiles: MediaFile[];
    let updatedTextElements: TextElement[] = projectState.textElements;

    if (insertedTrack === "a-roll") {
      // A-ROLL: Ripple edit
      console.log(
        `📎 insert_clip_in_timeline: A-roll insertion - applying ripple edit`
      );
      const processedMediaFiles: MediaFile[] = [];

      for (const clip of projectState.mediaFiles) {
        if (
          clip.track === "a-roll" &&
          insertionPoint > clip.positionStart &&
          insertionPoint < clip.positionEnd
        ) {
          // Split overlapping A-roll clip (only when inserting IN THE MIDDLE)
          console.log(
            `📎 insert_clip_in_timeline: Splitting overlapping A-roll clip ${clip.id}`
          );
          const splitClips = splitArollClip(
            clip,
            insertionPoint,
            insertionEnd,
            insertedDuration,
            [...projectState.mediaFiles, newMediaFile, ...processedMediaFiles]
          );
          processedMediaFiles.push(...splitClips);
        } else if (
          (clip.track === "a-roll" ||
            clip.track === "b-roll" ||
            clip.track === "image") &&
          clip.positionStart >= insertionPoint
        ) {
          // Ripple forward
          console.log(
            `📎 insert_clip_in_timeline: Rippling ${clip.track} clip ${clip.id} forward by ${insertedDuration}s`
          );
          processedMediaFiles.push({
            ...clip,
            positionStart: clip.positionStart + insertedDuration,
            positionEnd: clip.positionEnd + insertedDuration,
          });
        } else {
          // Keep unchanged (audio, or clips before insertion)
          processedMediaFiles.push(clip);
        }
      }

      // Ripple text elements
      updatedTextElements = projectState.textElements.map((text) => {
        if (text.positionStart >= insertionPoint) {
          console.log(
            `📎 insert_clip_in_timeline: Rippling text ${text.id} forward by ${insertedDuration}s`
          );
          return {
            ...text,
            positionStart: text.positionStart + insertedDuration,
            positionEnd: text.positionEnd + insertedDuration,
          };
        }
        return text;
      });

      updatedMediaFiles = [...processedMediaFiles, newMediaFile];
    } else {
      // B-ROLL, IMAGE, AUDIO: Overwrite edit
      console.log(
        `📎 insert_clip_in_timeline: ${insertedTrack} insertion - applying overwrite edit`
      );
      const processedMediaFiles: MediaFile[] = [];

      for (const clip of projectState.mediaFiles) {
        if (
          clip.track === insertedTrack &&
          hasOverlap(
            clip.positionStart,
            clip.positionEnd,
            insertionPoint,
            insertionEnd
          )
        ) {
          // Trim overlapping clips on same track
          console.log(
            `📎 insert_clip_in_timeline: Trimming overlapping ${clip.track} clip ${clip.id}`
          );
          const trimmedClips = trimOverlappingClip(
            clip,
            insertionPoint,
            insertionEnd
          );
          processedMediaFiles.push(...trimmedClips);
        } else {
          // Keep all other clips unchanged
          processedMediaFiles.push(clip);
        }
      }

      // For text track, trim overlapping text elements
      if (insertedTrack === "text") {
        updatedTextElements = projectState.textElements.flatMap((text) => {
          if (
            hasOverlap(
              text.positionStart,
              text.positionEnd,
              insertionPoint,
              insertionEnd
            )
          ) {
            console.log(
              `📎 insert_clip_in_timeline: Trimming overlapping text ${text.id}`
            );
            return trimOverlappingTextElement(
              text,
              insertionPoint,
              insertionEnd
            );
          }
          return [text];
        });
      }

      updatedMediaFiles = [...processedMediaFiles, newMediaFile];
    }

    dispatch(setMediaFiles(updatedMediaFiles));

    // Update text elements if they were modified
    if (updatedTextElements !== projectState.textElements) {
      dispatch(setTextElements(updatedTextElements));
    }

    console.log(
      `📎 insert_clip_in_timeline: Dispatched state update, timeline now has ${updatedMediaFiles.length} media files`
    );

    // Calculate duration (same logic as projectSlice.ts:37-44)
    const mediaDurations = updatedMediaFiles.map((v) => v.positionEnd);
    const textDurations = updatedTextElements.map((v) => v.positionEnd);
    const duration = Math.max(0, ...mediaDurations, ...textDurations);

    console.log(
      `📎 insert_clip_in_timeline: Calculated new timeline duration: ${duration}s`
    );

    return {
      success: true,
      mediaFileId: mediaId,
      timeline: {
        mediaFiles: updatedMediaFiles,
        textElements: updatedTextElements,
        duration: duration,
      },
    };
  } catch (error) {
    console.error(`📎 insert_clip_in_timeline: Exception occurred:`, error);
    return {
      success: false,
      error: `Failed to insert clip: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

/**
 * Schema for backend registration - insert multiple clips sequentially
 */
export const insert_clips_in_timeline_schema: ActionSchema = {
  name: "insert_clips_in_timeline",
  description:
    "Insert one or more clips sequentially into the timeline. Clips are placed one after another starting from the specified timeline position. For a single clip, provide a 1-item array. For multiple clips (e.g., frankenbite segments), they will be placed immediately after each other.",
  parameters: {
    type: "object",
    properties: {
      timelineStart: {
        type: "number",
        description:
          "Timeline position (in seconds) where the first clip should start. Subsequent clips are placed immediately after.",
      },
      clips: {
        type: "array",
        description: "Array of one or more clips to insert sequentially",
        items: {
          type: "object",
          description: "A clip to insert into the timeline",
          properties: {
            fileAlias: {
              type: "string",
              description:
                "The alias of the media file (e.g., 'video-1', 'audio-2')",
            },
            clipStart: {
              type: "number",
              description:
                "Start time within source file (seconds). Optional - if not provided, starts from 0.",
            },
            clipEnd: {
              type: "number",
              description:
                "End time within source file (seconds). Optional - if not provided, uses the full duration of the media file.",
            },
            track: {
              type: "string",
              description:
                "Which track to place the clip on: 'a-roll' (primary narration), 'b-roll' (overlay footage), 'audio', or 'image'. Optional - if not provided or if there's a type mismatch, will auto-detect based on file type (videos->a-roll, audio->audio, images->image).",
            },
          },
        },
      },
    },
    required: ["timelineStart", "clips"],
  },
  returns: {
    type: "object",
    description: "Result with per-clip details and final timeline state",
    properties: {
      success: {
        type: "boolean",
        description: "Whether all clips succeeded",
      },
      results: {
        type: "array",
        description: "Individual result for each clip",
        items: {
          type: "object",
          description: "Result of inserting a single clip",
          properties: {
            clipIndex: {
              type: "number",
              description: "Index in input array",
            },
            success: {
              type: "boolean",
              description: "Whether this clip succeeded",
            },
            mediaFileId: {
              type: "string",
              description: "Created media file ID",
            },
            timelineStart: {
              type: "number",
              description: "Actual timeline start position",
            },
            timelineEnd: {
              type: "number",
              description: "Actual timeline end position",
            },
            error: {
              type: "string",
              description: "Error if failed",
            },
          },
        },
      },
      timeline: {
        type: "object",
        description: "Final timeline state",
      },
      error: {
        type: "string",
        description: "Error if overall failure",
      },
    },
    required: ["success"],
  },
};

/**
 * Handler implementation for insert_clips_in_timeline action
 *
 * Inserts multiple clips sequentially, auto-calculating timeline positions.
 */
export const insert_clips_in_timeline: ActionHandler = async (
  parameters,
  context
) => {
  console.log(
    `📎 insert_clips_in_timeline: Starting with ${parameters.clips.length} clips`
  );

  const results = [];
  let overallSuccess = true;
  let currentContext = context;
  let currentTimelinePosition = parameters.timelineStart;

  for (let i = 0; i < parameters.clips.length; i++) {
    const clipParams = parameters.clips[i];

    // Get source file to validate and determine properties
    const sourceFile = currentContext.projectState.sourceFiles.find(
      (sf) => sf.alias === clipParams.fileAlias
    );

    if (!sourceFile) {
      results.push({
        clipIndex: i,
        success: false,
        error: `No source file found with alias: ${clipParams.fileAlias}`,
        timelineStart: currentTimelinePosition,
        timelineEnd: currentTimelinePosition,
      });
      overallSuccess = false;
      console.error(
        `📎 Clip ${i}: No source file found with alias "${clipParams.fileAlias}"`
      );
      continue;
    }

    // Handle missing clipStart/clipEnd
    let clipStart = clipParams.clipStart;
    let clipEnd = clipParams.clipEnd;

    if (clipStart === undefined || clipEnd === undefined) {
      // Check if we have stored duration in metadata
      const storedDuration = sourceFile.metadata?.durationSeconds;

      clipStart = clipStart ?? 0;
      clipEnd = clipEnd ?? storedDuration ?? 30; // Use stored duration, fallback to 30s

      console.log(
        `📎 Clip ${i}: No clipStart/clipEnd provided, using ${
          storedDuration ? "stored" : "default"
        } duration: ${clipStart}-${clipEnd}s`
      );
    }

    const clipDuration = clipEnd - clipStart;

    // Validate duration
    if (clipDuration <= 0 || !isFinite(clipDuration)) {
      results.push({
        clipIndex: i,
        success: false,
        error: `Invalid clip duration: ${clipDuration}s (clipStart: ${clipStart}, clipEnd: ${clipEnd})`,
        timelineStart: currentTimelinePosition,
        timelineEnd: currentTimelinePosition,
      });
      overallSuccess = false;
      console.error(`📎 Clip ${i}: Invalid clip duration`);
      continue;
    }

    // Validate and correct track assignment based on actual file type
    let track = clipParams.track;
    try {
      const file = await getFile(sourceFile.fileId);
      const actualMediaType = categorizeFile(file.type);
      const defaultTrack = getDefaultTrackForMediaType(actualMediaType);

      // If track is specified, validate it matches the file type
      if (track) {
        // Check for common mismatches
        const isMismatch =
          (track === "audio" && actualMediaType === "video") ||
          (track === "a-roll" && actualMediaType === "audio") ||
          (track === "b-roll" && actualMediaType === "audio") ||
          (track === "image" && actualMediaType !== "image");

        if (isMismatch) {
          console.warn(
            `📎 Clip ${i}: Track mismatch! File "${sourceFile.alias}" is type "${actualMediaType}" but was sent to "${track}" track. Overriding to "${defaultTrack}"`
          );
          track = defaultTrack;
        }
      } else {
        // No track specified, use default
        track = defaultTrack;
      }
    } catch (error) {
      console.warn(
        `📎 Clip ${i}: Could not validate track for file "${sourceFile.alias}": ${error}`
      );
      // If we can't load the file, proceed with whatever track was specified (or undefined)
    }

    // Build params for single clip insert
    const adjustedParams = {
      fileAlias: clipParams.fileAlias,
      timelineStart: currentTimelinePosition,
      timelineEnd: currentTimelinePosition + clipDuration,
      clipStart: clipStart,
      clipEnd: clipEnd,
      track: track, // Pass through validated track
    };

    const result = await _insert_single_clip_in_timeline(
      adjustedParams,
      currentContext
    );

    results.push({
      clipIndex: i,
      success: result.success,
      mediaFileId: result.mediaFileId,
      timelineStart: currentTimelinePosition,
      timelineEnd: currentTimelinePosition + clipDuration,
      error: result.error,
    });

    if (!result.success) {
      overallSuccess = false;
      console.warn(`📎 Clip ${i} failed: ${result.error}`);
    } else {
      currentTimelinePosition += clipDuration;
    }

    // Update context with new state
    currentContext = {
      ...context,
      projectState: {
        ...context.projectState,
        mediaFiles:
          result.timeline?.mediaFiles || context.projectState.mediaFiles,
        textElements:
          result.timeline?.textElements || context.projectState.textElements,
      },
    };
  }

  const finalMediaFiles = currentContext.projectState.mediaFiles;
  const finalTextElements = currentContext.projectState.textElements;
  const mediaDurations = finalMediaFiles.map((v) => v.positionEnd);
  const textDurations = finalTextElements.map((v) => v.positionEnd);
  const duration = Math.max(0, ...mediaDurations, ...textDurations);

  console.log(
    `📎 insert_clips_in_timeline: Completed. Success: ${overallSuccess}, ${
      results.filter((r) => r.success).length
    }/${results.length} clips inserted`
  );

  return {
    success: overallSuccess,
    results,
    timeline: {
      mediaFiles: finalMediaFiles,
      textElements: finalTextElements,
      duration,
    },
  };
};
