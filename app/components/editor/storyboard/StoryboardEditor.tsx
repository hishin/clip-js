'use client';

import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlock } from "@blocknote/core";
import { 
  useCreateBlockNote, 
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  DefaultReactSuggestionItem 
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./blocknote-custom.css";
import { createVideoSegment } from './blocks/VideoSegmentBlock';
import { createContentSearch } from './blocks/ContentSearchBlock';
import { 
  withMultiColumn,
  multiColumnDropCursor,
} from "@blocknote/xl-multi-column";
import { useEffect, useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { flexiblePlanToBlockNote } from '@/app/utils/storyboardConverter';
import type { StoryboardData } from '@/app/types/storyboard';
import { useAppSelector } from '@/app/store';

interface StoryboardEditorProps {
  initialData: StoryboardData;
  storyboardId: string;
  onSave?: (blocks: any[]) => Promise<void>;
  onBuild?: (storyboardId: string) => void;
}

// Create custom schema with VideoSegment and ContentSearch, then add multi-column support
const schema = withMultiColumn(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      // Custom video segment block
      videoSegment: createVideoSegment(),
      // Custom content search block
      contentSearch: createContentSearch(),
    },
  })
);

// Custom Slash Menu item to insert content search block
const insertContentSearchItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Content Search",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "contentSearch",
    });
  },
  aliases: ["content", "search", "find", "visual"],
  group: "Media",
  subtext: "Search for visual content in your media files",
});

// List containing all default Slash Menu Items, plus our custom content search
const getCustomSlashMenuItems = (
  editor: typeof schema.BlockNoteEditor
): DefaultReactSuggestionItem[] => [
  ...getDefaultReactSlashMenuItems(editor),
  insertContentSearchItem(editor),
];

export default function StoryboardEditor({ 
  initialData, 
  storyboardId,
  onSave,
  onBuild
}: StoryboardEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Get sourceFiles for alias to fileName mapping
  const { sourceFiles } = useAppSelector((state) => state.projectState);
  
  // Convert flexible plan to BlockNote blocks on mount
  const blockNoteContent = useMemo(() => {
    if (initialData.document?.blocks) {
      return initialData.document.blocks;  // Already BlockNote format
    }
    return flexiblePlanToBlockNote(initialData.plan, sourceFiles);
  }, [initialData, sourceFiles]);
  
  // Debounced save function
  const handleSave = useCallback(async (blocks: any[]) => {
    if (!onSave) {
      setSaveStatus('saved');
      return;
    }
    
    try {
      setSaveStatus('saving');
      await onSave(blocks);
      setSaveStatus('saved');
      toast.success('Storyboard saved', { duration: 1000 });
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save storyboard');
      setSaveStatus('unsaved');
    }
  }, [onSave]);
  
  const debouncedSave = useMemo(
    () => debounce(handleSave, 1500),
    [handleSave]
  );
  
  // Create BlockNote editor with custom schema
  const editor = useCreateBlockNote({
    schema,
    initialContent: blockNoteContent.length > 0 ? blockNoteContent : undefined,
    // The default drop cursor only shows up above and below blocks - we replace
    // it with the multi-column one that also shows up on the sides of blocks.
    dropCursor: multiColumnDropCursor,
  });
  
  // Handle editor changes
  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      setSaveStatus('unsaved');
      debouncedSave(editor.document);
    });
    
    return () => {
      unsubscribe();
    };
  }, [editor, debouncedSave]);
  
  return (
    <div className="relative h-full flex flex-col bg-gray-950">
      {/* Header with Build Button and Save Status */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        {/* Build Button - Left Side */}
        {onBuild && (
          <button
            onClick={() => onBuild(storyboardId)}
            className="flex items-center gap-2 px-3 py-1.5 
                       bg-green-600 hover:bg-green-700 
                       text-white text-sm font-medium rounded
                       transition-colors duration-200"
            title="Build timeline from current storyboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Build
          </button>
        )}
        
        {/* Save Status - Right Side */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {saveStatus === 'saving' && (
            <>
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Saved</span>
            </>
          )}
          {saveStatus === 'unsaved' && (
            <>
              <div className="w-2 h-2 bg-gray-500 rounded-full" />
              <span>Unsaved changes</span>
            </>
          )}
        </div>
      </div>
      
      {/* BlockNote Editor */}
      <div className="flex-1 overflow-auto">
        <BlockNoteView 
          editor={editor} 
          theme="dark"
          className="blocknote-editor-dark"
          slashMenu={false}
        >
          <SuggestionMenuController
            triggerCharacter={"/"}
            getItems={async (query) =>
              filterSuggestionItems(getCustomSlashMenuItems(editor), query)
            }
          />
        </BlockNoteView>
      </div>
    </div>
  );
}

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
