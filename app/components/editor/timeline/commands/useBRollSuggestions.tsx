/**
 * B-Roll Suggestion Command Hook
 * 
 * PATTERN FOR TIMELINE ASSISTANT COMMANDS:
 * - request(sendWithContext): Triggers the command, hook provides message data
 * - setResult(data): Receives result from websocket, opens panel
 * - Panel: React component to display in Assistant panel
 * - handleConfirm/handleCancel: User actions on previewed results
 * 
 * Usage in page.tsx:
 *   const command = useCommandHook({ onOpen, onClose });
 *   command.request(sendCommandWithContext);
 *   // In websocket handler: command.setResult(data);
 *   // In assistant panel: <command.Panel />
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useAppSelector, useAppDispatch, getFile } from "@/app/store";
import { setMediaFiles } from "@/app/store/slices/projectSlice";
import BRollSuggestionPanel from "../BRollSuggestionPanel";
import toast from "react-hot-toast";
import type { MediaFile } from "@/app/types";
import { DEFAULT_TRACK_Z_INDEX, generateNextClipId, categorizeFile } from "@/app/utils/utils";

interface BRollSuggestion {
  id: string;
  fileAlias: string;
  sourceStartMs: number;
  sourceEndMs: number;
  description?: string;
}

interface UseBRollSuggestionsProps {
  onOpen?: () => void;
  onClose?: () => void;
}

export function useBRollSuggestions(props?: UseBRollSuggestionsProps) {
  const { onOpen, onClose } = props || {};
  const dispatch = useAppDispatch();
  
  // Select only specific pieces of state to avoid unnecessary re-renders
  const sourceFiles = useAppSelector((state) => state.projectState.sourceFiles);
  const mediaFiles = useAppSelector((state) => state.projectState.mediaFiles);
  const textElements = useAppSelector((state) => state.projectState.textElements);
  const currentTime = useAppSelector((state) => state.projectState.currentTime);

  // Use refs to track latest values without triggering callback recreation
  const mediaFilesRef = useRef(mediaFiles);
  const textElementsRef = useRef(textElements);
  const currentTimeRef = useRef(currentTime);
  
  // Keep refs in sync with latest values
  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);
  
  useEffect(() => {
    textElementsRef.current = textElements;
  }, [textElements]);
  
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const [suggestions, setSuggestionsState] = useState<BRollSuggestion[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Expose setSuggestions to external callers (websocket handler)
  // This will be called when backend sends suggestions
  const setSuggestions = useCallback((newSuggestions: BRollSuggestion[]) => {
    if (newSuggestions.length === 0) {
      toast.error("No b-roll suggestions found");
      return;
    }
    
    setSuggestionsState(newSuggestions);
    setIsPanelOpen(true);
    onOpen?.(); // Notify parent to switch to assistant tab
  }, [onOpen]);

  // Request suggestions from backend via websocket
  // Follows command pattern: hook provides message data, page adds context
  const request = useCallback((sendWithContext: (data: any) => void) => {
    console.log('🎬 Requesting b-roll suggestions from backend...');
    toast.loading("Finding b-roll suggestions...", { duration: 2000 });
    
    sendWithContext({
      type: "suggest_broll"
    });
  }, []);

  // Helper to create a MediaFile from a suggestion
  const createClipFromSuggestion = useCallback(
    async (suggestion: BRollSuggestion, insertPosition: number): Promise<MediaFile | null> => {
      const sourceFile = sourceFiles.find(
        (sf) => sf.alias === suggestion.fileAlias
      );

      if (!sourceFile) {
        console.error(`Source file not found for alias: ${suggestion.fileAlias}`);
        return null;
      }

      // Fetch the file and create fresh ObjectURL (like AddMedia and insertClipInTimeline do)
      const file = await getFile(sourceFile.fileId);
      if (!file) {
        console.error(`File not found: ${sourceFile.fileId}`);
        return null;
      }

      const mediaType = categorizeFile(file.type);

      const durationSeconds =
        (suggestion.sourceEndMs - suggestion.sourceStartMs) / 1000;

      return {
        id: `preview-${crypto.randomUUID()}`, // Temporary preview ID - will be regenerated on confirm
        fileName: sourceFile.fileName,
        fileId: sourceFile.fileId,
        type: mediaType, // Use categorized type from file
        src: URL.createObjectURL(file), // Create fresh ObjectURL
        startTime: suggestion.sourceStartMs / 1000,
        endTime: suggestion.sourceEndMs / 1000,
        positionStart: insertPosition,
        positionEnd: insertPosition + durationSeconds,
        includeInMerge: true,
        // Add visual properties like AddMedia and insertClipInTimeline do
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        rotation: 0,
        opacity: 100,
        crop: { x: 0, y: 0, width: 1920, height: 1080 },
        playbackSpeed: 1,
        volume: 0, // B-roll is usually muted
        zIndex: DEFAULT_TRACK_Z_INDEX["b-roll"],
        track: "b-roll",
        suggestedState: "suggested_addition",
        suggestionId: suggestion.id,
      };
    },
    [sourceFiles]
  );

  // Store functions in refs to keep all callbacks stable
  const createClipRef = useRef(createClipFromSuggestion);
  const onCloseRef = useRef(onClose);
  
  useEffect(() => {
    createClipRef.current = createClipFromSuggestion;
  }, [createClipFromSuggestion]);
  
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Toggle preview: instantly add/remove clip from timeline
  const handleTogglePreview = useCallback(
    async (suggestion: BRollSuggestion, clipId?: string) => {
      // Use refs to access latest values without callback recreation
      const currentMediaFiles = mediaFilesRef.current;
      const currentPlayhead = currentTimeRef.current;
      
      if (clipId) {
        // UNCHECKING: Remove from timeline using provided clipId
        const updatedMediaFiles = currentMediaFiles.filter(
          (clip) => clip.id !== clipId
        );
        dispatch(setMediaFiles(updatedMediaFiles));
      } else {
        // CHECKING: Add to timeline
        
        // Calculate insert position (at playhead or after last previewed clip)
        const existingSuggestedClips = currentMediaFiles.filter(
          (clip) => clip.suggestedState === "suggested_addition"
        );
        
        let insertPosition = currentPlayhead;
        if (existingSuggestedClips.length > 0) {
          // Insert after the last suggested clip
          const lastClip = existingSuggestedClips.reduce((latest, clip) =>
            clip.positionEnd > latest.positionEnd ? clip : latest
          );
          insertPosition = lastClip.positionEnd;
        }

        const newClip = await createClipRef.current(suggestion, insertPosition);
        if (newClip) {
          dispatch(setMediaFiles([...currentMediaFiles, newClip]));
        }
      }
    },
    [dispatch]
  );

  // Confirm: remove suggestedState from all suggested clips (make permanent)
  const handleConfirm = useCallback(() => {
    // Use refs to access latest values
    const currentMediaFiles = mediaFilesRef.current;
    const currentTextElements = textElementsRef.current;
    
    const confirmedCount = currentMediaFiles.filter(
      (clip) => clip.suggestedState === "suggested_addition"
    ).length;

    // Regenerate proper sequential IDs for confirmed clips
    const permanentMediaFiles = currentMediaFiles.filter(
      (clip) => clip.suggestedState !== "suggested_addition"
    );
    
    const updatedMediaFiles = currentMediaFiles.map((clip) => {
      if (clip.suggestedState === "suggested_addition") {
        const { suggestedState, suggestionId, ...rest } = clip;
        // Generate proper sequential ID (not temporary preview ID)
        const newId = generateNextClipId(
          [...permanentMediaFiles, ...currentTextElements],
          rest.type
        );
        permanentMediaFiles.push({ ...rest, id: newId } as MediaFile);
        return { ...rest, id: newId } as MediaFile;
      }
      return clip;
    });

    dispatch(setMediaFiles(updatedMediaFiles));
    setIsPanelOpen(false);
    onCloseRef.current?.();
    
    toast.success(`Confirmed ${confirmedCount} b-roll clip(s)`);
  }, [dispatch]);

  // Cancel: remove all suggested clips from timeline
  const handleCancel = useCallback(() => {
    // Use ref to access latest values
    const currentMediaFiles = mediaFilesRef.current;
    
    const updatedMediaFiles = currentMediaFiles.filter(
      (clip) => clip.suggestedState !== "suggested_addition"
    );

    dispatch(setMediaFiles(updatedMediaFiles));
    setIsPanelOpen(false);
    onCloseRef.current?.();
  }, [dispatch]);

  // Panel component with instant preview functionality
  const Panel = useCallback(
    () => (
      <BRollSuggestionPanel
        suggestions={suggestions}
        onTogglePreview={handleTogglePreview}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [suggestions, handleTogglePreview, handleConfirm, handleCancel]
  );

  return {
    request,
    setSuggestions,
    Panel,
    isOpen: isPanelOpen,
    suggestions,
    handleTogglePreview,
    handleConfirm,
    handleCancel,
  };
}

