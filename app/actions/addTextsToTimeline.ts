import { setTextElements } from "@/app/store/slices/projectSlice";
import { TextElement } from "@/app/types";
import { generateNextClipId } from "@/app/utils/utils";
import { ActionHandler, ActionSchema } from "./types";

/**
 * Internal handler for adding a single text element to the timeline.
 * Called by add_texts_to_timeline for each text element.
 *
 * This follows the same pattern as AddText.tsx but with custom parameters
 * from the backend agent.
 */
export const _add_single_text_to_timeline: ActionHandler = async (
  parameters,
  context
) => {
  const { projectState, dispatch } = context;

  console.log(
    `📝 add_single_text_to_timeline: Starting with parameters:`,
    parameters
  );
  console.log(
    `📝 add_single_text_to_timeline: Current timeline has ${projectState.textElements.length} text elements`
  );

  try {
    // Generate unique text element ID
    const textId = generateNextClipId(
      [...projectState.mediaFiles, ...projectState.textElements],
      "text"
    );

    console.log(`📝 add_single_text_to_timeline: Generated text ID: ${textId}`);

    // Create new TextElement with defaults from AddText.tsx
    const newTextElement: TextElement = {
      id: textId,
      text: parameters.text,
      positionStart: parameters.timelineStart,
      positionEnd: parameters.timelineEnd,

      // Position & Size - use parameters or defaults
      x: parameters.x ?? 600,
      y: parameters.y ?? 500,
      width: parameters.width,
      height: parameters.height,

      // Styling - use parameters or defaults
      font: parameters.font ?? "Arial",
      fontSize: parameters.fontSize ?? 48,
      color: parameters.color ?? "#ffffff",
      backgroundColor: parameters.backgroundColor ?? "transparent",
      align: parameters.align ?? "center",

      // Effects - use parameters or defaults
      zIndex: parameters.zIndex ?? 10,
      opacity: parameters.opacity ?? 100,
      rotation: parameters.rotation ?? 0,
      fadeInDuration: parameters.fadeInDuration,
      fadeOutDuration: parameters.fadeOutDuration,
      animation: parameters.animation ?? "none",

      // Track assignment
      track: "text",
      includeInMerge: true,
    };

    console.log(
      `📝 add_single_text_to_timeline: Created TextElement with id ${textId}, timeline: ${parameters.timelineStart}-${parameters.timelineEnd}s`
    );

    // Update state (like AddText.tsx:30)
    const updatedTextElements = [...projectState.textElements, newTextElement];
    dispatch(setTextElements(updatedTextElements));

    console.log(
      `📝 add_single_text_to_timeline: Dispatched state update, timeline now has ${updatedTextElements.length} text elements`
    );

    // Calculate duration (same logic as projectSlice.ts:37-44)
    const mediaDurations = projectState.mediaFiles.map((v) => v.positionEnd);
    const textDurations = updatedTextElements.map((v) => v.positionEnd);
    const duration = Math.max(0, ...mediaDurations, ...textDurations);

    console.log(
      `📝 add_single_text_to_timeline: Calculated new timeline duration: ${duration}s`
    );

    return {
      success: true,
      textElementId: textId,
      timeline: {
        mediaFiles: projectState.mediaFiles,
        textElements: updatedTextElements,
        duration: duration,
      },
    };
  } catch (error) {
    console.error(`📝 add_single_text_to_timeline: Exception occurred:`, error);
    return {
      success: false,
      error: `Failed to add text: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

/**
 * Schema for backend registration - add multiple text elements
 */
export const add_texts_to_timeline_schema: ActionSchema = {
  name: "add_texts_to_timeline",
  description:
    "Add one or more text overlays to the timeline. Each text element can have custom timing, positioning, and styling. Text elements are independent and can overlap or appear at different times.",
  parameters: {
    type: "object",
    properties: {
      texts: {
        type: "array",
        description:
          "Array of one or more text elements to add to the timeline",
        items: {
          type: "object",
          description: "A text element to add to the timeline",
          properties: {
            text: {
              type: "string",
              description: "The text content to display",
            },
            timelineStart: {
              type: "number",
              description: "Start time in seconds when text appears",
            },
            timelineEnd: {
              type: "number",
              description: "End time in seconds when text disappears",
            },
            x: {
              type: "number",
              description:
                "Optional: Horizontal position in pixels. Default: 600 (centered). Canvas is 1920x1080.",
            },
            y: {
              type: "number",
              description:
                "Optional: Vertical position in pixels. Default: 500 (centered). Canvas is 1920x1080.",
            },
            fontSize: {
              type: "number",
              description: "Optional: Font size in pixels. Default: 48",
            },
            color: {
              type: "string",
              description:
                "Optional: Text color as hex code (e.g., '#ffffff', '#ff0000'). Default: '#ffffff' (white)",
            },
            backgroundColor: {
              type: "string",
              description:
                "Optional: Background color as hex code or 'transparent'. Default: 'transparent'",
            },
            font: {
              type: "string",
              description:
                "Optional: Font family (e.g., 'Arial', 'Roboto', 'Inter'). Default: 'Arial'",
            },
            align: {
              type: "string",
              description:
                "Optional: Text alignment ('left', 'center', 'right'). Default: 'center'",
            },
            opacity: {
              type: "number",
              description:
                "Optional: Opacity from 0-100. Default: 100 (fully opaque)",
            },
            zIndex: {
              type: "number",
              description:
                "Optional: Layer order (higher = on top). Default: 10",
            },
          },
        },
      },
    },
    required: ["texts"],
  },
  returns: {
    type: "object",
    description: "Result with per-text details and final timeline state",
    properties: {
      success: {
        type: "boolean",
        description: "Whether all text elements were added successfully",
      },
      results: {
        type: "array",
        description: "Individual result for each text element",
        items: {
          type: "object",
          description: "Result of adding a single text element",
          properties: {
            textIndex: {
              type: "number",
              description: "Index in input array",
            },
            success: {
              type: "boolean",
              description: "Whether this text element succeeded",
            },
            textElementId: {
              type: "string",
              description: "Created text element ID",
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
              description: "Error message if failed",
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
        description: "Error message if overall failure",
      },
    },
    required: ["success"],
  },
};

/**
 * Handler implementation for add_texts_to_timeline action
 *
 * Adds multiple text elements to the timeline independently.
 */
export const add_texts_to_timeline: ActionHandler = async (
  parameters,
  context
) => {
  console.log(
    `📝 add_texts_to_timeline: Starting with ${parameters.texts.length} text elements`
  );

  const results = [];
  let overallSuccess = true;
  let currentContext = context;

  for (let i = 0; i < parameters.texts.length; i++) {
    const textParams = parameters.texts[i];

    const result = await _add_single_text_to_timeline(
      textParams,
      currentContext
    );

    results.push({
      textIndex: i,
      success: result.success,
      textElementId: result.textElementId,
      timelineStart: textParams.timelineStart,
      timelineEnd: textParams.timelineEnd,
      error: result.error,
    });

    if (!result.success) {
      overallSuccess = false;
      console.warn(`📝 Text ${i} failed: ${result.error}`);
    }

    // Update context with new state for next iteration
    currentContext = {
      ...context,
      projectState: {
        ...context.projectState,
        textElements:
          result.timeline?.textElements || context.projectState.textElements,
      },
    };
  }

  const finalTextElements = currentContext.projectState.textElements;
  const mediaDurations = context.projectState.mediaFiles.map(
    (v) => v.positionEnd
  );
  const textDurations = finalTextElements.map((v) => v.positionEnd);
  const duration = Math.max(0, ...mediaDurations, ...textDurations);

  console.log(
    `📝 add_texts_to_timeline: Completed. Success: ${overallSuccess}, ${
      results.filter((r) => r.success).length
    }/${results.length} text elements added`
  );

  return {
    success: overallSuccess,
    results,
    timeline: {
      mediaFiles: context.projectState.mediaFiles,
      textElements: finalTextElements,
      duration,
    },
  };
};
