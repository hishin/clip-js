"use client";
import { useEffect, useRef, useState } from "react";
import { getFile, storeProject, useAppDispatch, useAppSelector, saveStoryboard, getStoryboard } from "../../../store";
import { getProject } from "../../../store";
import { setCurrentProject, updateProject } from "../../../store/slices/projectsSlice";
import { rehydrate, setMediaFiles, setSourceFiles } from '../../../store/slices/projectSlice';
import { setActiveSection } from "../../../store/slices/projectSlice";
import AddText from '../../../components/editor/AssetsPanel/tools-section/AddText';
import AddMedia from '../../../components/editor/AssetsPanel/AddButtons/UploadMedia';
import MediaList from '../../../components/editor/AssetsPanel/tools-section/MediaList';
import NotesList from '../../../components/editor/AssetsPanel/tools-section/NotesList';
import { useRouter } from 'next/navigation';
import TextButton from "@/app/components/editor/AssetsPanel/SidebarButtons/TextButton";
import LibraryButton from "@/app/components/editor/AssetsPanel/SidebarButtons/LibraryButton";
import ExportButton from "@/app/components/editor/AssetsPanel/SidebarButtons/ExportButton";
import HomeButton from "@/app/components/editor/AssetsPanel/SidebarButtons/HomeButton";
import ChatButton from "@/app/components/editor/AssetsPanel/SidebarButtons/ChatButton";
import NotesButton from "@/app/components/editor/AssetsPanel/SidebarButtons/NotesButton";
import ShortcutsButton from "@/app/components/editor/AssetsPanel/SidebarButtons/ShortcutsButton";
import MediaProperties from "../../../components/editor/PropertiesSection/MediaProperties";
import TextProperties from "../../../components/editor/PropertiesSection/TextProperties";
import { Timeline } from "../../../components/editor/timeline/Timline";
import TimelineAssistant from "../../../components/editor/timeline/TimelineAssistant";
import { PreviewPlayer } from "../../../components/editor/player/remotion/Player";
import { MediaFile, FileInfo } from "@/app/types";
import ExportList from "../../../components/editor/AssetsPanel/tools-section/ExportList";
import { useBRollSuggestions } from "../../../components/editor/timeline/commands";
import Image from "next/image";
import ProjectName from "../../../components/editor/player/ProjectName";
import { ChatPanel, Message } from "@/app/components/editor/chat";
import { AssistantPanel } from "@/app/components/editor/assistant";
import { createWebSocketConnection, buildTimelineContext } from "@/app/utils/backend";
import { executeAction, actionSchemas } from "@/app/actions";
import toast from "react-hot-toast";
import CenterViewTabs from '@/app/components/editor/player/CenterViewTabs';
import StoryboardEditor from '@/app/components/editor/storyboard/StoryboardEditor';
import type { StoryboardData } from '@/app/types/storyboard';
import { blockNoteToSimpleText, flexiblePlanToBlockNote } from '@/app/utils/storyboardConverter';
export default function Project({ params }: { params: { id: string } }) {
    const { id } = params;
    const dispatch = useAppDispatch();
    const projectState = useAppSelector((state) => state.projectState);
    const { currentProjectId } = useAppSelector((state) => state.projects);
    const [isLoading, setIsLoading] = useState(true);
    const [activeRightPanel, setActiveRightPanel] = useState<"properties" | "chat" | "assistant">("properties");
    
    // Assistant panel content state
    const [assistantContent, setAssistantContent] = useState<{
        type: "broll" | "silence" | "similar" | null;
        data: any;
    }>({ type: null, data: null });
    
    // WebSocket state
    const [messages, setMessages] = useState<Message[]>([]);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [isWsConnecting, setIsWsConnecting] = useState(false);
    const [currentLLM, setCurrentLLM] = useState<{ provider: string; model: string } | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    
    // Storyboard state
    const [activeCenterView, setActiveCenterView] = useState<"preview" | "storyboard">("preview");
    const [currentStoryboard, setCurrentStoryboard] = useState<StoryboardData | null>(null);
    const [currentStoryboardId, setCurrentStoryboardId] = useState<string>('');
    
    // Command hooks with callbacks for panel control
    const brollCommand = useBRollSuggestions({
        onOpen: () => {
            setAssistantContent({ type: "broll", data: null });
            setActiveRightPanel("assistant");
        },
        onClose: () => {
            setActiveRightPanel("properties");
            setAssistantContent({ type: null, data: null });
        }
    });
    
    // Refs to prevent stale closure in WebSocket handlers
    const projectStateRef = useRef(projectState);
    const dispatchRef = useRef(dispatch);

    const router = useRouter();
    const { activeSection, activeElement } = projectState;
    // when page is loaded set the project id if it exists
    useEffect(() => {
        const loadProject = async () => {
            if (id) {
                setIsLoading(true);
                const project = await getProject(id);
                if (project) {
                    dispatch(setCurrentProject(id));
                    setIsLoading(false);
                } else {
                    router.push('/404');
                }
            }
        };
        loadProject();
    }, [id, dispatch]);

    // set project state from with the current project id
    useEffect(() => {
        const loadProject = async () => {
            if (currentProjectId) {
                const project = await getProject(currentProjectId);
                if (project) {
                    dispatch(rehydrate(project));

                    // Load blob URLs for mediaFiles
                    dispatch(setMediaFiles(await Promise.all(
                        project.mediaFiles.map(async (media: MediaFile) => {
                            const file = await getFile(media.fileId);
                            return { ...media, src: URL.createObjectURL(file) };
                        })
                    )));

                    // Load blob URLs for sourceFiles
                    dispatch(setSourceFiles(await Promise.all(
                        project.sourceFiles.map(async (source: FileInfo) => {
                            const file = await getFile(source.fileId);
                            return { ...source, src: URL.createObjectURL(file) };
                        })
                    )));
                }
            }
        };
        loadProject();
    }, [dispatch, currentProjectId]);


    // save
    useEffect(() => {
        const saveProject = async () => {
            if (!projectState || projectState.id != currentProjectId) return;
            await storeProject(projectState);
            dispatch(updateProject(projectState));
        };
        saveProject();
    }, [projectState, dispatch]);

    // Keep refs updated to prevent stale closures in WebSocket handlers
    useEffect(() => {
        projectStateRef.current = projectState;
        dispatchRef.current = dispatch;
    }, [projectState, dispatch]);

    // WebSocket connection - connects when project editor loads
    useEffect(() => {
        if (!id) return;

        // Guard to prevent double connection in React Strict Mode
        let mounted = true;

        const connectWebSocket = () => {
            if (!mounted) return;  // Don't connect if already unmounted
            
            setIsWsConnecting(true);
            
            // Use the backend utility to create WebSocket connection
            const ws = createWebSocketConnection(id);

            ws.onopen = () => {
                if (!mounted) {
                    // If component unmounted while connecting, close immediately
                    ws.close();
                    return;
                }
                
                console.log("✅ WebSocket connected for project:", id);
                setIsWsConnected(true);
                setIsWsConnecting(false);
                
                // Register all actions from registry
                const registerMessage = {
                    type: "register_actions",
                    actions: actionSchemas
                };
                
                console.log(`📤 WS SEND [register_actions]:`, {
                    type: registerMessage.type,
                    actionCount: actionSchemas.length,
                    actionNames: actionSchemas.map(s => s.name)
                });
                
                ws.send(JSON.stringify(registerMessage));
            };

            ws.onmessage = async (event) => {
                if (!mounted) return;  // Ignore messages if unmounted
                
                try {
                    const data = JSON.parse(event.data);
                    
                    console.log(`📩 WS RECEIVE [${data.type}]:`, data);
                    
                    // Handle frontend action requests (always array-based)
                    if (data.type === "frontend_action") {
                        const { action_id, actions } = data;
                        
                        if (!actions || !Array.isArray(actions)) {
                            console.error("❌ Invalid frontend_action: missing or invalid 'actions' array");
                            ws.send(JSON.stringify({
                                type: "frontend_result",
                                action_id: action_id,
                                result: {
                                    success: false,
                                    error: "Invalid action format: 'actions' must be an array"
                                }
                            }));
                            return;
                        }
                        
                        console.log(`🎬 FRONTEND ACTIONS [${actions.length} action(s)]:`, {
                            action_id,
                            actions: actions.map(a => a.action),
                            timestamp: new Date().toISOString()
                        });
                        
                        // Execute all actions sequentially
                        const startTime = performance.now();
                        const results = [];
                        let successCount = 0;
                        let failCount = 0;
                        
                        for (let i = 0; i < actions.length; i++) {
                            const { action, parameters } = actions[i];
                            
                            console.log(`   [${i+1}/${actions.length}] Executing ${action}...`);
                            
                            try {
                                const result = await executeAction(action, parameters, {
                                    projectState: projectStateRef.current,
                                    dispatch: dispatchRef.current
                                });
                                
                                results.push({
                                    action,
                                    success: result.success,
                                    data: result.data,
                                    error: result.error
                                });
                                
                                if (result.success) {
                                    successCount++;
                                    console.log(`   ✅ ${action} succeeded`);
                                } else {
                                    failCount++;
                                    console.error(`   ❌ ${action} failed:`, result.error);
                                }
                            } catch (error) {
                                const errorMsg = error instanceof Error ? error.message : String(error);
                                results.push({
                                    action,
                                    success: false,
                                    error: errorMsg
                                });
                                failCount++;
                                console.error(`   ❌ ${action} threw error:`, error);
                            }
                        }
                        
                        const duration = performance.now() - startTime;
                        const overallSuccess = failCount === 0;
                        
                        console.log(`🎬 ACTIONS COMPLETE:`, {
                            action_id,
                            duration: `${duration.toFixed(2)}ms`,
                            total: actions.length,
                            succeeded: successCount,
                            failed: failCount,
                            overall: overallSuccess ? "✅ SUCCESS" : "❌ PARTIAL FAILURE"
                        });
                        
                        // Send result back to backend
                        const resultMessage = {
                            type: "frontend_result",
                            action_id: action_id,
                            result: {
                                success: overallSuccess,
                                total: actions.length,
                                succeeded: successCount,
                                failed: failCount,
                                results: results
                            }
                        };
                        
                        console.log(`📤 WS SEND [frontend_result]`);
                        ws.send(JSON.stringify(resultMessage));
                        
                        // Show toast notification
                        if (overallSuccess) {
                            toast.success(actions.length === 1 
                                ? `Action completed successfully` 
                                : `All ${successCount} actions completed successfully`
                            );
                        } else {
                            toast.error(`${failCount} of ${actions.length} action(s) failed`);
                        }
                        
                        return;  // Don't process as chat message
                    }
                    
                    // Handle other message types
                    if (data.type === "actions_registered") {
                        console.log(`✅ Actions registered: ${data.count} actions`);
                        return;
                    }
                    
                    if (data.type === "tool_execution_start") {
                        console.log(`🔧 Backend executing tools:`, data.tools);
                        return;
                    }
                    
                    if (data.type === "llm_switched") {
                        console.log(`🤖 LLM switched to:`, {
                            provider: data.provider,
                            model: data.model
                        });
                        setCurrentLLM({
                            provider: data.provider,
                            model: data.model
                        });
                        toast.success(`Switched to ${data.model}`);
                        return;
                    }
                    
                    // Handle agent status messages (thinking, executing tools)
                    if (data.type === "agent_status") {
                        const statusMessage: Message = {
                            id: crypto.randomUUID(),
                            type: "assistant",
                            content: data.message || data.content,
                            timestamp: new Date(),
                            isStatus: true  // Mark as status for special styling
                        };
                        setMessages((prev) => [...prev, statusMessage]);
                        return;
                    }
                    
                    // Handle agent reasoning (the LLM's plan/thinking) as a regular assistant message
                    if (data.type === "agent_reasoning") {
                        const reasoningMessage: Message = {
                            id: crypto.randomUUID(),
                            type: "assistant",
                            content: data.content,
                            timestamp: new Date(),
                            // No isStatus - display as normal assistant message
                        };
                        setMessages((prev) => [...prev, reasoningMessage]);
                        return;
                    }
                    
                    // Handle b-roll suggestions from backend
                    if (data.type === "broll_suggestions") {
                        console.log(`🎬 B-roll suggestions received:`, data.suggestions?.length);
                        
                        // Transform backend suggestions to frontend format
                        const suggestions = data.suggestions.map((s: any) => ({
                            id: `${s.file}-${s.start}-${s.end}`,  // Composite key for debugging
                            fileAlias: s.file,
                            sourceStartMs: s.start * 1000,  // Convert seconds to ms
                            sourceEndMs: s.end * 1000,      // Convert seconds to ms
                            description: s.description
                        }));
                        
                        // Pass suggestions to the hook
                        brollCommand.setSuggestions(suggestions);
                        
                        toast.success(`Found ${suggestions.length} b-roll suggestions`);
                        return;
                    }
                    
                    // Handle plan responses from backend
                    if (data.type === "plan_response") {
                        console.log(`📋 Plan response received:`, data.plan?.title);
                        
                        // Convert FlexiblePlan to BlockNote format immediately
                        const blockNoteBlocks = flexiblePlanToBlockNote(data.plan, projectStateRef.current.sourceFiles);
                        
                        const storyboardData: StoryboardData = {
                            plan: data.plan,
                            document: { blocks: blockNoteBlocks }  // Always include BlockNote format
                        };
                        
                        // Save to IndexedDB immediately with BlockNote format
                        const planMessageId = crypto.randomUUID();
                        await saveStoryboard(planMessageId, id, storyboardData);
                        
                        // Add message with storyboardData
                        const planMessage: Message = {
                            id: planMessageId,
                            type: "assistant",
                            content: data.plan?.overview || "Video plan created.",
                            storyboardData: storyboardData,
                            timestamp: new Date(),
                        };
                        
                        setMessages((prev) => [...prev, planMessage]);
                        
                        // Auto-open the new plan
                        setCurrentStoryboard(storyboardData);
                        setCurrentStoryboardId(planMessageId);
                        setActiveCenterView("storyboard");
                        
                        toast.success("Plan created! Opening storyboard...", { duration: 3000 });
                        return;
                    }
                    
                    // Handle regular chat messages
                    const newMessage: Message = {
                        id: crypto.randomUUID(),
                        type: data.type === "error" ? "error" : "assistant",
                        content: data.message || data.content || "No response",
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, newMessage]);
                } catch (error) {
                    console.error("❌ Error parsing WS message:", error, event.data);
                }
            };

            ws.onerror = (error) => {
                console.error("❌ WebSocket error:", error);
                if (mounted) {
                    setIsWsConnected(false);
                    setIsWsConnecting(false);
                    toast.error("Chat connection error");
                }
            };

            ws.onclose = () => {
                console.log("🔌 WebSocket disconnected");
                if (mounted) {
                    setIsWsConnected(false);
                    setIsWsConnecting(false);
                }
            };

            wsRef.current = ws;
        };

        connectWebSocket();

        // Cleanup on unmount
        return () => {
            mounted = false;  // Mark as unmounted
            if (wsRef.current) {
                console.log("🔌 Closing WebSocket connection for project:", id);
                wsRef.current.close();
            }
        };
    }, [id]);

    const handleFocus = (section: "media" | "text" | "export" | "notes") => {
        dispatch(setActiveSection(section));
    };

    const handleSendMessage = (message: string, mode: "edit" | "plan" | "assistant") => {
        if (!message.trim() || !isWsConnected || !wsRef.current) {
            if (!isWsConnected) {
                toast.error("Not connected to chat");
            }
            return;
        }

        // Add user message to chat
        const userMessage: Message = {
            id: crypto.randomUUID(),
            type: "user",
            content: message,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        // Send message to backend with clean timeline context
        try {
            const timelineContext = buildTimelineContext(
                projectStateRef.current,
                projectStateRef.current.currentTime
            );
            
            const messagePayload = {
                type: "user_message",
                content: message,
                context: timelineContext,
                mode: mode,
            };
            
            console.log(`📤 WS SEND [user_message]:`, {
                type: messagePayload.type,
                mode: mode,
                contentLength: message.length,
                clipCount: timelineContext.timeline.length,
                playheadMs: timelineContext.playheadPositionMs,
                totalDurationMs: timelineContext.totalDurationMs,
                selectedRange: timelineContext.selectedRangeStartMs && timelineContext.selectedRangeEndMs 
                    ? `${timelineContext.selectedRangeStartMs}ms - ${timelineContext.selectedRangeEndMs}ms`
                    : 'none'
            });
            
            wsRef.current.send(JSON.stringify(messagePayload));
        } catch (error) {
            console.error("❌ Error sending message:", error);
            toast.error("Failed to send message");
        }
    };

    const handleOpenPlan = async (data: StoryboardData, summary: string, messageId?: string) => {
        console.log(`📋 Opening storyboard view`);
        const id = messageId || Date.now().toString();
        
        // Try to load saved version from IndexedDB first
        const savedStoryboard = await getStoryboard(id);
        
        if (savedStoryboard) {
            console.log(`📂 Loaded saved storyboard with edits from IndexedDB`);
            setCurrentStoryboard(savedStoryboard);
        } else {
            console.log(`📄 No saved version, using original storyboard`);
            setCurrentStoryboard(data);
        }
        
        setCurrentStoryboardId(id);
        setActiveCenterView("storyboard");
    };

    const handleBuildPlan = async (messageId: string) => {
        // Always load from IndexedDB - single source of truth
        const storyboard = await getStoryboard(messageId);
        
        if (!storyboard?.document?.blocks) {
            console.error("No storyboard found in IndexedDB");
            toast.error("Storyboard not found");
            return;
        }
        
        console.log(`🔨 Building timeline from storyboard (ID: ${messageId})`);
        
        // Convert BlockNote to text format for backend
        const planToSend = blockNoteToSimpleText(storyboard.document.blocks);
        
        if (!planToSend) {
            console.error("Failed to convert plan to text");
            toast.error("Failed to convert plan");
            return;
        }
        
        // Send build command via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const timelineContext = buildTimelineContext(
                projectStateRef.current,
                projectStateRef.current.currentTime
            );
            
            const message = {
                type: "user_message",
                content: JSON.stringify({
                    command: "build_plan",
                    plan: planToSend
                }),
                context: timelineContext,
                mode: "edit"  // Always "edit" mode for builds
            };
            
            console.log(`📤 WS SEND [build_plan]:`, message);
            wsRef.current.send(JSON.stringify(message));
            toast.success("Building timeline...", { duration: 2000 });
        } else {
            console.error("WebSocket not connected");
            toast.error("Cannot build: WebSocket not connected");
        }
    };

    const handleSwitchLLM = (provider: string, model: string) => {
        if (!isWsConnected || !wsRef.current) {
            toast.error("Not connected to chat");
            return;
        }

        const message = {
            type: "switch_llm",
            provider: provider,
            model: model
        };

        console.log(`📤 WS SEND [switch_llm]:`, message);
        wsRef.current.send(JSON.stringify(message));
    };

    // ============================================================================
    // TIMELINE ASSISTANT COMMANDS
    // Pattern for all command hooks: hook.request(sendCommandWithContext)
    // Each command hook provides message data, this function adds timeline context
    // ============================================================================
    
    const sendCommandWithContext = (messageData: any) => {
        if (!wsRef.current || !isWsConnected) {
            toast.error("Not connected to backend");
            return;
        }

        const timelineContext = buildTimelineContext(
            projectStateRef.current,
            projectStateRef.current.currentTime
        );

        const message = {
            ...messageData,
            context: timelineContext
        };

        console.log(`📤 WS SEND [${messageData.type}]:`, message);
        wsRef.current.send(JSON.stringify(message));
    };

    const handleRequestBRoll = () => {
        brollCommand.request(sendCommandWithContext);
    };
    
    // Add more command handlers here following the same pattern:
    // const handleRemoveSilence = () => silenceCommand.request(sendCommandWithContext);
    // const handleFindSimilar = () => similarCommand.request(sendCommandWithContext);

    return (
        <div className="flex flex-col h-screen select-none">
            {/* Loading screen */}
            {
                isLoading ? (
                    <div className="fixed inset-0 flex items-center bg-black bg-opacity-50 justify-center z-50">
                        <div className="bg-black bg-opacity-70 p-6 rounded-lg flex flex-col items-center">
                            <div className="w-16 h-16 border-4 border-t-white border-r-white border-opacity-30 border-t-opacity-100 rounded-full animate-spin"></div>
                            <p className="mt-4 text-white text-lg">Loading project...</p>
                        </div>
                    </div>
                ) : null
            }
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Buttons */}
                <div className="w-[52px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto p-1.5">
                    <div className="flex flex-col space-y-2">
                        <HomeButton />
                        <TextButton 
                            onClick={() => handleFocus("text")} 
                            isActive={activeSection === "text"}
                        />
                        <LibraryButton 
                            onClick={() => handleFocus("media")} 
                            isActive={activeSection === "media"}
                        />
                        <NotesButton 
                            onClick={() => handleFocus("notes")} 
                            isActive={activeSection === "notes"}
                        />
                        <ExportButton 
                            onClick={() => handleFocus("export")} 
                            isActive={activeSection === "export"}
                        />
                        <ChatButton 
                            onClick={() => setActiveRightPanel("chat")}
                            isActive={activeRightPanel === "chat"}
                        />
                        {/* TODO: add shortcuts guide but in a better way */}
                        {/* <ShortcutsButton onClick={() => handleFocus("export")} /> */}
                    </div>
                </div>

                {/* Add media and text */}
                <div className="flex-[0.3] min-w-[200px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto p-4">
                    {activeSection === "media" && (
                        <div>
                            <h2 className="text-lg flex flex-row gap-2 items-center justify-center font-semibold mb-2">
                                <AddMedia />
                            </h2>
                            <MediaList />
                        </div>
                    )}
                    {activeSection === "text" && (
                        <div>
                            <AddText />
                        </div>
                    )}
                    {activeSection === "export" && (
                        <div>
                            <h2 className="text-lg font-semibold mb-4">Export</h2>
                            <ExportList />
                        </div>
                    )}
                    {activeSection === "notes" && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Saved Notes</h2>
                                <button
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = '.json';
                                        input.onchange = async (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (!file) return;
                                            
                                            try {
                                                const text = await file.text();
                                                const data = JSON.parse(text);
                                                
                                                // Validate that it has plan structure
                                                if (!data.plan || !data.plan.title) {
                                                    throw new Error('Invalid note format');
                                                }
                                                
                                                // Generate new ID for imported note
                                                const noteId = `imported-${Date.now()}`;
                                                await saveStoryboard(noteId, id, data);
                                                
                                                setCurrentStoryboardId(noteId);
                                                setCurrentStoryboard(data);
                                                setActiveCenterView("storyboard");
                                                
                                                toast.success('Note imported successfully');
                                            } catch (error) {
                                                console.error('Failed to import note:', error);
                                                toast.error('Failed to import note');
                                            }
                                        };
                                        input.click();
                                    }}
                                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
                                >
                                    Import
                                </button>
                            </div>
                            <NotesList 
                                projectId={id}
                                currentNoteId={currentStoryboardId}
                                onNoteSelect={(noteId, data) => {
                                    setCurrentStoryboardId(noteId);
                                    setCurrentStoryboard(data);
                                    setActiveCenterView("storyboard");
                                    toast.success('Note loaded');
                                }}
                                onExport={(noteId, data) => {
                                    // Export to JSON file
                                    const json = JSON.stringify(data, null, 2);
                                    const blob = new Blob([json], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `note-${data.plan.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.json`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    toast.success('Note exported');
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Center - Video Preview or Storyboard (Tabbed) */}
                <div className="flex flex-col flex-[1] overflow-hidden">
                    <ProjectName />
                    
                    {/* Tab Switcher */}
                    <CenterViewTabs
                        activeView={activeCenterView}
                        onViewChange={setActiveCenterView}
                        hasStoryboard={currentStoryboard !== null}
                    />
                    
                    {/* Content Area */}
                    <div className="flex-1 w-full overflow-hidden">
                        {activeCenterView === "preview" ? (
                            <PreviewPlayer />
                        ) : (
                            <div className="h-full">
                                {currentStoryboard ? (
                                    <StoryboardEditor
                                        key={currentStoryboardId || 'default'}
                                        initialData={currentStoryboard}
                                        storyboardId={currentStoryboardId}
                                        onSave={async (blocks) => {
                                            console.log('Saving storyboard blocks:', blocks);
                                            // BlockNote format: wrap blocks array in document object
                                            const document = { blocks };
                                            const updated = currentStoryboard ? { ...currentStoryboard, document } : null;
                                            setCurrentStoryboard(updated);
                                            
                                            // Save to IndexedDB for persistence
                                            if (updated && currentStoryboardId) {
                                                await saveStoryboard(currentStoryboardId, id, updated);
                                            }
                                        }}
                                        onBuild={handleBuildPlan}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                                        <div className="text-center text-gray-400 dark:text-gray-500">
                                            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">No Storyboard Yet</p>
                                            <p className="text-sm mt-2 text-gray-600 dark:text-gray-500">Use Plan Mode in chat to create a video storyboard</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Element Properties, Chat, or Assistant */}
                <div className="flex-[0.4] min-w-[200px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden flex flex-col">
                    {/* Tab Headers */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        <button
                            onClick={() => setActiveRightPanel("properties")}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
                                ${activeRightPanel === "properties"
                                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                        >
                            Properties
                        </button>
                        <button
                            onClick={() => setActiveRightPanel("chat")}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
                                ${activeRightPanel === "chat"
                                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => setActiveRightPanel("assistant")}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
                                ${activeRightPanel === "assistant"
                                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                        >
                            Assistant
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-hidden">
                        {activeRightPanel === "chat" && (
                            <ChatPanel
                                messages={messages}
                                isConnected={isWsConnected}
                                isConnecting={isWsConnecting}
                                onSendMessage={handleSendMessage}
                                onOpenPlan={handleOpenPlan}
                                onBuildPlan={handleBuildPlan}
                                onSwitchLLM={handleSwitchLLM}
                                currentLLM={currentLLM}
                            />
                        )}
                        
                        {activeRightPanel === "properties" && (
                            <div className="overflow-y-auto p-4 h-full bg-white dark:bg-gray-800">
                                {activeElement === "media" && (
                                    <div>
                                        <h2 className="text-lg font-semibold mb-4">Media Properties</h2>
                                        <MediaProperties />
                                    </div>
                                )}
                                {activeElement === "text" && (
                                    <div>
                                        <h2 className="text-lg font-semibold mb-4">Text Properties</h2>
                                        <TextProperties />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {activeRightPanel === "assistant" && (
                            <AssistantPanel
                                contentType={assistantContent.type}
                                brollCommand={brollCommand}
                            />
                        )}
                    </div>
                </div>
            </div>
            {/* Timeline and Assistant at bottom */}
            <div className="flex flex-col border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-row">
                    <div className="bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center mt-20">

                        {/* Text Track */}
                        <div className="relative h-12">
                            <div className="flex items-center gap-2 p-2">
                                <Image
                                    alt="Text"
                                    className="h-auto w-auto max-w-[24px] max-h-[24px] opacity-60 dark:invert"
                                    height={24}
                                    width={24}
                                    src="/Smock_Text_18_N.svg"
                                />
                            </div>
                        </div>

                        {/* Image Track */}
                        <div className="relative h-12">
                            <div className="flex items-center gap-2 p-2">
                                <Image
                                    alt="Image"
                                    className="h-auto w-auto max-w-[24px] max-h-[24px] opacity-60 dark:invert"
                                    height={24}
                                    width={24}
                                    src="/Smock_Image_18_N.svg"
                                />
                            </div>
                        </div>

                        {/* V2 Track - B-roll */}
                        <div className="relative h-12">
                            <div className="flex flex-col items-center justify-center p-1">
                                <Image
                                    alt="Video V2"
                                    className="h-auto w-auto max-w-[24px] max-h-[24px] opacity-60 dark:invert"
                                    height={24}
                                    width={24}
                                    src="/Smock_MovieCamera_18_N.svg"
                                />
                                <span className="text-[8px] text-gray-500 dark:text-gray-400 mt-[-2px] font-mono">V2</span>
                            </div>
                        </div>

                        {/* V1 Track - A-roll */}
                        <div className="relative h-12">
                            <div className="flex flex-col items-center justify-center p-1">
                                <Image
                                    alt="Video V1"
                                    className="h-auto w-auto max-w-[24px] max-h-[24px] opacity-60 dark:invert"
                                    height={24}
                                    width={24}
                                    src="/Smock_MovieCamera_18_N.svg"
                                />
                                <span className="text-[8px] text-gray-500 dark:text-gray-400 mt-[-2px] font-mono">V1</span>
                            </div>
                        </div>

                        {/* Audio Track */}
                        <div className="relative h-12">
                            <div className="flex items-center gap-2 p-2">
                                <Image
                                    alt="Audio"
                                    className="h-auto w-auto max-w-[24px] max-h-[24px] opacity-60 dark:invert"
                                    height={24}
                                    width={24}
                                    src="/Smock_Audio_18_N.svg"
                                />
                            </div>
                        </div>
                    </div>
                    <Timeline />
                </div>
                {/* Timeline Assistant */}
                <TimelineAssistant
                    isConnected={isWsConnected}
                    onSendMessage={handleSendMessage}
                    onSwitchLLM={handleSwitchLLM}
                    currentLLM={currentLLM}
                    commandHandlers={{
                        suggestBRoll: handleRequestBRoll,
                    }}
                />
            </div>
        </div >
    );
}

