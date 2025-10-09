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
  filesIDToFileInfoMap: Record<string, any> = {}
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
        filesIDToFileInfoMap: filesIDToFileInfoMap,
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

export { BACKEND_URL };
