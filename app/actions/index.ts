import { ActionHandler, ActionSchema, ActionContext } from "./types";
import {
  _insert_single_clip_in_timeline,
  insert_clips_in_timeline,
  insert_clips_in_timeline_schema,
} from "./insertClipInTimeline";
import {
  _delete_single_range_from_timeline,
  delete_ranges_from_timeline,
  delete_ranges_from_timeline_schema,
} from "./deleteRangeFromTimeline";

// Import other actions as you create them

/**
 * Registry of all action handlers
 * Maps action name to its implementation function
 *
 * Note: Internal single-operation functions (prefixed with _) are registered
 * but not exposed to the backend. They are used internally by multi-operation functions.
 */
export const actionHandlers: Record<string, ActionHandler> = {
  // Internal single operations (not exposed to backend)
  _insert_single_clip_in_timeline,
  _delete_single_range_from_timeline,
  // Multi operations (exposed to backend)
  insert_clips_in_timeline,
  delete_ranges_from_timeline,
  // Add more actions here
};

/**
 * Schemas for backend registration
 * These are sent to the backend when the WebSocket connects
 *
 * Note: Only multi-operation schemas are exposed to simplify LLM tool selection.
 * Single-operation functions are internal helpers only.
 */
export const actionSchemas: ActionSchema[] = [
  insert_clips_in_timeline_schema,
  delete_ranges_from_timeline_schema,
  // Add more schemas here
];

/**
 * Execute an action by name
 *
 * @param actionName - Name of the action to execute
 * @param parameters - Parameters to pass to the action
 * @param context - Context containing projectState, dispatch, and ws
 * @returns ActionResult with success status and data
 */
export async function executeAction(
  actionName: string,
  parameters: any,
  context: ActionContext
) {
  const handler = actionHandlers[actionName];

  if (!handler) {
    return {
      success: false,
      error: `Unknown action: ${actionName}`,
    };
  }

  return await handler(parameters, context);
}

// Re-export types for convenience
export type {
  ActionHandler,
  ActionSchema,
  ActionContext,
  ActionResult,
  PropertySchema,
} from "./types";
