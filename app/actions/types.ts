import { AppDispatch } from "@/app/store";
import { ProjectState } from "@/app/types";

/**
 * TIMING CONVENTION:
 * All time-related values in actions use SECONDS (not milliseconds) as floating-point numbers.
 * Examples: 5.0, 5.5, 10.25
 * This matches the frontend's timing system throughout the application.
 */

/**
 * Context provided to all action handlers
 */
export interface ActionContext {
  projectState: ProjectState;
  dispatch: AppDispatch;
}

/**
 * Base result interface - all actions must return this structure
 */
export interface ActionResult {
  success: boolean;
  error?: string;
  [key: string]: any; // Additional action-specific data
}

/**
 * Action handler function type
 */
export type ActionHandler = (
  parameters: any,
  context: ActionContext
) => Promise<ActionResult>;

/**
 * Property definition for action schemas
 * MATCHES protocol requirement: each property must have type + description
 * Reference: FRONTEND_ACTION_PROTOCOL.md lines 23-26
 */
export interface PropertySchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string; // REQUIRED by protocol
  items?: PropertySchema; // For array types
  properties?: Record<string, PropertySchema>; // For nested objects
}

/**
 * Action registration schema
 * EXACTLY matches FRONTEND_ACTION_PROTOCOL.md format
 * Reference: video-agent-backend/FRONTEND_ACTION_PROTOCOL.md lines 14-41
 */
export interface ActionSchema {
  name: string; // Unique action name (camelCase)
  description: string; // Clear description for the LLM
  parameters: {
    type: "object";
    properties: Record<string, PropertySchema>; // Each has type + description
    required: string[]; // List of required parameter names
  };
  returns: {
    type: "object";
    description: string; // REQUIRED by protocol (line 32)
    properties: Record<string, PropertySchema>; // Each has type + description
    required: string[]; // Must include at least ["success"]
  };
}
