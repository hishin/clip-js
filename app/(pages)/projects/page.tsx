'use client';

import { useEffect, useRef, useState } from 'react';
import Image from "next/image";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from '../../store';
import { addProject, deleteProject, rehydrateProjects, setCurrentProject, updateProject } from '../../store/slices/projectsSlice';
import { setFilesID } from '../../store/slices/projectSlice';
import { listProjects, storeProject, deleteProject as deleteProjectFromDB, storeFile } from '../../store';
import { ProjectState } from '../../types';
import { toast } from 'react-hot-toast';
import { connectToBackend, createProjectInBackend, deleteProjectFromBackend } from '../../utils/backend';

// Function to automatically upload media files from a directory
const autoUploadMediaFiles = async (projectDirectoryHandle: FileSystemDirectoryHandle, projectDirectoryPath: string): Promise<{fileIds: string[], filesIDToFileInfoMap: Record<string, any>}> => {
    const uploadedFileIds: string[] = [];
    const filesIDToFileInfoMap: Record<string, any> = {};
    
    try {
        // First, try to read video_id_map.json from the project directory
        let videoIdMap: Record<string, {name: string, walnut_id: string}> = {};
        try {
            const videoIdMapFile = await projectDirectoryHandle.getFileHandle('video_id_map.json');
            const videoIdMapContent = await videoIdMapFile.getFile();
            const videoIdMapText = await videoIdMapContent.text();
            videoIdMap = JSON.parse(videoIdMapText);
            console.log('Successfully loaded video_id_map.json:', videoIdMap);
        } catch (error) {
            console.warn('Could not read video_id_map.json, proceeding without mapping:', error);
        }
        
        // Get the videos subdirectory and upload files from there
        const videosHandle = await projectDirectoryHandle.getDirectoryHandle('videos');
        
        // Get all files in the videos directory
        for await (const [name, entry] of (videosHandle as any).entries()) {
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                const fileId = crypto.randomUUID();
                
                await storeFile(file, fileId);
                uploadedFileIds.push(fileId);
                
                // Create FileInfo object with mapping data if available
                const fileInfo: any = {
                    fileName: file.name,
                    filePath: `${projectDirectoryPath}/videos/${file.name}`, // Construct absolute path using project directory
                    dbIndex: uploadedFileIds.length - 1, // Index in the uploaded files array
                    videoMapIndex: -1, // Default value
                    metadata: {}
                };
                
                // Try to find matching entry in video_id_map
                // Note: video_id_map.json filenames don't include extensions, so we compare basenames
                const fileBasename = file.name.replace(/\.[^/.]+$/, ''); // Remove file extension
                const videoMapEntry = Object.entries(videoIdMap).find(([_, data]) => data.name === fileBasename);
                if (videoMapEntry) {
                    const [videoMapIndex, data] = videoMapEntry;
                    fileInfo.videoMapIndex = parseInt(videoMapIndex);
                    fileInfo.metadata.walnut_id = data.walnut_id;
                    console.log(`Matched file "${file.name}" (basename: "${fileBasename}") with videoMapIndex ${videoMapIndex} and walnut_id ${data.walnut_id}`);
                } else {
                    console.log(`No mapping found for file "${file.name}" (basename: "${fileBasename}")`);
                }
                
                filesIDToFileInfoMap[fileId] = fileInfo;
                
                console.log(`Uploaded media file "${file.name}" with ID ${fileId}`);
            }
        }
        
        console.log(`Successfully uploaded ${uploadedFileIds.length} media files with ${Object.keys(filesIDToFileInfoMap).length} file info mappings`);
    } catch (error) {
        console.error(`Error uploading media files:`, error);
        throw error;
    }
    
    return { fileIds: uploadedFileIds, filesIDToFileInfoMap };
};

