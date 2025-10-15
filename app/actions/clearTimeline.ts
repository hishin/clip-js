import {
  setMediaFiles,
  setTextElements,
} from "@/app/store/slices/projectSlice";
import { ActionHandler, ActionSchema } from "./types";

/**
 * Schema for backend registration - clear timeline
 */
export const clear_timeline_schema: ActionSchema = {
  name: "clear_timeline",
  description:
    "Clear all media files and text elements from the timeline, resetting it to an empty state. Use this when the user wants to start fresh or remove all content at once.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  returns: {
    type: "object",
    description: "Result of clearing the timeline",
    properties: {
      success: {
        type: "boolean",
        description: "Whether the operation succeeded",
      },
      previousMediaCount: {
        type: "number",
        description: "Number of media files that were removed",
      },
      previousTextCount: {
        type: "number",
        description: "Number of text elements that were removed",
      },
      timeline: {
        type: "object",
        description: "Final timeline state (empty)",
      },
      error: {
        type: "string",
        description: "Error message if failed",
      },
    },
    required: ["success"],
  },
};

/**
 * Handler implementation for clear_timeline action
 *
 * Clears all media files and text elements from the timeline,
 * resetting duration to 0.
 */
export const clear_timeline: ActionHandler = async (parameters, context) => {
  const { projectState, dispatch } = context;

  console.log(`🧹 clear_timeline: Starting clear operation`);
  console.log(
    `🧹 clear_timeline: Current state - ${projectState.mediaFiles.length} media files, ${projectState.textElements.length} text elements`
  );

  try {
    const previousMediaCount = projectState.mediaFiles.length;
    const previousTextCount = projectState.textElements.length;

    // Clear both media files and text elements
    dispatch(setMediaFiles([]));
    dispatch(setTextElements([]));

    console.log(
      `🧹 clear_timeline: Cleared ${previousMediaCount} media files and ${previousTextCount} text elements`
    );

    return {
      success: true,
      previousMediaCount,
      previousTextCount,
      timeline: {
        mediaFiles: [],
        textElements: [],
        duration: 0,
      },
    };
  } catch (error) {
    console.error(`🧹 clear_timeline: Exception occurred:`, error);
    return {
      success: false,
      error: `Failed to clear timeline: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
