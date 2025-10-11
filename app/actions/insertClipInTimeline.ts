import { getFile } from "@/app/store";
import { setMediaFiles } from "@/app/store/slices/projectSlice";
import { MediaFile } from "@/app/types";
import { categorizeFile, generateNextClipId } from "@/app/utils/utils";
import { ActionHandler, ActionSchema } from "./types";

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
      volume: 100,
      type: mediaType,
      zIndex: 0,
    };

    console.log(
      `📎 insert_clip_in_timeline: Created MediaFile with id ${mediaId}, timeline: ${parameters.timelineStart}-${parameters.timelineEnd}s`
    );

    // Update state (like AddMedia.tsx:49)
    const updatedMediaFiles = [...projectState.mediaFiles, newMediaFile];
    dispatch(setMediaFiles(updatedMediaFiles));
    console.log(
      `📎 insert_clip_in_timeline: Dispatched state update, timeline now has ${updatedMediaFiles.length} media files`
    );

    // Calculate duration (same logic as projectSlice.ts:37-44)
    const mediaDurations = updatedMediaFiles.map((v) => v.positionEnd);
    const textDurations = projectState.textElements.map((v) => v.positionEnd);
    const duration = Math.max(0, ...mediaDurations, ...textDurations);

    console.log(
      `📎 insert_clip_in_timeline: Calculated new timeline duration: ${duration}s`
    );

    return {
      success: true,
      mediaFileId: mediaId,
      timeline: {
        mediaFiles: updatedMediaFiles,
        textElements: projectState.textElements,
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
              description: "Start time within source file (seconds)",
            },
            clipEnd: {
              type: "number",
              description: "End time within source file (seconds)",
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
    const clipDuration = clipParams.clipEnd - clipParams.clipStart;

    // Build params for single clip insert
    const adjustedParams = {
      fileAlias: clipParams.fileAlias,
      timelineStart: currentTimelinePosition,
      timelineEnd: currentTimelinePosition + clipDuration,
      clipStart: clipParams.clipStart,
      clipEnd: clipParams.clipEnd,
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
      },
    };
  }

  const finalMediaFiles = currentContext.projectState.mediaFiles;
  const mediaDurations = finalMediaFiles.map((v) => v.positionEnd);
  const textDurations = context.projectState.textElements.map(
    (v) => v.positionEnd
  );
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
      textElements: context.projectState.textElements,
      duration,
    },
  };
};