export default function Projects() {
    const dispatch = useAppDispatch();
    const { projects, currentProjectId } = useAppSelector((state) => state.projects);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    // TODO: Remove hardcoded default directory path. This is temporary for development/testing.
    const [selectedDirectoryPath, setSelectedDirectoryPath] = useState('/Users/vshin/storybuilder-input-data/shared-walnut-data/small-walnut/prj-mudwitch-documentary');
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check backend connection when projects page loads
        connectToBackend();
        
        const loadProjects = async () => {
            setIsLoading(true);
            try {
                const storedProjects = await listProjects();
                dispatch(rehydrateProjects(storedProjects));
            } catch (error) {
                toast.error('Failed to load projects');
                console.error('Error loading projects:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadProjects();
    }, [dispatch]);

    useEffect(() => {
        if (isCreating && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isCreating]);

    const handleDirectoryPicker = async () => {
        try {
            // Check if File System Access API is supported
            if ('showDirectoryPicker' in window) {
                const handle = await (window as any).showDirectoryPicker();
                setDirectoryHandle(handle);
                setNewProjectName(handle.name); // Use directory name as default project name
                toast.success(`Directory selected: ${handle.name}. Please enter the full path below.`);
            } else {
                toast.error('Directory picker not supported in this browser');
            }
        } catch (error) {
            console.error('Error selecting directory:', error);
            toast.error('Failed to select directory');
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        const projectId = crypto.randomUUID();
        
        // TODO: use reducer not this to create new project
        const newProject: ProjectState = {
            id: projectId,
            projectName: newProjectName,
            directoryPath: selectedDirectoryPath,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            mediaFiles: [],
            textElements: [],
            currentTime: 0,
            isPlaying: false,
            isMuted: false,
            duration: 0,
            activeSection: 'media',
            activeElement: 'text',
            activeElementIndex: 0,
            filesID: [],
            zoomLevel: 1,
            timelineZoom: 100,
            enableMarkerTracking: true,
            resolution: { width: 1920, height: 1080 },
            fps: 30,
            aspectRatio: '16:9',
            history: [],
            future: [],
            exportSettings: {
                resolution: '1080p',
                quality: 'high',
                speed: 'fastest',
                fps: 30,
                format: 'mp4',
                includeSubtitles: false,
            },
        };

        try {
            // Store project locally first
            await storeProject(newProject);
            dispatch(addProject(newProject));

            // Auto-upload media files from videos subdirectory
            let uploadedFilesCount = 0;
            let filesIDToFileInfoMap: Record<string, any> = {};
            if (directoryHandle) {
                try {
                    // Pass the project directory and path to autoUploadMediaFiles
                    const uploadResult = await autoUploadMediaFiles(directoryHandle, selectedDirectoryPath);
                    uploadedFilesCount = uploadResult.fileIds.length;
                    filesIDToFileInfoMap = uploadResult.filesIDToFileInfoMap;
                    
                    // Update the project with the uploaded file IDs (same as UploadMedia.handleFileChange)
                    const updatedProject = {
                        ...newProject,
                        filesID: uploadResult.fileIds
                    };
                    
                    // Update the project in storage and state
                    await storeProject(updatedProject);
                    dispatch(updateProject(updatedProject));
                    
                    // Update Redux state for current project (same as UploadMedia.handleFileChange)
                    dispatch(setFilesID(uploadResult.fileIds));
                    
                    console.log(`Successfully uploaded ${uploadedFilesCount} media files from videos directory`);
                } catch (error) {
                    console.warn('Could not access videos directory or upload files:', error);
                    console.log('Project created without auto-uploading media files');
                }
            }

            // Register with backend
            const backendSuccess = await createProjectInBackend(
                projectId,
                newProjectName,
                selectedDirectoryPath,
                filesIDToFileInfoMap
            );

            if (backendSuccess) {
                toast.success(`Project created and registered with backend successfully. ${uploadedFilesCount} media files uploaded.`);
            } else {
                toast.success(`Project created locally (backend registration failed). ${uploadedFilesCount} media files uploaded.`);
            }

            // Clear form
            setNewProjectName('');
            setSelectedDirectoryPath('');
            setDirectoryHandle(null);
            setIsCreating(false);
        } catch (error) {
            console.error('Error creating project:', error);
            toast.error('Failed to create project');
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        try {
            // Delete from local IndexedDB (includes associated media files)
            await deleteProjectFromDB(projectId);
            
            // Delete from Redux store
            dispatch(deleteProject(projectId));
            
            // Try to delete from backend (don't fail if backend is down)
            try {
                await deleteProjectFromBackend(projectId);
            } catch (backendError) {
                console.warn('Backend deletion failed, but local deletion succeeded:', backendError);
            }
            
            // Refresh the projects list
            const storedProjects = await listProjects();
            dispatch(rehydrateProjects(storedProjects));
            
            toast.success('Project and associated media files deleted successfully');
        } catch (error) {
            console.error('Error deleting project:', error);
            toast.error('Failed to delete project');
        }
    };

    return (
        <div>
            <div>
                <br />
                <br />
                <h2 className="mx-auto max-w-4xl text-center font-display text-5xl font-medium tracking-tight text-white-900 sm:text-4xl">
                    <span className="inline-block">Projects</span>
                </h2>
                {isLoading ? (
                    <div className="fixed inset-0 flex items-center bg-black bg-opacity-50 justify-center z-50">
                        <div className="bg-black bg-opacity-70 p-6 rounded-lg flex flex-col items-center">
                            <div className="w-16 h-16 border-4 border-t-white border-r-white border-opacity-30 border-t-opacity-100 rounded-full animate-spin"></div>
                            <p className="mt-4 text-white text-lg">Loading projects...</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center items-center py-12">
                        <div className="grid py-4 w-2/3 sm:w-1/2 md:w-1/3 lg:w-1/4 grid-cols-1 gap-4 lg:grid-cols-1 lg:gap-5">
                            {/* Add Project Button */}
                            <button onClick={() => setIsCreating(true)} className="group">
                                <div
                                    className="flex flex-col gap-4 rounded-lg border border-white border-opacity-10 shadow-md p-4 transition-transform transform group-hover:scale-105 group-hover:border-opacity-10 group-hover:shadow-lg [box-shadow:_70px_-20px_130px_0px_rgba(255,255,255,0.05)_inset] dark:[box-shadow:_70px_-20px_130px_0px_rgba(255,255,255,0.05)_inset]"
                                >
                                    <figure className="flex items-center justify-between w-full rounded-full bg-surface-secondary p-2 dark:border-dark-border dark:bg-dark-surface-secondary">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex size-9 items-center justify-center rounded-full bg-surface-secondary">
                                                <Image
                                                    alt="Add Project"
                                                    className="invert"
                                                    height={18}
                                                    src="https://www.svgrepo.com/show/421119/add-create-new.svg"
                                                    width={18}
                                                />
                                            </div>
                                            <h5 className="text-lg font-medium">Add Project</h5>
                                        </div>
                                    </figure>
                                </div>
                            </button>

                            {/* List Projects */}
                            {[...projects]
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map(({ id, projectName, createdAt, lastModified }) => (
                                    <div key={id} className="">
                                        <Link href={`/projects/${id}`} onClick={() => dispatch(setCurrentProject(id))} className="group block h-full">
                                            <div
                                                className="flex flex-col gap-4 rounded-lg border border-white border-opacity-10 shadow-md p-4 transition-transform transform group-hover:scale-105 group-hover:border-opacity-10 group-hover:shadow-lg [box-shadow:_70px_-20px_130px_0px_rgba(255,255,255,0.05)_inset] dark:[box-shadow:_70px_-20px_130px_0px_rgba(255,255,255,0.05)_inset]"
                                            >
                                                <figure className="flex items-center justify-between w-full rounded-full bg-surface-secondary p-2 dark:border-dark-border dark:bg-dark-surface-secondary">
                                                    {/*  Project Name */}
                                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                        <div className="flex-shrink-0 flex size-9 items-center justify-center rounded-full bg-surface-secondary">
                                                            <Image
                                                                alt={projectName}
                                                                className="invert"
                                                                height={18}
                                                                src="https://www.svgrepo.com/show/522461/video.svg"
                                                                width={18}
                                                            />
                                                        </div>
                                                        <h5 className="truncate font-medium text-base sm:text-lg" title={projectName}>
                                                            {projectName}
                                                        </h5>
                                                    </div>
                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            handleDeleteProject(id);
                                                        }}
                                                        className="flex-shrink-0 ml-2 text-red-500 hover:text-red-600 transition-colors"
                                                        aria-label="Delete project"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </figure>
                                                <div className="flex flex-col items-start py-1 gap-1 text-sm">
                                                    <p className="text-pretty text-text-secondary dark:text-dark-text-secondary">
                                                        <span className="font-medium">Created:</span> {new Date(createdAt).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-pretty text-text-secondary dark:text-dark-text-secondary">
                                                        <span className="font-medium">Last Modified:</span> {new Date(lastModified).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Project Modal */}
            <div className="container mx-auto px-4 py-8">
                {isCreating && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-black border border-white border-opacity-10 p-6 rounded-lg w-96">
                            <h3 className="text-xl font-bold mb-4 text-white">Create New Project</h3>
                            
                            {/* Directory Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-white mb-2">
                                    Project Directory
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <button
                                        onClick={handleDirectoryPicker}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                    >
                                        📁 Select Directory (for file access)
                                    </button>
                                </div>
                                {directoryHandle && (
                                    <p className="text-sm text-green-300 mb-2">
                                        ✓ Directory selected: {directoryHandle.name}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mb-2">
                                    Select a directory to enable file access, then enter the full path below for backend registration.
                                </p>
                            </div>

                            {/* Manual Directory Path Input */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-white mb-2">
                                    Full Directory Path (required for backend)
                                </label>
                                <input
                                    type="text"
                                    value={selectedDirectoryPath}
                                    onChange={(e) => setSelectedDirectoryPath(e.target.value)}
                                    placeholder="/Users/username/Documents/MyProject"
                                    className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Enter the complete absolute path to your project directory
                                </p>
                            </div>

                            {/* Project Name */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-white mb-2">
                                    Project Name
                                </label>
                                <input
                                    type="text"
                                    ref={inputRef}
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleCreateProject();
                                        } else if (e.key === "Escape") {
                                            setIsCreating(false);
                                        }
                                    }}
                                    placeholder="Project Name"
                                    className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setIsCreating(false);
                                        setNewProjectName('');
                                        setSelectedDirectoryPath('');
                                        setDirectoryHandle(null);
                                    }}
                                    className="px-4 py-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md hover:bg-[#383838] text-white rounded "
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateProject}
                                    disabled={!newProjectName.trim() || !selectedDirectoryPath.trim()}
                                    className="px-4 py-2 bg-white text-black hover:bg-[#ccc] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

    );
}