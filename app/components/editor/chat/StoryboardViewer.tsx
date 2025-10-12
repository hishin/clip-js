"use client";

interface StoryboardViewerProps {
  htmlContent: string;
  summary: string;
}

export default function StoryboardViewer({ htmlContent, summary }: StoryboardViewerProps) {
  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Simple Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-700 bg-gray-800">
        <svg 
          className="w-6 h-6 text-purple-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
          />
        </svg>
        <div>
          <h3 className="font-semibold text-lg text-white">Video Storyboard</h3>
          <p className="text-sm text-gray-400">{summary}</p>
        </div>
      </div>

      {/* Storyboard Content - No sanitization, trusted backend */}
      <div 
        className="flex-1 overflow-auto p-6 storyboard-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}

