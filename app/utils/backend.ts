import {
  FileInfo,
  TimelineContext,
  TimelineClip,
  ProjectState,
  MediaFile,
  TextElement,
} from "../types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error("Backend health check failed:", error);
    return false;
  }
}

export async function connectToBackend(): Promise<boolean> {
  console.log("Checking backend connection...");
  const isHealthy = await checkBackendHealth();

  if (isHealthy) {
    console.log("✅ Backend is connected and healthy");
  } else {
    console.log("❌ Backend is not available");
  }

  return isHealthy;
}

export async function createProjectInBackend(
  projectId: string,
  projectName: string,
  directoryPath: string,
  sourceFiles: FileInfo[] = []
): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: projectId,
        projectName: projectName,
        directoryPath: directoryPath,
        sourceFiles: sourceFiles,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Project registered with backend successfully");
      console.log("📝 Backend response:", result);
      return true;
    } else {
      console.error(
        "❌ Failed to register project with backend:",
        response.statusText
      );
      return false;
    }
  } catch (error) {
    console.error("❌ Error registering project with backend:", error);
    return false;
  }
}

export async function deleteProjectFromBackend(
  projectId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/v1/projects/${projectId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Project deleted from backend successfully");
      console.log("📝 Backend response:", result);
      return true;
    } else {
      console.error(
        "❌ Failed to delete project from backend:",
        response.statusText
      );
      return false;
    }
  } catch (error) {
    console.error("❌ Error deleting project from backend:", error);
    return false;
  }
}

export function getWebSocketUrl(projectId: string): string {
  const wsUrl = BACKEND_URL.replace("http://", "ws://").replace(
    "https://",
    "wss://"
  );
  return `${wsUrl}/api/v1/ws/${projectId}`;
}

export function createWebSocketConnection(projectId: string): WebSocket {
  const wsUrl = getWebSocketUrl(projectId);
  console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
  return new WebSocket(wsUrl);
}

/**
 * Converts the frontend project state into a clean timeline context for backend communication
 */
export function buildTimelineContext(
  projectState: ProjectState,
  currentTime: number
): TimelineContext {
  const timelineClips: TimelineClip[] = [];

  // Convert media files (video/audio) to TimelineClip format
  projectState.mediaFiles.forEach((media: MediaFile) => {
    // Find the alias for this media file from sourceFiles
    const sourceFile = projectState.sourceFiles.find(
      (sf) => sf.fileId === media.fileId
    );
    const alias = sourceFile?.alias;

    timelineClips.push({
      clipId: media.id,
      sourceFileAlias: alias, // e.g., "video-1", "audio-1"
      track: media.track, // Pass track info to backend
      timelineStartMs: media.positionStart * 1000, // Convert seconds to ms
      timelineEndMs: media.positionEnd * 1000,
      sourceStartMs: media.startTime * 1000,
      sourceEndMs: media.endTime * 1000,
      // text field omitted for media clips
    });
  });

  // Convert text elements to TimelineClip format
  projectState.textElements.forEach((text: TextElement) => {
    timelineClips.push({
      clipId: text.id,
      // sourceFileAlias omitted for text elements
      track: "text", // Pass track info (default to "text")
      timelineStartMs: text.positionStart * 1000,
      timelineEndMs: text.positionEnd * 1000,
      sourceStartMs: 0, // Text doesn't have source timing
      sourceEndMs: 0,
      text: text.text,
    });
  });

  // Sort clips by timeline start position
  timelineClips.sort((a, b) => a.timelineStartMs - b.timelineStartMs);

  return {
    timeline: timelineClips,
    playheadPositionMs: currentTime * 1000, // Convert seconds to ms
    totalDurationMs: projectState.duration * 1000,
  };
}

export { BACKEND_URL };
