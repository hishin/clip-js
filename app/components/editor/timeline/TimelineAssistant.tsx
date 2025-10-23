"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAppSelector } from "@/app/store";

type AssistantMode = "edit" | "plan" | "assistant";

interface TimelineAssistantProps {
  isConnected: boolean;
  onSendMessage: (message: string, mode: AssistantMode) => void;
  onSwitchLLM?: (provider: string, model: string) => void;
  currentLLM?: { provider: string; model: string } | null;
  commandHandlers?: {
    suggestBRoll?: () => void;
    removeSilence?: () => void;
    autoBleep?: () => void;
    findSimilar?: () => void;
    addMusic?: () => void;
    vibeEdit?: () => void;
  };
}

interface Command {
  id: string;
  label: string;
  description: string;
  handler: () => void;
}

export default function TimelineAssistant({
  isConnected,
  onSendMessage,
  onSwitchLLM,
  currentLLM,
  commandHandlers,
}: TimelineAssistantProps) {
  const { currentTime, selectedRangeStart, selectedRangeEnd } = useAppSelector(
    (state) => state.projectState
  );
  const [inputValue, setInputValue] = useState("");
  const [isLLMDropdownOpen, setIsLLMDropdownOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const llmDropdownRef = useRef<HTMLDivElement>(null);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Command handlers (skeleton implementations)
  const handleSuggestBRoll = useCallback(() => {
    console.log('Suggest B-Roll command executed');
    commandHandlers?.suggestBRoll?.();
    setIsCommandPaletteOpen(false);
  }, [commandHandlers]);

  const handleFindSimilarClips = useCallback(() => {
    // TODO: Implement find similar clips logic
    console.log('Find similar clips command executed');
    setIsCommandPaletteOpen(false);
  }, []);

  const handleRemoveSilence = useCallback(() => {
    // TODO: Implement remove silence logic
    console.log('Remove silence command executed');
    setIsCommandPaletteOpen(false);
  }, []);

  const handleAddBackgroundMusic = useCallback(() => {
    // TODO: Implement add background music logic
    console.log('Add background music command executed');
    setIsCommandPaletteOpen(false);
  }, []);

  const handleAutoBleep = useCallback(() => {
    // TODO: Implement auto bleep logic
    console.log('Auto bleep command executed');
    setIsCommandPaletteOpen(false);
  }, []);

  const handleVibeEdit = useCallback(() => {
    // TODO: Implement vibe edit logic
    console.log('Vibe Edit command executed');
    setIsCommandPaletteOpen(false);
  }, []);

  // Define available commands
  const commands: Command[] = useMemo(() => [
    {
      id: 'suggest-broll',
      label: 'Suggest B-Roll',
      description: 'Get suggestions for B-Roll footage',
      handler: handleSuggestBRoll,
    },
    {
      id: 'find-similar',
      label: 'Find similar clips',
      description: 'Find clips similar to the selected one',
      handler: handleFindSimilarClips,
    },
    {
      id: 'remove-silence',
      label: 'Remove silence',
      description: 'Automatically remove silent sections',
      handler: handleRemoveSilence,
    },
    {
      id: 'add-music',
      label: 'Add background music',
      description: 'Add background music to your video',
      handler: handleAddBackgroundMusic,
    },
    {
      id: 'auto-bleep',
      label: 'Auto bleep',
      description: 'Automatically bleep profanity',
      handler: handleAutoBleep,
    },
    {
      id: 'vibe-edit',
      label: 'Vibe Edit',
      description: 'Vibe edit your timeline with natural language prompts',
      handler: handleVibeEdit,
    },
  ], [handleSuggestBRoll, handleFindSimilarClips, handleRemoveSilence, handleAddBackgroundMusic, handleAutoBleep, handleVibeEdit]);

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

  // Close command palette when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsCommandPaletteOpen(false);
      }
    };

    if (isCommandPaletteOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isCommandPaletteOpen]);

  // Filter commands when input changes
  useEffect(() => {
    // TODO: Implement fuzzy search using lightweight LLM
    // For now, return all commands (no filtering)
    setFilteredCommands(commands);
    setSelectedCommandIndex(0); // Reset selection when commands change
  }, [inputValue, commands]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle command palette keyboard navigation
    if (isCommandPaletteOpen && filteredCommands.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedCommandIndex((prev) => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedCommandIndex((prev) => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedCommandIndex]) {
            filteredCommands[selectedCommandIndex].handler();
          }
          return;
        case "Escape":
          e.preventDefault();
          setIsCommandPaletteOpen(false);
          return;
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Helper function to get short display name for LLM
  const getLLMDisplayName = (model: string | undefined) => {
    return model || "LLM";
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsCommandPaletteOpen(true);
  };

  // Handle input blur (with delay to allow command clicks)
  const handleInputBlur = () => {
    // Delay closing to allow clicking on commands
    setTimeout(() => {
      if (!commandPaletteRef.current?.matches(':hover')) {
        setIsCommandPaletteOpen(false);
      }
    }, 150);
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

        {/* Text Input with Command Palette */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Ask AI assistant..."
            disabled={!isConnected}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     placeholder-gray-400 dark:placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     text-sm"
          />

          {/* Command Palette */}
          {isCommandPaletteOpen && filteredCommands.length > 0 && (
            <div
              ref={commandPaletteRef}
              className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 
                       border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg 
                       overflow-hidden z-50 animate-slideUp"
            >
              <div className="max-h-[240px] overflow-y-auto">
                {filteredCommands.map((command, index) => (
                  <button
                    key={command.id}
                    onClick={(e) => {
                      e.preventDefault();
                      command.handler();
                    }}
                    className={`w-full px-4 py-2.5 text-left transition-colors duration-150
                              ${
                                index === selectedCommandIndex
                                  ? "bg-blue-50 dark:bg-blue-900 border-l-2 border-blue-500"
                                  : "hover:bg-gray-100 dark:hover:bg-gray-700 border-l-2 border-transparent"
                              }`}
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {command.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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

