import { setMediaFiles } from "@/app/store/slices/projectSlice";
import { MediaFile, ProjectState } from "@/app/types";
import { generateNextClipId } from "@/app/utils/utils";
import { ActionHandler, ActionSchema, ActionContext } from "./types";

/**
 * Utility function: Split a clip at a specific timeline position
 * Based on handleSplit logic from Timline.tsx (lines 46-79)
 *
 * @param clip - The MediaFile to split
 * @param splitTimelinePosition - Timeline position (in seconds) where to split
 * @param projectState - The project state to access existing clips for ID generation
 * @returns Tuple of [beforeClip, afterClip]
 */
function _splitClipAt(
  clip: MediaFile,
  splitTimelinePosition: number,
  projectState: ProjectState
): [MediaFile, MediaFile] {
  const { positionStart, positionEnd, startTime, endTime } = clip;

  // Validate split is within clip bounds
  if (
    splitTimelinePosition <= positionStart ||
    splitTimelinePosition >= positionEnd
  ) {
    throw new Error(
      `Split time ${splitTimelinePosition}s is outside clip bounds ${positionStart}-${positionEnd}s`
    );
  }

  // Calculate the ratio to determine source split point
  const positionDuration = positionEnd - positionStart;
  const sourceDuration = endTime - startTime;
  const ratio = (splitTimelinePosition - positionStart) / positionDuration;
  const splitSourceOffset = startTime + ratio * sourceDuration;

  // Get existing elements for ID generation
  const existingElements = [
    ...projectState.mediaFiles,
    ...projectState.textElements,
  ];

  // Create the clip BEFORE the split point
  const beforeClip: MediaFile = {
    ...clip,
    id: generateNextClipId(existingElements, clip.type),
    positionStart,
    positionEnd: splitTimelinePosition,
    startTime,
    endTime: splitSourceOffset,
  };

  // Create the clip AFTER the split point
  // Include beforeClip in existingElements to ensure unique ID
  const afterClip: MediaFile = {
    ...clip,
    id: generateNextClipId([...existingElements, beforeClip], clip.type),
    positionStart: splitTimelinePosition,
    positionEnd,
    startTime: splitSourceOffset,
    endTime,
  };

  return [beforeClip, afterClip];
}

/**
 * Utility function: Delete a clip from the timeline
 * Based on handleDelete logic from Timline.tsx (lines 157-188)
 *
 * @param clipId - ID of the clip to delete
 * @param context - Action context with projectState
 * @returns New array of MediaFiles with clip removed
 */
function _deleteClipFromTimeline(
  clipId: string,
  context: ActionContext
): MediaFile[] {
  const clips = context.projectState.mediaFiles;
  return clips.filter((clip) => clip.id !== clipId);
}

/**
 * Internal handler for deleting a single range from the timeline.
 * Called by delete_ranges_from_timeline for each range.
 *
 * Algorithm:
 * 1. Validate range parameters
 * 2. Find all clips that overlap with the deletion range
 * 3. For each overlapping clip:
 *    - Fully contained: delete entirely
 *    - Starts before range: split at rangeStart, keep left part
 *    - Ends after range: split at rangeEnd, keep right part
 *    - Spans entire range: split twice, keep both outer parts
 * 4. Perform ripple delete: shift all clips after rangeEnd
 * 5. Update Redux state
 */
