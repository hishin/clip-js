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
import { createWebSocketConnection } from "@/app/utils/backend";
import toast from "react-hot-toast";
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

    // WebSocket connection - connects when project editor loads
    useEffect(() => {
        if (!id) return;

        const connectWebSocket = () => {
            setIsWsConnecting(true);
            
            // Use the backend utility to create WebSocket connection
            const ws = createWebSocketConnection(id);

            ws.onopen = () => {
                console.log("✅ WebSocket connected for project:", id);
                setIsWsConnected(true);
                setIsWsConnecting(false);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const newMessage: Message = {
                        id: Date.now().toString(),
                        type: data.type === "error" ? "error" : "assistant",
                        content: data.message || data.content || "No response",
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, newMessage]);
                } catch (error) {
                    console.error("Error parsing message:", error);
                }
            };

            ws.onerror = (error) => {
                console.error("❌ WebSocket error:", error);
                setIsWsConnected(false);
                setIsWsConnecting(false);
                toast.error("Chat connection error");
            };

            ws.onclose = () => {
                console.log("🔌 WebSocket disconnected");
                setIsWsConnected(false);
                setIsWsConnecting(false);
            };

            wsRef.current = ws;
        };

        connectWebSocket();

        // Cleanup on unmount
        return () => {
            if (wsRef.current) {
                console.log("🔌 Closing WebSocket connection for project:", id);
                wsRef.current.close();
            }
        };
    }, [id]);

    const handleFocus = (section: "media" | "text" | "export") => {
        dispatch(setActiveSection(section));
    };

    const handleSendMessage = (message: string) => {
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

        // Send message to backend with proper format
        try {
            wsRef.current.send(
                JSON.stringify({
                    type: "user_message",
                    content: message,
                    context: {
                        // Add timeline state context if needed
                        timeline: projectState,
                        playhead: 0, // TODO: get actual playhead position
                    },
                })
            );
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message");
        }
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

                {/* Center - Video Preview */}
                <div className="flex items-center justify-center flex-col flex-[1] overflow-hidden">
                    <ProjectName />
                    <PreviewPlayer />
                </div>

                {/* Right Sidebar - Element Properties or Chat */}
                <div className="flex-[0.4] min-w-[200px] border-l border-gray-800 overflow-hidden">
                    {activeRightPanel === "chat" ? (
                        <ChatPanel 
                            messages={messages}
                            isConnected={isWsConnected}
                            isConnecting={isWsConnecting}
                            onSendMessage={handleSendMessage}
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

                    <div className="relative h-16">
                        <div className="flex items-center gap-2 p-4">
                            <Image
                                alt="Video"
                                className="invert h-auto w-auto max-w-[30px] max-h-[30px]"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/532727/video.svg"
                            />
                        </div>
                    </div>

                    <div className="relative h-16">
                        <div className="flex items-center gap-2 p-4">
                            <Image
                                alt="Video"
                                className="invert h-auto w-auto max-w-[30px] max-h-[30px]"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/532708/music.svg"
                            />
                        </div>
                    </div>

                    <div className="relative h-16">
                        <div className="flex items-center gap-2 p-4">
                            <Image
                                alt="Video"
                                className="invert h-auto w-auto max-w-[30px] max-h-[30px]"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/535454/image.svg"
                            />
                        </div>
                    </div>

                    <div className="relative h-16">
                        <div className="flex items-center gap-2 p-4">
                            <Image
                                alt="Video"
                                className="invert h-auto w-auto max-w-[30px] max-h-[30px]"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/535686/text.svg"
                            />
                        </div>
                    </div>
                </div>
                <Timeline />
            </div>
        </div >
    );
}
