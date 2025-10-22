"use client";

import { listStoryboards, deleteStoryboard, getStoryboard } from '@/app/store';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { StoryboardData } from '@/app/types/storyboard';

interface SavedNote {
    id: string;
    title: string;
    timestamp: number;
}

interface NotesListProps {
    projectId: string;
    currentNoteId?: string;
    onNoteSelect: (id: string, data: StoryboardData) => void;
    onExport: (id: string, data: StoryboardData) => void;
}

export default function NotesList({ projectId, currentNoteId, onNoteSelect, onExport }: NotesListProps) {
    const [notes, setNotes] = useState<SavedNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadNotes = async () => {
        setIsLoading(true);
        try {
            const notesList = await listStoryboards(projectId);
            // Sort by timestamp, newest first
            notesList.sort((a, b) => b.timestamp - a.timestamp);
            setNotes(notesList);
        } catch (error) {
            console.error('Failed to load notes:', error);
            toast.error('Failed to load saved notes');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNotes();
    }, [projectId]);

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}"?`)) return;
        
        try {
            await deleteStoryboard(id);
            setNotes(notes.filter(note => note.id !== id));
            toast.success('Note deleted');
        } catch (error) {
            console.error('Failed to delete note:', error);
            toast.error('Failed to delete note');
        }
    };

    const handleSelect = async (id: string) => {
        try {
            const data = await getStoryboard(id);
            if (data) {
                onNoteSelect(id, data);
                toast.success('Note loaded');
            } else {
                toast.error('Note not found');
            }
        } catch (error) {
            console.error('Failed to load note:', error);
            toast.error('Failed to load note');
        }
    };

    const handleExport = async (id: string) => {
        try {
            const data = await getStoryboard(id);
            if (data) {
                onExport(id, data);
            } else {
                toast.error('Note not found');
            }
        } catch (error) {
            console.error('Failed to export note:', error);
            toast.error('Failed to export note');
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">No saved notes yet</p>
                <p className="text-xs mt-1">Create a plan to start</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {notes.map((note) => (
                <div 
                    key={note.id} 
                    className={`
                        border border-gray-700 p-3 rounded 
                        ${currentNoteId === note.id 
                            ? 'bg-blue-900 bg-opacity-30 border-blue-600' 
                            : 'bg-black bg-opacity-30 hover:bg-opacity-40'
                        }
                        transition-all
                    `}
                >
                    <div className="flex items-start justify-between gap-2">
                        <button
                            onClick={() => handleSelect(note.id)}
                            className="flex-1 text-left min-w-0"
                        >
                            <div className="text-sm font-medium truncate text-gray-200" title={note.title}>
                                {note.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {formatDate(note.timestamp)}
                            </div>
                        </button>
                        
                        <div className="flex gap-1 flex-shrink-0">
                            {/* Export button */}
                            <button
                                onClick={() => handleExport(note.id)}
                                className="text-green-500 hover:text-green-400 p-1"
                                aria-label="Export note"
                                title="Export to file"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                            
                            {/* Delete button */}
                            <button
                                onClick={() => handleDelete(note.id, note.title)}
                                className="text-red-500 hover:text-red-400 p-1"
                                aria-label="Delete note"
                                title="Delete note"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