export const _delete_single_range_from_timeline: ActionHandler = async (
  parameters,
  context
) => {
  const { projectState, dispatch } = context;

  console.log(
    `🗑️ delete_range_from_timeline: Starting with parameters:`,
    parameters
  );
  console.log(
    `🗑️ delete_range_from_timeline: Current timeline has ${projectState.mediaFiles.length} media files`
  );

  try {
    const { rangeStart, rangeEnd } = parameters;

    // Validate parameters
    if (rangeStart >= rangeEnd) {
      console.error(
        `🗑️ delete_range_from_timeline: Invalid range ${rangeStart}-${rangeEnd}s`
      );
      return {
        success: false,
        error: `rangeStart (${rangeStart}) must be less than rangeEnd (${rangeEnd})`,
      };
    }

    console.log(
      `🗑️ delete_range_from_timeline: Deleting range ${rangeStart}-${rangeEnd}s`
    );

    let updatedMediaFiles = [...projectState.mediaFiles];
    const deletedClipIds: string[] = [];
    const createdClipIds: string[] = [];
    const affectedClipIds: string[] = [];

    // Step 1: Find all clips that overlap with the deletion range
    const overlappingClips = updatedMediaFiles.filter(
      (clip) => clip.positionStart < rangeEnd && clip.positionEnd > rangeStart
    );

    console.log(
      `🗑️ delete_range_from_timeline: Found ${overlappingClips.length} overlapping clips`
    );

    // Step 2: Process each overlapping clip
    for (const clip of overlappingClips) {
      const { positionStart, positionEnd, id } = clip;

      console.log(
        `🗑️ delete_range_from_timeline: Processing clip ${id} (${positionStart}-${positionEnd}s)`
      );

      // Case 1: Clip is fully contained within deletion range - delete entirely
      if (positionStart >= rangeStart && positionEnd <= rangeEnd) {
        console.log(`🗑️ delete_range_from_timeline: Fully deleting clip ${id}`);
        updatedMediaFiles = _deleteClipFromTimeline(id, {
          ...context,
          projectState: { ...projectState, mediaFiles: updatedMediaFiles },
        });
        deletedClipIds.push(id);
      }
      // Case 2: Clip spans entire deletion range - split twice, keep outer parts
      else if (positionStart < rangeStart && positionEnd > rangeEnd) {
        console.log(
          `🗑️ delete_range_from_timeline: Clip ${id} spans entire range, splitting twice`
        );

        // Split at rangeStart to get [before, rest]
        const [beforeClip, restClip] = _splitClipAt(
          clip,
          rangeStart,
          projectState
        );
        createdClipIds.push(beforeClip.id);

        // Split rest at rangeEnd to get [middle, after]
        const [middleClip, afterClip] = _splitClipAt(
          restClip,
          rangeEnd,
          projectState
        );
        createdClipIds.push(afterClip.id);

        // Delete original, keep before and after (not middle)
        updatedMediaFiles = updatedMediaFiles.filter((c) => c.id !== id);
        updatedMediaFiles.push(beforeClip, afterClip);
        deletedClipIds.push(id);

        console.log(
          `🗑️ delete_range_from_timeline: Created clips ${beforeClip.id} and ${afterClip.id}`
        );
      }
      // Case 3: Clip starts before range but ends within it - keep left part
      else if (positionStart < rangeStart && positionEnd <= rangeEnd) {
        console.log(
          `🗑️ delete_range_from_timeline: Clip ${id} starts before range, keeping left part`
        );

        const [beforeClip, afterClip] = _splitClipAt(
          clip,
          rangeStart,
          projectState
        );
        createdClipIds.push(beforeClip.id);

        // Delete original, keep only the before part
        updatedMediaFiles = updatedMediaFiles.filter((c) => c.id !== id);
        updatedMediaFiles.push(beforeClip);
        deletedClipIds.push(id);

        console.log(
          `🗑️ delete_range_from_timeline: Created clip ${beforeClip.id}`
        );
      }
      // Case 4: Clip starts within range but ends after it - keep right part
      else if (positionStart >= rangeStart && positionEnd > rangeEnd) {
        console.log(
          `🗑️ delete_range_from_timeline: Clip ${id} ends after range, keeping right part`
        );

        const [beforeClip, afterClip] = _splitClipAt(
          clip,
          rangeEnd,
          projectState
        );
        createdClipIds.push(afterClip.id);

        // Delete original, keep only the after part
        updatedMediaFiles = updatedMediaFiles.filter((c) => c.id !== id);
        updatedMediaFiles.push(afterClip);
        deletedClipIds.push(id);

        console.log(
          `🗑️ delete_range_from_timeline: Created clip ${afterClip.id}`
        );
      }
    }

    // Step 3: Ripple delete - shift all clips after rangeEnd
    const rippleAmount = rangeEnd - rangeStart;
    console.log(
      `🗑️ delete_range_from_timeline: Applying ripple delete, shifting clips by -${rippleAmount}s`
    );

    updatedMediaFiles = updatedMediaFiles.map((clip) => {
      // Only shift clips that start at or after rangeEnd
      if (clip.positionStart >= rangeEnd) {
        affectedClipIds.push(clip.id);
        return {
          ...clip,
          positionStart: clip.positionStart - rippleAmount,
          positionEnd: clip.positionEnd - rippleAmount,
        };
      }
      return clip;
    });

    console.log(
      `🗑️ delete_range_from_timeline: Shifted ${affectedClipIds.length} clips`
    );

    // Step 4: Update Redux state
    dispatch(setMediaFiles(updatedMediaFiles));
    console.log(
      `🗑️ delete_range_from_timeline: Updated timeline, now has ${updatedMediaFiles.length} media files`
    );

    // Calculate new duration
    const mediaDurations = updatedMediaFiles.map((v) => v.positionEnd);
    const textDurations = projectState.textElements.map((v) => v.positionEnd);
    const duration = Math.max(0, ...mediaDurations, ...textDurations);

    console.log(
      `🗑️ delete_range_from_timeline: New timeline duration: ${duration}s`
    );

    return {
      success: true,
      deletedClipIds,
      createdClipIds,
      affectedClipIds,
      timeline: {
        mediaFiles: updatedMediaFiles,
        textElements: projectState.textElements,
        duration,
      },
    };
  } catch (error) {
    console.error(`🗑️ delete_range_from_timeline: Exception occurred:`, error);
    return {
      success: false,
      error: `Failed to delete range from timeline: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

/**
 * Schema for backend registration - delete multiple ranges from timeline
 */
export const delete_ranges_from_timeline_schema: ActionSchema = {
  name: "delete_ranges_from_timeline",
  description:
    "Delete one or more time ranges from the timeline (e.g., removing silence segments). Ranges are processed right-to-left to ensure position accuracy, with ripple deletion closing gaps after each removal. For a single range, provide a 1-item array.",
  parameters: {
    type: "object",
    properties: {
      ranges: {
        type: "array",
        description: "Array of one or more time ranges to delete",
        items: {
          type: "object",
          description: "A time range to delete from the timeline",
          properties: {
            rangeStart: {
              type: "number",
              description: "Timeline position where deletion starts (seconds)",
            },
            rangeEnd: {
              type: "number",
              description: "Timeline position where deletion ends (seconds)",
            },
          },
        },
      },
    },
    required: ["ranges"],
  },
  returns: {
    type: "object",
    description:
      "Result with per-range details and aggregate deletion stats and final timeline state",
    properties: {
      success: {
        type: "boolean",
        description: "Whether all deletions succeeded",
      },
      results: {
        type: "array",
        description: "Individual result for each range",
        items: {
          type: "object",
          description: "Result of deleting a single range",
          properties: {
            rangeIndex: {
              type: "number",
              description: "Index in input array",
            },
            success: {
              type: "boolean",
              description: "Whether this range deletion succeeded",
            },
            rangeStart: {
              type: "number",
              description: "Original range start position",
            },
            rangeEnd: {
              type: "number",
              description: "Original range end position",
            },
            deletedClipIds: {
              type: "array",
              description: "IDs of clips deleted in this range",
            },
            createdClipIds: {
              type: "array",
              description: "IDs of clips created from splitting in this range",
            },
            error: {
              type: "string",
              description: "Error if failed",
            },
          },
        },
      },
      rangesProcessed: {
        type: "number",
        description: "Number of ranges successfully deleted",
      },
      totalDeletedClipIds: {
        type: "array",
        description: "IDs of all deleted clips across all ranges",
      },
      totalCreatedClipIds: {
        type: "array",
        description:
          "IDs of all newly created clips from splitting across all ranges",
      },
      affectedClipIds: {
        type: "array",
        description: "IDs of clips shifted by ripple deletions",
      },
      timeline: {
        type: "object",
        description: "Final timeline state",
      },
      error: {
        type: "string",
        description: "Error if failure",
      },
    },
    required: ["success"],
  },
};

/**
 * Handler implementation for delete_ranges_from_timeline action
 *
 * Deletes multiple ranges by processing them right-to-left to ensure
 * earlier deletions don't affect later range positions.
 */
export const delete_ranges_from_timeline: ActionHandler = async (
  parameters,
  context
) => {
  console.log(
    `🗑️ delete_ranges_from_timeline: Starting with ${parameters.ranges.length} ranges`
  );

  try {
    // Validate ranges
    const validRanges = parameters.ranges.filter((r: any) => {
      if (r.rangeStart >= r.rangeEnd) {
        console.warn(`🗑️ Skipping invalid range ${r.rangeStart}-${r.rangeEnd}`);
        return false;
      }
      return true;
    });

    if (validRanges.length === 0) {
      return { success: false, error: "No valid ranges provided" };
    }

    // Sort ranges by start time, then REVERSE (process right-to-left)
    const sortedRanges = validRanges
      .map((r: any, originalIndex: number) => ({ ...r, originalIndex }))
      .sort((a: any, b: any) => a.rangeStart - b.rangeStart)
      .reverse();

    console.log(
      `🗑️ delete_ranges_from_timeline: Processing ${sortedRanges.length} valid ranges in reverse order`
    );

    let currentContext = context;
    const results = [];
    const allDeletedClipIds: string[] = [];
    const allCreatedClipIds: string[] = [];
    const allAffectedClipIds: string[] = [];
    let rangesProcessed = 0;
    let overallSuccess = true;

    // Call the single delete function for each range (right to left)
    for (const range of sortedRanges) {
      const result = await _delete_single_range_from_timeline(
        { rangeStart: range.rangeStart, rangeEnd: range.rangeEnd },
        currentContext
      );

      results.push({
        rangeIndex: range.originalIndex,
        success: result.success,
        rangeStart: range.rangeStart,
        rangeEnd: range.rangeEnd,
        deletedClipIds: result.deletedClipIds || [],
        createdClipIds: result.createdClipIds || [],
        error: result.error,
      });

      if (!result.success) {
        overallSuccess = false;
        console.warn(
          `🗑️ Range ${range.rangeStart}-${range.rangeEnd} failed: ${result.error}`
        );
        // Continue processing other ranges instead of returning early
      } else {
        rangesProcessed++;
        // Accumulate results
        allDeletedClipIds.push(...(result.deletedClipIds || []));
        allCreatedClipIds.push(...(result.createdClipIds || []));
        allAffectedClipIds.push(...(result.affectedClipIds || []));
      }

      // Update context for next iteration
      currentContext = {
        ...context,
        projectState: {
          ...context.projectState,
          mediaFiles:
            result.timeline?.mediaFiles ||
            currentContext.projectState.mediaFiles,
          textElements:
            result.timeline?.textElements ||
            currentContext.projectState.textElements,
        },
      };
    }

    // Sort results back to original order
    results.sort((a, b) => a.rangeIndex - b.rangeIndex);

    const finalMediaFiles = currentContext.projectState.mediaFiles;
    const mediaDurations = finalMediaFiles.map((v) => v.positionEnd);
    const textDurations = currentContext.projectState.textElements.map(
      (v) => v.positionEnd
    );
    const duration = Math.max(0, ...mediaDurations, ...textDurations);

    console.log(
      `🗑️ delete_ranges_from_timeline: Completed ${rangesProcessed}/${sortedRanges.length} deletions`
    );

    return {
      success: overallSuccess,
      results,
      rangesProcessed,
      totalDeletedClipIds: allDeletedClipIds,
      totalCreatedClipIds: allCreatedClipIds,
      affectedClipIds: allAffectedClipIds,
      timeline: {
        mediaFiles: finalMediaFiles,
        textElements: currentContext.projectState.textElements,
        duration,
      },
    };
  } catch (error) {
    console.error(`🗑️ delete_ranges_from_timeline: Exception:`, error);
    return {
      success: false,
      error: `Failed to delete ranges: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
