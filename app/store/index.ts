"use client";
import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { openDB } from "idb";
import projectStateReducer from "./slices/projectSlice";
import projectsReducer from "./slices/projectsSlice";
import toast from "react-hot-toast";

// Create IndexedDB database for files, projects, and storyboards
const setupDB = async () => {
  if (typeof window === "undefined") return null;
  const db = await openDB("clipjs-files", 2, {
    upgrade(db) {
      // Create all stores - fresh setup
      db.createObjectStore("files", { keyPath: "id" });
      db.createObjectStore("projects", { keyPath: "id" });
      db.createObjectStore("storyboards", { keyPath: "id" });
    },
  });
  return db;
};

// Load state from localStorage
export const loadState = () => {
  if (typeof window === "undefined") return undefined;
  try {
    const serializedState = localStorage.getItem("clipjs-state");
    if (serializedState === null) return undefined;
    return JSON.parse(serializedState);
  } catch (error) {
    toast.error("Error loading state from localStorage");
    console.error("Error loading state from localStorage:", error);
    return undefined;
  }
};

// Save state to localStorage
const saveState = (state: any) => {
  if (typeof window === "undefined") return;
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem("clipjs-state", serializedState);
  } catch (error) {
    console.error("Error saving state to localStorage:", error);
  }
};

// File storage functions
export const storeFile = async (file: File, fileId: string) => {
  if (typeof window === "undefined") return null;
  try {
    const db = await setupDB();
    if (!db) return null;

    const fileData = {
      id: fileId,
      file: file,
    };

    await db.put("files", fileData);
    return fileId;
  } catch (error) {
    toast.error("Error storing file");
    console.error("Error storing file:", error);
    return null;
  }
};

export const getFile = async (fileId: string) => {
  if (typeof window === "undefined") return null;
  try {
    const db = await setupDB();
    if (!db) return null;

    const fileData = await db.get("files", fileId);
    if (!fileData) return null;

    return fileData.file;
  } catch (error) {
    toast.error("Error retrieving file");
    console.error("Error retrieving file:", error);
    return null;
  }
};

export const deleteFile = async (fileId: string) => {
  if (typeof window === "undefined") return;
  try {
    const db = await setupDB();
    if (!db) return;
    await db.delete("files", fileId);
  } catch (error) {
    toast.error("Error deleting file");
    console.error("Error deleting file:", error);
  }
};

export const listFiles = async () => {
  if (typeof window === "undefined") return [];
  try {
    const db = await setupDB();
    if (!db) return [];
    return await db.getAll("files");
  } catch (error) {
    toast.error("Error listing files");
    console.error("Error listing files:", error);
    return [];
  }
};

// Project storage functions
export const storeProject = async (project: any) => {
  if (typeof window === "undefined") return null;
  try {
    const db = await setupDB();

    if (!db) return null;
    if (!project.id || !project.projectName) {
      return null;
    }

    await db.put("projects", project);

    return project.id;
  } catch (error) {
    toast.error("Error storing project");
    console.error("Error storing project:", error);
    return null;
  }
};

export const getProject = async (projectId: string) => {
  if (typeof window === "undefined") return null;
  try {
    const db = await setupDB();
    if (!db) return null;
    return await db.get("projects", projectId);
  } catch (error) {
    toast.error("Error retrieving project");
    console.error("Error retrieving project:", error);
    return null;
  }
};

export const deleteProject = async (projectId: string) => {
  if (typeof window === "undefined") return;
  try {
    const db = await setupDB();
    if (!db) return;

    // First, get the project to find associated file IDs
    const project = await db.get("projects", projectId);
    if (!project) {
      console.warn(`Project ${projectId} not found in IndexedDB`);
      return;
    }

    // Delete all associated media files from the files store
    if (project.sourceFiles && Array.isArray(project.sourceFiles)) {
      for (const fileInfo of project.sourceFiles) {
        try {
          await db.delete("files", fileInfo.fileId);
          console.log(
            `Deleted media file ${fileInfo.fileId} for project ${projectId}`
          );
        } catch (fileError) {
          console.warn(`Failed to delete file ${fileInfo.fileId}:`, fileError);
        }
      }
    }

    // Finally, delete the project itself
    await db.delete("projects", projectId);
    console.log(
      `Successfully deleted project ${projectId} and all associated media files`
    );
  } catch (error) {
    toast.error("Error deleting project");
    console.error("Error deleting project:", error);
  }
};

