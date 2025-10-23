"use client";

interface AssistantPanelProps {
  contentType: "broll" | "silence" | "similar" | null;
  brollCommand: {
    Panel: () => JSX.Element;
  };
  // Add more command types here as they're implemented
  // silenceCommand?: { Panel: () => JSX.Element };
  // similarCommand?: { Panel: () => JSX.Element };
}

export default function AssistantPanel({
  contentType,
  brollCommand,
}: AssistantPanelProps) {
  // Render specific command panel based on content type
  switch (contentType) {
    case "broll":
      return <brollCommand.Panel />;
    
    case "silence":
      return (
        <div className="overflow-y-auto h-full bg-white dark:bg-gray-800">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Remove Silence
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Coming soon
            </p>
          </div>
        </div>
      );
    
    case "similar":
      return (
        <div className="overflow-y-auto h-full bg-white dark:bg-gray-800">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Find Similar Clips
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Coming soon
            </p>
          </div>
        </div>
      );
    
    default:
      // Empty state when no command is active
      return (
        <div className="overflow-y-auto h-full bg-white dark:bg-gray-800">
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-gray-500 dark:text-gray-400 text-center">
              No active assistant command.<br />
              Run a command from the timeline to see results here.
            </p>
          </div>
        </div>
      );
  }
}

