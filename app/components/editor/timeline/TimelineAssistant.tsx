"use client";
import { useState, useEffect, useRef } from "react";
import { useAppSelector } from "@/app/store";

type AssistantMode = "edit" | "plan" | "assistant";

interface TimelineAssistantProps {
  isConnected: boolean;
  onSendMessage: (message: string, mode: AssistantMode) => void;
  onSwitchLLM?: (provider: string, model: string) => void;
  currentLLM?: { provider: string; model: string } | null;
}

export default function TimelineAssistant({
  isConnected,
  onSendMessage,
  onSwitchLLM,
  currentLLM,
}: TimelineAssistantProps) {
  const { currentTime, selectedRangeStart, selectedRangeEnd } = useAppSelector(
    (state) => state.projectState
  );
  const [inputValue, setInputValue] = useState("");
  const [isLLMDropdownOpen, setIsLLMDropdownOpen] = useState(false);
  const llmDropdownRef = useRef<HTMLDivElement>(null);

  // Close LLM dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        llmDropdownRef.current &&
        !llmDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLLMDropdownOpen(false);
      }
    };

    if (isLLMDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isLLMDropdownOpen]);

  // Format seconds to timecode (MM:SS)
  const formatTimecode = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get timecode display based on selection or playhead
  const getTimecodeDisplay = (): string => {
    if (selectedRangeStart !== undefined && selectedRangeEnd !== undefined) {
      return `${formatTimecode(selectedRangeStart)} - ${formatTimecode(selectedRangeEnd)}`;
    }
    return formatTimecode(currentTime);
  };

  const sendMessage = () => {
    if (!inputValue.trim() || !isConnected) {
      return;
    }

    onSendMessage(inputValue, "assistant");
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Helper function to get short display name for LLM
  const getLLMDisplayName = (model: string | undefined) => {
    return model || "LLM";
  };

  return (
    <div className="w-full bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-3 flex justify-center">
      <div className="w-[50%] flex items-center gap-3">
        {/* Timecode Display */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md min-w-[140px]">
          <svg
            width="14"
            height="15"
            viewBox="0 0 14 15"
            xmlns="http://www.w3.org/2000/svg"
            className="text-gray-500 dark:text-gray-400"
          >
            <path
              d="M5 1.29V1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v.29a7 7 0 1 1-4 0zM7 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zm.833-5.963v.387L9.289 9.38a.75.75 0 1 1-1.06 1.06L6.332 8.546V5.344a.75.75 0 0 1 1.5 0v2.193z"
              fill="currentColor"
            />
          </svg>
          <span className="text-xs text-gray-600 dark:text-gray-300 font-mono">
            {getTimecodeDisplay()}
          </span>
        </div>

        {/* Text Input */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask AI assistant..."
          disabled={!isConnected}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   disabled:opacity-50 disabled:cursor-not-allowed
                   text-sm"
        />

        {/* LLM Selector Dropdown */}
        {onSwitchLLM && (
          <div className="relative" ref={llmDropdownRef}>
            <button
              onClick={() => setIsLLMDropdownOpen(!isLLMDropdownOpen)}
              disabled={!isConnected}
              className="flex items-center gap-1 px-3 py-2 text-xs
                         text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800
                         border border-gray-300 dark:border-gray-600 rounded-md
                         hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300
                         focus:outline-none focus:ring-1 focus:ring-blue-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-200 min-w-[120px]"
              title={
                currentLLM
                  ? `${currentLLM.provider}: ${currentLLM.model}`
                  : "Select LLM"
              }
            >
              <span className="font-mono flex-1 text-left">
                {getLLMDisplayName(currentLLM?.model)}
              </span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${
                  isLLMDropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* LLM Dropdown Menu */}
            {isLLMDropdownOpen && (
              <div
                className="absolute bottom-full left-0 mb-2 py-1 bg-white dark:bg-gray-800 
                                border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[180px]"
              >
                <button
                  onClick={() => {
                    onSwitchLLM("azure_openai", "gpt-4.1");
                    setIsLLMDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left
                                ${
                                  currentLLM?.model === "gpt-4.1"
                                    ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }
                                transition-colors duration-150`}
                >
                  <span>GPT-4.1</span>
                  {currentLLM?.model === "gpt-4.1" && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => {
                    onSwitchLLM("gemini", "gemini-2.5-pro");
                    setIsLLMDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left
                                ${
                                  currentLLM?.model === "gemini-2.5-pro"
                                    ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }
                                transition-colors duration-150`}
                >
                  <span>Gemini-2.5-Pro</span>
                  {currentLLM?.model === "gemini-2.5-pro" && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => {
                    onSwitchLLM("gemini", "gemini-2.5-flash");
                    setIsLLMDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left
                                ${
                                  currentLLM?.model === "gemini-2.5-flash"
                                    ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }
                                transition-colors duration-150`}
                >
                  <span>Gemini-2.5-Flash</span>
                  {currentLLM?.model === "gemini-2.5-flash" && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={sendMessage}
          disabled={!isConnected || !inputValue.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md
                   hover:bg-blue-600 active:bg-blue-700
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500
                   transition-colors duration-200 text-sm font-medium
                   flex items-center gap-2"
          title="Send message"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}