export const listProjects = async () => {
  if (typeof window === "undefined") return [];
  try {
    const db = await setupDB();
    if (!db) return [];
    return await db.getAll("projects");
  } catch (error) {
    console.error("Error listing projects:", error);
    return [];
  }
};

// Storyboard storage functions
export const saveStoryboard = async (storyboardId: string, data: any) => {
  if (typeof window === "undefined") return null;
  try {
    const db = await setupDB();
    if (!db) return null;

    const storyboardData = {
      id: storyboardId,
      data: data,
      timestamp: Date.now(),
    };

    await db.put("storyboards", storyboardData);
    console.log(`✅ Saved storyboard ${storyboardId} to IndexedDB`);
    return storyboardId;
  } catch (error) {
    console.error("Error saving storyboard:", error);
    return null;
  }
};

export const getStoryboard = async (storyboardId: string) => {
  if (typeof window === "undefined") return null;
  try {
    const db = await setupDB();
    if (!db) return null;

    const result = await db.get("storyboards", storyboardId);
    if (!result) return null;

    console.log(`📂 Loaded storyboard ${storyboardId} from IndexedDB`);
    return result.data;
  } catch (error) {
    console.error("Error retrieving storyboard:", error);
    return null;
  }
};

export const listStoryboards = async () => {
  if (typeof window === "undefined") return [];
  try {
    const db = await setupDB();
    if (!db) return [];
    const results = await db.getAll("storyboards");
    return results.map((item) => ({
      id: item.id,
      timestamp: item.timestamp,
      title: item.data?.plan?.title || "Untitled Plan",
    }));
  } catch (error) {
    console.error("Error listing storyboards:", error);
    return [];
  }
};

export const deleteStoryboard = async (storyboardId: string) => {
  if (typeof window === "undefined") return;
  try {
    const db = await setupDB();
    if (!db) return;
    await db.delete("storyboards", storyboardId);
    console.log(`🗑️ Deleted storyboard ${storyboardId} from IndexedDB`);
  } catch (error) {
    console.error("Error deleting storyboard:", error);
  }
};

// Utility function to clean up orphaned files (files not associated with any project)
export const cleanupOrphanedFiles = async () => {
  if (typeof window === "undefined") return;
  try {
    const db = await setupDB();
    if (!db) return;

    const projects = await db.getAll("projects");
    const allFiles = await db.getAll("files");

    // Get all file IDs that are still associated with projects
    const activeFileIds = new Set<string>();
    projects.forEach((project) => {
      if (project.sourceFiles && Array.isArray(project.sourceFiles)) {
        project.sourceFiles.forEach((fileInfo: any) =>
          activeFileIds.add(fileInfo.fileId)
        );
      }
    });

    // Delete files that are not associated with any project
    let deletedCount = 0;
    for (const file of allFiles) {
      if (!activeFileIds.has(file.id)) {
        await db.delete("files", file.id);
        deletedCount++;
        console.log(`Deleted orphaned file: ${file.id}`);
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} orphaned files`);
    }
  } catch (error) {
    console.error("Error cleaning up orphaned files:", error);
  }
};

export const store = configureStore({
  reducer: {
    projectState: projectStateReducer,
    projects: projectsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// TODO: remove old state (localStorage we use indexedDB now) that is not used anymore

// Load persisted state from localStorage
// const persistedState = loadState();
// if (persistedState) {
//     store.dispatch({
//         type: 'REPLACE_STATE',
//         payload: persistedState
//     });
// }

// TODO: for some reason state get saved to localStorage twice when its none cause loss of old state i shall find better way to do this later
// Subscribe to store changes to save to localStorage
// if (typeof window !== 'undefined') {
//     let isInitial = 2;
//     store.subscribe(() => {
//         if (isInitial) {
//             isInitial -= 1;
//             return;
//         }

//         const state = store.getState();
//         saveState(state);
//     });
// }

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
