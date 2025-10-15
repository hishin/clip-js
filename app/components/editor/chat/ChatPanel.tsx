"use client";
import { useState, useEffect, useRef } from "react";
import type { StoryboardData } from "@/app/types/storyboard";
import { getStoryboard } from "@/app/store";

type ChatMode = "edit" | "plan";

export interface Message {
  id: string;
  type: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
  isStatus?: boolean;  // For agent status/reasoning messages
  storyboardData?: StoryboardData;
}

interface ChatPanelProps {
  messages: Message[];
  isConnected: boolean;
  isConnecting: boolean;
  onSendMessage: (message: string, mode: ChatMode) => void;
  onOpenPlan?: (data: StoryboardData, summary: string, messageId?: string) => void;
  onBuildPlan?: (data: StoryboardData, summary: string, mode: ChatMode, messageId?: string) => void;
  onSwitchLLM?: (provider: string, model: string) => void;
  currentLLM?: { provider: string; model: string } | null;
}

export default function ChatPanel({ 
  messages, 
  isConnected, 
  isConnecting, 
  onSendMessage,
  onOpenPlan,
  onBuildPlan,
  onSwitchLLM,
  currentLLM
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("edit");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLLMDropdownOpen, setIsLLMDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const llmDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  // Close LLM dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (llmDropdownRef.current && !llmDropdownRef.current.contains(event.target as Node)) {
        setIsLLMDropdownOpen(false);
      }
    };

    if (isLLMDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isLLMDropdownOpen]);

  const sendMessage = () => {
    if (!inputValue.trim()) {
      return;
    }

    onSendMessage(inputValue, chatMode);
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Chat
        </h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? "bg-green-500"
                : isConnecting
                ? "bg-yellow-500 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isConnected
              ? "Connected"
              : isConnecting
              ? "Connecting..."
              : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 dark:text-gray-500 text-center">
              No messages yet. Start a conversation!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.isStatus 
                  ? "justify-center" 
                  : message.type === "user" 
                  ? "justify-end" 
                  : "justify-start"
              }`}
            >
              <div
                className={`rounded-lg px-4 py-2 ${
                  message.isStatus
                    ? "bg-transparent text-gray-500 dark:text-gray-400 text-xs italic max-w-full"
                    : message.type === "user"
                    ? "bg-blue-500 text-white max-w-[80%]"
                    : message.type === "error"
                    ? "bg-red-500 text-white max-w-[80%]"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 max-w-[80%]"
                }`}
              >
                <p className={`whitespace-pre-wrap break-words ${
                  message.isStatus ? "text-xs" : "text-sm"
                }`}>
                  {message.content}
                </p>

                {/* View/Build Plan Buttons for messages with storyboardData */}
                {message.storyboardData && !message.isStatus && (
                  <div className="mt-2 flex gap-2">
                    {onOpenPlan && (
                      <button
                        onClick={() => onOpenPlan(message.storyboardData!, message.content, message.id)}
                        className="flex-1 flex items-center justify-center gap-2 
                                   px-3 py-2 bg-purple-600 hover:bg-purple-700 
                                   text-white text-sm font-medium rounded
                                   transition-colors duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                    )}
                    {onBuildPlan && (
                      <button
                        onClick={async () => {
                          // Switch to edit mode and trigger build
                          setChatMode("edit");
                          
                          // Try to get edited version from IndexedDB first
                          const savedStoryboard = await getStoryboard(message.id);
                          
                          // Use saved version if exists, otherwise use original message data
                          const dataToUse = savedStoryboard || message.storyboardData!;
                          
                          console.log(`🔨 Building from ${savedStoryboard ? 'saved (edited)' : 'original'} storyboard`);
                          onBuildPlan(dataToUse, message.content, "edit", message.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 
                                   px-3 py-2 bg-green-600 hover:bg-green-700 
                                   text-white text-sm font-medium rounded
                                   transition-colors duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Build
                      </button>
                    )}
                  </div>
                )}

                {!message.isStatus && (
                  <p
                    className={`text-xs mt-1 ${
                      message.type === "user"
                        ? "text-blue-100"
                        : message.type === "error"
                        ? "text-red-100"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area with Mode Selector and Send Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Text Input */}
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={!isConnected}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        />
        
        {/* Bottom Controls */}
        <div className="flex items-center justify-between mt-2">
          {/* Left Controls Group */}
          <div className="flex items-center gap-2">
            {/* Mode Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                         border border-gray-300 dark:border-gray-600 rounded-md
                         hover:bg-gray-200 dark:hover:bg-gray-600
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         transition-colors duration-200"
            >
              {chatMode === "edit" ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span>Plan</span>
                </>
              )}
              <svg 
                className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 py-1 bg-white dark:bg-gray-800 
                              border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[200px]">
                <button
                  onClick={() => {
                    setChatMode("edit");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left
                              ${chatMode === "edit" 
                                ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300" 
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
                              transition-colors duration-150`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <div>
                    <div className="font-medium">Edit Mode</div>
                    <div className="text-xs opacity-75">Make direct edits to timeline</div>
                  </div>
                  {chatMode === "edit" && (
                    <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setChatMode("plan");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left
                              ${chatMode === "plan" 
                                ? "bg-purple-50 dark:bg-purple-900 text-purple-700 dark:text-purple-300" 
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
                              transition-colors duration-150`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <div>
                    <div className="font-medium">Plan Mode</div>
                    <div className="text-xs opacity-75">Create video storyboards</div>
                  </div>
                  {chatMode === "plan" && (
                    <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            )}
            </div>

            {/* LLM Selector Dropdown */}
            {onSwitchLLM && (
              <div className="relative" ref={llmDropdownRef}>
                <button
                  onClick={() => setIsLLMDropdownOpen(!isLLMDropdownOpen)}
                  disabled={!isConnected}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs
                             text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-800
                             border border-gray-200 dark:border-gray-700 rounded-md
                             hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-400
                             focus:outline-none focus:ring-1 focus:ring-gray-400
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors duration-200"
                  title={currentLLM ? `${currentLLM.provider}: ${currentLLM.model}` : "Select LLM"}
                >
                  <span className="font-mono">{getLLMDisplayName(currentLLM?.model)}</span>
                  <svg 
                    className={`w-2.5 h-2.5 transition-transform duration-200 ${isLLMDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* LLM Dropdown Menu */}
                {isLLMDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-2 py-1 bg-white dark:bg-gray-800 
                                  border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[180px]">
                    <button
                      onClick={() => {
                        onSwitchLLM('azure_openai', 'gpt-4.1');
                        setIsLLMDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left
                                  ${currentLLM?.model === 'gpt-4.1'
                                    ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium" 
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
                                  transition-colors duration-150`}
                    >
                      <span>GPT-4.1</span>
                      {currentLLM?.model === 'gpt-4.1' && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    
                    <button
                      onClick={() => {
                        onSwitchLLM('gemini', 'gemini-2.5-pro');
                        setIsLLMDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left
                                  ${currentLLM?.model === 'gemini-2.5-pro'
                                    ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium" 
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
                                  transition-colors duration-150`}
                    >
                      <span>Gemini-2.5-Pro</span>
                      {currentLLM?.model === 'gemini-2.5-pro' && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        onSwitchLLM('gemini', 'gemini-2.5-flash');
                        setIsLLMDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left
                                  ${currentLLM?.model === 'gemini-2.5-flash'
                                    ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium" 
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
                                  transition-colors duration-150`}
                    >
                      <span>Gemini-2.5-Flash</span>
                      {currentLLM?.model === 'gemini-2.5-flash' && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send Button - Right */}
          <button
            onClick={sendMessage}
            disabled={!isConnected || !inputValue.trim()}
            className="p-2 bg-blue-500 text-white rounded-lg
                     hover:bg-blue-600 active:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500
                     transition-colors duration-200"
            title="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

