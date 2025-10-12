"use client";

interface CenterViewTabsProps {
  activeView: "preview" | "storyboard";
  onViewChange: (view: "preview" | "storyboard") => void;
  hasStoryboard: boolean;
}

export default function CenterViewTabs({ 
  activeView, 
  onViewChange, 
  hasStoryboard 
}: CenterViewTabsProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
      <div className="flex items-center gap-1">
        {/* Preview Tab */}
        <button
          onClick={() => onViewChange("preview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all ${
            activeView === "preview"
              ? "bg-gray-900 text-white border-b-2 border-blue-500"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Preview
        </button>

        {/* Storyboard Tab */}
        <button
          onClick={() => onViewChange("storyboard")}
          disabled={!hasStoryboard}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all ${
            activeView === "storyboard"
              ? "bg-gray-900 text-white border-b-2 border-purple-500"
              : hasStoryboard
              ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
              : "text-gray-600 cursor-not-allowed opacity-50"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Storyboard
        </button>
      </div>

      {/* New Plan Badge */}
      {hasStoryboard && activeView === "preview" && (
        <span className="px-2 py-1 text-xs bg-purple-600 text-white rounded-full animate-pulse">
          New Plan
        </span>
      )}
    </div>
  );
}

