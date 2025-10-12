"use client";
import { useEffect, useRef, useState } from "react";
import { getFile, storeProject, useAppDispatch, useAppSelector } from "../../../store";
import { getProject } from "../../../store";
import { setCurrentProject, updateProject } from "../../../store/slices/projectsSlice";
import { rehydrate, setMediaFiles } from '../../../store/slices/projectSlice';
import { setActiveSection } from "../../../store/slices/projectSlice";
import AddText from '../../../components/editor/AssetsPanel/tools-section/AddText';
import AddMedia from '../../../components/editor/AssetsPanel/AddButtons/UploadMedia';
import MediaList from '../../../components/editor/AssetsPanel/tools-section/MediaList';
import { useRouter } from 'next/navigation';
import TextButton from "@/app/components/editor/AssetsPanel/SidebarButtons/TextButton";
import LibraryButton from "@/app/components/editor/AssetsPanel/SidebarButtons/LibraryButton";
import ExportButton from "@/app/components/editor/AssetsPanel/SidebarButtons/ExportButton";
import HomeButton from "@/app/components/editor/AssetsPanel/SidebarButtons/HomeButton";
import ChatButton from "@/app/components/editor/AssetsPanel/SidebarButtons/ChatButton";
import ShortcutsButton from "@/app/components/editor/AssetsPanel/SidebarButtons/ShortcutsButton";
import MediaProperties from "../../../components/editor/PropertiesSection/MediaProperties";
import TextProperties from "../../../components/editor/PropertiesSection/TextProperties";
import { Timeline } from "../../../components/editor/timeline/Timline";
import { PreviewPlayer } from "../../../components/editor/player/remotion/Player";
import { MediaFile } from "@/app/types";
import ExportList from "../../../components/editor/AssetsPanel/tools-section/ExportList";
import Image from "next/image";
import ProjectName from "../../../components/editor/player/ProjectName";
import { ChatPanel, Message } from "@/app/components/editor/chat";
import { createWebSocketConnection, buildTimelineContext } from "@/app/utils/backend";
import { executeAction, actionSchemas } from "@/app/actions";
import toast from "react-hot-toast";
import CenterViewTabs from '@/app/components/editor/player/CenterViewTabs';
import StoryboardViewer from '@/app/components/editor/chat/StoryboardViewer';
export default function Project({ params }: { params: { id: string } }) {
    const { id } = params;
    const dispatch = useAppDispatch();
    const projectState = useAppSelector((state) => state.projectState);
    const { currentProjectId } = useAppSelector((state) => state.projects);
    const [isLoading, setIsLoading] = useState(true);
    const [activeRightPanel, setActiveRightPanel] = useState<"properties" | "chat">("properties");
    
    // WebSocket state
    const [messages, setMessages] = useState<Message[]>([]);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [isWsConnecting, setIsWsConnecting] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    
    // Storyboard state
    const [activeCenterView, setActiveCenterView] = useState<"preview" | "storyboard">("preview");
    const [currentStoryboard, setCurrentStoryboard] = useState<{ html: string; summary: string } | null>(null);
    
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

                    dispatch(setMediaFiles(await Promise.all(
                        project.mediaFiles.map(async (media: MediaFile) => {
                            const file = await getFile(media.fileId);
                            return { ...media, src: URL.createObjectURL(file) };
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
                    
                    // Handle frontend action requests
                    if (data.type === "frontend_action") {
                        const { action, parameters, action_id } = data;
                        
                        console.log(`🎬 FRONTEND ACTION EXECUTE [${action}]:`, {
                            action_id,
                            parameters,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Execute using registry
                        const startTime = performance.now();
                        const result = await executeAction(action, parameters, {
                            projectState: projectStateRef.current,
                            dispatch: dispatchRef.current
                        });
                        const duration = performance.now() - startTime;
                        
                        console.log(`🎬 FRONTEND ACTION COMPLETE [${action}]:`, {
                            action_id,
                            duration: `${duration.toFixed(2)}ms`,
                            success: result.success,
                            result
                        });
                        
                        // Send result back to backend
                        const resultMessage = {
                            type: "frontend_result",
                            action_id: action_id,
                            action: action,
                            result: result
                        };
                        
                        console.log(`📤 WS SEND [frontend_result]:`, resultMessage);
                        ws.send(JSON.stringify(resultMessage));
                        
                        // Show toast notification
                        if (result.success) {
                            toast.success(`Action ${action} completed`);
                        } else {
                            toast.error(result.error || `Action ${action} failed`);
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
                        return;
                    }
                    
                    // Handle agent status messages (thinking, executing tools)
                    if (data.type === "agent_status") {
                        const statusMessage: Message = {
                            id: Date.now().toString() + "-status",
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
                            id: Date.now().toString(),
                            type: "assistant",
                            content: data.content,
                            timestamp: new Date(),
                            // No isStatus - display as normal assistant message
                        };
                        setMessages((prev) => [...prev, reasoningMessage]);
                        return;
                    }
                    
                    // Handle plan responses from backend
                    if (data.type === "plan_response") {
                        console.log(`📋 Plan response received:`, data.summary);
                        
                        // Add message with htmlContent (triggers Open Plan button)
                        const planMessage: Message = {
                            id: Date.now().toString() + "-plan",
                            type: "assistant",
                            content: data.summary || "Video plan created.",
                            htmlContent: data.html || "",  // Store HTML in existing field
                            timestamp: new Date(),
                        };
                        
                        setMessages((prev) => [...prev, planMessage]);
                        toast.success("Plan created! Click 'Open Plan' to view.", { duration: 3000 });
                        return;
                    }
                    
                    // Handle regular chat messages
                    const newMessage: Message = {
                        id: Date.now().toString(),
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

    const handleFocus = (section: "media" | "text" | "export") => {
        dispatch(setActiveSection(section));
    };

    const handleSendMessage = (message: string, mode: "edit" | "plan") => {
        if (!message.trim() || !isWsConnected || !wsRef.current) {
            if (!isWsConnected) {
                toast.error("Not connected to chat");
            }
            return;
        }

        // Add user message to chat
        const userMessage: Message = {
            id: Date.now().toString(),
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
                totalDurationMs: timelineContext.totalDurationMs
            });
            
            wsRef.current.send(JSON.stringify(messagePayload));
        } catch (error) {
            console.error("❌ Error sending message:", error);
            toast.error("Failed to send message");
        }
    };

    const handleOpenPlan = (htmlContent: string, summary: string) => {
        console.log(`📋 Opening storyboard view`);
        setCurrentStoryboard({ html: htmlContent, summary });
        setActiveCenterView("storyboard");
    };

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
                <div className="flex-[0.1] min-w-[60px] max-w-[100px] border-r border-gray-700 overflow-y-auto p-4">
                    <div className="flex flex-col space-y-2">
                        <HomeButton />
                        <TextButton onClick={() => handleFocus("text")} />
                        <LibraryButton onClick={() => handleFocus("media")} />
                        <ExportButton onClick={() => handleFocus("export")} />
                        <ChatButton onClick={() => setActiveRightPanel(activeRightPanel === "chat" ? "properties" : "chat")} />
                        {/* TODO: add shortcuts guide but in a better way */}
                        {/* <ShortcutsButton onClick={() => handleFocus("export")} /> */}
                    </div>
                </div>

                {/* Add media and text */}
                <div className="flex-[0.3] min-w-[200px] border-r border-gray-800 overflow-y-auto p-4">
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
                                    <StoryboardViewer 
                                        htmlContent={currentStoryboard.html} 
                                        summary={currentStoryboard.summary} 
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-gray-900">
                                        <div className="text-center text-gray-500">
                                            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                            <p className="text-lg font-medium text-gray-400">No Storyboard Yet</p>
                                            <p className="text-sm mt-2 text-gray-500">Use Plan Mode in chat to create a video storyboard</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Element Properties or Chat */}
                <div className="flex-[0.4] min-w-[200px] border-l border-gray-800 overflow-hidden">
                    {activeRightPanel === "chat" ? (
                        <ChatPanel 
                            messages={messages}
                            isConnected={isWsConnected}
                            isConnecting={isWsConnecting}
                            onSendMessage={handleSendMessage}
                            onOpenPlan={handleOpenPlan}
                        />
                    ) : (
                        <div className="overflow-y-auto p-4 h-full">
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
                </div>
            </div>
            {/* Timeline at bottom */}
            <div className="flex flex-row border-t border-gray-500">
                <div className=" bg-darkSurfacePrimary flex flex-col items-center justify-center mt-20">

                    {/* Text Track */}
                    <div className="relative h-12">
                        <div className="flex items-center gap-2 p-2">
                            <Image
                                alt="Text"
                                className="invert h-auto w-auto max-w-[24px] max-h-[24px]"
                                height={24}
                                width={24}
                                src="https://www.svgrepo.com/show/535686/text.svg"
                            />
                        </div>
                    </div>

                    {/* Image Track */}
                    <div className="relative h-12">
                        <div className="flex items-center gap-2 p-2">
                            <Image
                                alt="Image"
                                className="invert h-auto w-auto max-w-[24px] max-h-[24px]"
                                height={24}
                                width={24}
                                src="https://www.svgrepo.com/show/535454/image.svg"
                            />
                        </div>
                    </div>

                    {/* V2 Track - B-roll */}
                    <div className="relative h-12">
                        <div className="flex flex-col items-center justify-center p-1">
                            <Image
                                alt="Video V2"
                                className="invert h-auto w-auto max-w-[24px] max-h-[24px]"
                                height={24}
                                width={24}
                                src="https://www.svgrepo.com/show/532727/video.svg"
                            />
                            <span className="text-[8px] text-gray-400 mt-[-2px]">V2</span>
                        </div>
                    </div>

                    {/* V1 Track - A-roll */}
                    <div className="relative h-12">
                        <div className="flex flex-col items-center justify-center p-1">
                            <Image
                                alt="Video V1"
                                className="invert h-auto w-auto max-w-[24px] max-h-[24px]"
                                height={24}
                                width={24}
                                src="https://www.svgrepo.com/show/532727/video.svg"
                            />
                            <span className="text-[8px] text-gray-400 mt-[-2px]">V1</span>
                        </div>
                    </div>

                    {/* Audio Track */}
                    <div className="relative h-12">
                        <div className="flex items-center gap-2 p-2">
                            <Image
                                alt="Audio"
                                className="invert h-auto w-auto max-w-[24px] max-h-[24px]"
                                height={24}
                                width={24}
                                src="https://www.svgrepo.com/show/532708/music.svg"
                            />
                        </div>
                    </div>
                </div>
                <Timeline />
            </div>
        </div >
    );
}

