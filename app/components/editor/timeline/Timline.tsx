import { useAppSelector } from "@/app/store";
import { setMarkerTrack, setTextElements, setMediaFiles, setTimelineZoom, setCurrentTime, setIsPlaying, setActiveElement, setSelectedClips, setSelectedRange, clearSelection } from "@/app/store/slices/projectSlice";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import Image from "next/image";
import Header from "./Header";
import VideoTimeline from "./elements-timeline/VideoTimeline";
import ImageTimeline from "./elements-timeline/ImageTimeline";
import AudioTimeline from "./elements-timeline/AudioTimline";
import TextTimeline from "./elements-timeline/TextTimeline";
import { throttle } from 'lodash';
import GlobalKeyHandlerProps from "../../../components/editor/keys/GlobalKeyHandlerProps";
import { generateNextClipId } from "@/app/utils/utils";
import toast from "react-hot-toast";
import { MediaFile, TextElement } from "@/app/types";
export const Timeline = () => {
    const { currentTime, timelineZoom, enableMarkerTracking, activeElement, activeElementIndex, mediaFiles, textElements, duration, isPlaying, selectedClips } = useAppSelector((state) => state.projectState);
    const dispatch = useDispatch();
    const timelineRef = useRef<HTMLDivElement>(null);
    const [selectionBox, setSelectionBox] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        isSelecting: boolean;
    } | null>(null);

    const throttledZoom = useMemo(() =>
        throttle((value: number) => {
            dispatch(setTimelineZoom(value));
        }, 100),
        [dispatch]
    );

    // Helper function to determine track Y positions
    const getClipYPosition = useCallback((clip: any, type: 'media' | 'text') => {
        // Get header height to offset track positions
        const headerElement = timelineRef.current?.querySelector('.timeline-header');
        const headerHeight = headerElement?.getBoundingClientRect().height || 0;
        
        let trackCenter = 0;
        if (type === 'text') {
            trackCenter = 24; // Text track center relative to track area
        }
        if (type === 'media') {
            if (clip.type === 'image') {
                trackCenter = 72; // Image track center
            }
            if (clip.type === 'video') {
                trackCenter = clip.track === 'b-roll' ? 120 : 168; // B-roll or A-roll
            }
            if (clip.type === 'audio') {
                trackCenter = 216; // Audio track center
            }
        }
        return trackCenter + headerHeight; // Add header offset so positions are relative to timeline container
    }, []);

    // Update selected clips based on marquee box intersection
    const updateSelectedClips = useCallback((startX: number, startY: number, currentX: number, currentY: number) => {
        const minX = Math.min(startX, currentX) / timelineZoom;
        const maxX = Math.max(startX, currentX) / timelineZoom;
        const minY = Math.min(startY, currentY);
        const maxY = Math.max(startY, currentY);

        // Check media files for intersection
        const selectedMediaClips = mediaFiles.filter(clip => {
            const clipStart = clip.positionStart;
            const clipEnd = clip.positionEnd;
            const clipY = getClipYPosition(clip, 'media');
            
            // Check if clip intersects with selection box
            return (
                clipStart < maxX &&
                clipEnd > minX &&
                clipY >= minY - 24 && // Half track height
                clipY <= maxY + 24
            );
        });

        // Check text elements for intersection
        const selectedTextClips = textElements.filter(text => {
            const textStart = text.positionStart;
            const textEnd = text.positionEnd;
            const textY = getClipYPosition(text, 'text');
            
            return (
                textStart < maxX &&
                textEnd > minX &&
                textY >= minY - 24 &&
                textY <= maxY + 24
            );
        });

        const selectedMedia = selectedMediaClips.map(clip => clip.id);
        const selectedText = selectedTextClips.map(text => text.id);

        dispatch(setSelectedClips({ media: selectedMedia, text: selectedText }));

        // Calculate and dispatch selected range
        const allSelectedClips = [...selectedMediaClips, ...selectedTextClips];
        if (allSelectedClips.length > 0) {
            const startTime = Math.min(...allSelectedClips.map(clip => clip.positionStart));
            const endTime = Math.max(...allSelectedClips.map(clip => clip.positionEnd));
            dispatch(setSelectedRange({ start: startTime, end: endTime }));
        } else {
            dispatch(setSelectedRange({ start: undefined, end: undefined }));
        }
    }, [mediaFiles, textElements, timelineZoom, dispatch, getClipYPosition]);

    const handleSplit = () => {
        const { media, text } = selectedClips;
        const totalSelected = media.length + text.length;
        
        // Check if anything is selected
        if (totalSelected === 0) {
            toast.error('No element selected.');
            return;
        }
        
        // Split only works with single clip selection
        if (totalSelected > 1) {
            toast.error('Split only works with a single element. Please select one clip.');
            return;
        }

        // Determine which type of element is selected
        const selectedType = media.length > 0 ? 'media' : 'text';
        const selectedId = media.length > 0 ? media[0] : text[0];

        if (selectedType === 'media') {
            const elements = [...mediaFiles];
            const element = elements.find(e => e.id === selectedId);

            if (!element) {
                toast.error('No element selected.');
                return;
            }

            const { positionStart, positionEnd } = element;

            if (currentTime <= positionStart || currentTime >= positionEnd) {
                toast.error('Marker is outside the selected element bounds.');
                return;
            }

            const positionDuration = positionEnd - positionStart;

            // Media logic (uses startTime/endTime for trimming)
            const { startTime, endTime } = element;
            const sourceDuration = endTime - startTime;
            const ratio = (currentTime - positionStart) / positionDuration;
            const splitSourceOffset = startTime + ratio * sourceDuration;

            const firstPart = {
                ...element,
                id: generateNextClipId([...mediaFiles, ...textElements], element.type),
                positionStart,
                positionEnd: currentTime,
                startTime,
                endTime: splitSourceOffset
            };

            const secondPart = {
                ...element,
                id: generateNextClipId([...mediaFiles, ...textElements, firstPart], element.type),
                positionStart: currentTime,
                positionEnd,
                startTime: splitSourceOffset,
                endTime
            };

            const elementIndex = elements.findIndex(e => e.id === selectedId);
            elements.splice(elementIndex, 1, firstPart, secondPart);
            
            dispatch(setMediaFiles(elements));
            dispatch(clearSelection());
            dispatch(setActiveElement(null));
            toast.success('Element split successfully.');
        } else if (selectedType === 'text') {
            const elements = [...textElements];
            const element = elements.find(e => e.id === selectedId);

            if (!element) {
                toast.error('No element selected.');
                return;
            }

            const { positionStart, positionEnd } = element;

            if (currentTime <= positionStart || currentTime >= positionEnd) {
                toast.error('Marker is outside the selected element.');
                return;
            }

            const firstPart = {
                ...element,
                id: generateNextClipId([...mediaFiles, ...textElements], 'text'),
                positionStart,
                positionEnd: currentTime,
            };

            const secondPart = {
                ...element,
                id: generateNextClipId([...mediaFiles, ...textElements, firstPart], 'text'),
                positionStart: currentTime,
                positionEnd,
            };

            const elementIndex = elements.findIndex(e => e.id === selectedId);
            elements.splice(elementIndex, 1, firstPart, secondPart);
            
            dispatch(setTextElements(elements));
            dispatch(clearSelection());
            dispatch(setActiveElement(null));
            toast.success('Element split successfully.');
        }
    };

    const handleDuplicate = () => {
        const { media, text } = selectedClips;
        const totalSelected = media.length + text.length;
        
        if (totalSelected === 0) {
            toast.error('No elements selected.');
            return;
        }
        
        // Duplicate selected media clips
        const duplicatedMedia = mediaFiles
            .filter(clip => media.includes(clip.id))
            .map(clip => ({
                ...clip,
                id: generateNextClipId([...mediaFiles, ...textElements], clip.type),
            }));
        
        // Duplicate selected text elements
        const duplicatedText = textElements
            .filter(txt => text.includes(txt.id))
            .map(txt => ({
                ...txt,
                id: generateNextClipId([...mediaFiles, ...textElements, ...duplicatedMedia], 'text'),
            }));
        
        // Update state
        dispatch(setMediaFiles([...mediaFiles, ...duplicatedMedia]));
        dispatch(setTextElements([...textElements, ...duplicatedText]));
        dispatch(clearSelection());
        dispatch(setActiveElement(null));
        
        toast.success(`Duplicated ${totalSelected} element(s).`);
    };

    const handleDelete = () => {
        const { media, text } = selectedClips;
        const totalSelected = media.length + text.length;
        
        // Check if anything is selected
        if (totalSelected === 0) {
            toast.error('No elements selected.');
            return;
        }
        
        // Optional: Confirm for multiple deletions
        if (totalSelected > 1) {
            const confirmed = window.confirm(
                `Are you sure you want to delete ${totalSelected} element(s)?`
            );
            if (!confirmed) return;
        }
        
        // Get all selected media clips
        const selectedMediaClips = mediaFiles.filter(clip => media.includes(clip.id));
        
        // Check if any a-roll clips are being deleted
        const hasArollDeletion = selectedMediaClips.some(clip => clip.track === 'a-roll');
        
        let newMediaFiles: MediaFile[];
        let newTextElements: TextElement[];
        
        if (hasArollDeletion) {
            // TRACK-AWARE RIPPLE DELETE: Ripple a-roll, b-roll, image, and text tracks
            console.log('🗑️ A-roll deletion detected - applying ripple delete');
            
            // Sort selected clips by position (left to right)
            const sortedSelectedClips = [...selectedMediaClips].sort(
                (a, b) => a.positionStart - b.positionStart
            );
            
            // Calculate cumulative offset for ripple
            let cumulativeOffset = 0;
            const deletionRanges: Array<{ start: number; end: number; duration: number }> = [];
            
            // Build deletion ranges
            for (const clip of sortedSelectedClips) {
                deletionRanges.push({
                    start: clip.positionStart,
                    end: clip.positionEnd,
                    duration: clip.positionEnd - clip.positionStart
                });
            }
            
            // Process all media files
            newMediaFiles = [];
            for (const clip of mediaFiles) {
                // Skip deleted clips
                if (media.includes(clip.id)) {
                    continue;
                }
                
                // Calculate ripple offset for this clip
                let rippleOffset = 0;
                for (const range of deletionRanges) {
                    // If clip starts after a deletion range, add that range's duration to offset
                    if (clip.positionStart >= range.end) {
                        rippleOffset += range.duration;
                    }
                }
                
                // Apply ripple to a-roll, b-roll, and image tracks
                if (
                    (clip.track === 'a-roll' || clip.track === 'b-roll' || clip.track === 'image') &&
                    rippleOffset > 0
                ) {
                    console.log(`🗑️ Rippling ${clip.track} clip ${clip.id} by -${rippleOffset}s`);
                    newMediaFiles.push({
                        ...clip,
                        positionStart: clip.positionStart - rippleOffset,
                        positionEnd: clip.positionEnd - rippleOffset
                    });
                } else {
                    // Keep clip unchanged (audio or clips before deletion)
                    newMediaFiles.push(clip);
                }
            }
            
            // Process text elements (ripple them too)
            newTextElements = textElements
                .filter(txt => !text.includes(txt.id)) // Remove deleted text elements
                .map(txt => {
                    // Calculate ripple offset for this text element
                    let rippleOffset = 0;
                    for (const range of deletionRanges) {
                        if (txt.positionStart >= range.end) {
                            rippleOffset += range.duration;
                        }
                    }
                    
                    if (rippleOffset > 0) {
                        console.log(`🗑️ Rippling text ${txt.id} by -${rippleOffset}s`);
                        return {
                            ...txt,
                            positionStart: txt.positionStart - rippleOffset,
                            positionEnd: txt.positionEnd - rippleOffset
                        };
                    }
                    return txt;
                });
            
        } else {
            // NON-RIPPLE DELETE: Only b-roll/image/audio - just remove them (leave gaps)
            console.log('🗑️ No a-roll deletion - removing clips without ripple');
            
            // Filter out selected media clips
            newMediaFiles = mediaFiles.filter(clip => !media.includes(clip.id));
            
            // Filter out selected text elements
            newTextElements = textElements.filter(txt => !text.includes(txt.id));
        }
        
        // Update state
        dispatch(setMediaFiles(newMediaFiles));
        dispatch(setTextElements(newTextElements));
        dispatch(clearSelection());
        dispatch(setActiveElement(null));
        
        toast.success(`Deleted ${totalSelected} element(s).`);
    };

    const handleClearTimeline = () => {
        const mediaCount = mediaFiles.length;
        const textCount = textElements.length;
        
        if (mediaCount === 0 && textCount === 0) {
            toast.error('Timeline is already empty.');
            return;
        }

        // Confirm before clearing
        const confirmed = window.confirm(
            `Are you sure you want to clear the entire timeline? This will remove ${mediaCount} media file(s) and ${textCount} text element(s). This action cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        // Clear the timeline
        dispatch(setMediaFiles([]));
        dispatch(setTextElements([]));
        dispatch(setActiveElement(null));
        toast.success(`Timeline cleared: Removed ${mediaCount} media file(s) and ${textCount} text element(s).`);
    };


    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;

        const target = e.target as HTMLElement;
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollOffset = timelineRef.current.scrollLeft;
        const startX = e.clientX - rect.left + scrollOffset;
        const startY = e.clientY - rect.top;

        // Check if clicking on empty space (not on a clip element)
        const isClickOnClip = target.closest('.timeline-clip');
        
        if (!isClickOnClip) {
            // Record potential selection start, but don't start selecting yet
            setSelectionBox({
                startX,
                startY,
                currentX: startX,
                currentY: startY,
                isSelecting: false, // Don't start selecting until mouse moves
            });

            // Clear existing selection if not holding modifier key
            if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                dispatch(clearSelection());
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!selectionBox || !timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const scrollOffset = timelineRef.current.scrollLeft;
        const currentX = e.clientX - rect.left + scrollOffset;
        const currentY = e.clientY - rect.top;

        // Check if mouse has moved beyond threshold (5px)
        const deltaX = Math.abs(currentX - selectionBox.startX);
        const deltaY = Math.abs(currentY - selectionBox.startY);
        const threshold = 5;

        if (!selectionBox.isSelecting && (deltaX > threshold || deltaY > threshold)) {
            // Start selection if movement exceeds threshold
            setSelectionBox({
                ...selectionBox,
                currentX,
                currentY,
                isSelecting: true,
            });
        } else if (selectionBox.isSelecting) {
            // Continue updating selection
            setSelectionBox({
                ...selectionBox,
                currentX,
                currentY,
            });

            // Update selected clips
            updateSelectedClips(selectionBox.startX, selectionBox.startY, currentX, currentY);
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (selectionBox) {
            if (!selectionBox.isSelecting) {
                // No significant movement - treat as a click to move playhead
                if (!timelineRef.current) return;
                
                dispatch(setIsPlaying(false));
                const rect = timelineRef.current.getBoundingClientRect();
                const scrollOffset = timelineRef.current.scrollLeft;
                const clickX = e.clientX - rect.left + scrollOffset;
                const seconds = clickX / timelineZoom;
                const clampedTime = Math.max(0, Math.min(duration, seconds));
                dispatch(setCurrentTime(clampedTime));
            }
            // Clear selection box
            setSelectionBox(null);
        }
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;

        dispatch(setIsPlaying(false));
        const rect = timelineRef.current.getBoundingClientRect();

        const scrollOffset = timelineRef.current.scrollLeft;
        const offsetX = e.clientX - rect.left + scrollOffset;

        const seconds = offsetX / timelineZoom;
        const clampedTime = Math.max(0, Math.min(duration, seconds));

        dispatch(setCurrentTime(clampedTime));
    };

    return (
        <div className="flex w-full flex-col gap-2">
            <div className="flex flex-row items-center justify-between gap-12 w-full">
                <div className="flex flex-row items-center gap-2">
                    {/* Track Marker */}
                    <button
                        onClick={() => dispatch(setMarkerTrack(!enableMarkerTracking))}
                        className="bg-white dark:bg-gray-800 rounded-md transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 mt-2 w-9 h-9 p-2"
                        title={`Track Marker (T) - ${enableMarkerTracking ? 'Enabled' : 'Disabled'}`}
                    >
                        <Image
                            alt="Track Marker"
                            className={`h-auto w-auto max-w-[20px] max-h-[20px] dark:invert ${enableMarkerTracking ? 'opacity-100' : 'opacity-50'}`}
                            height={20}
                            width={20}
                            src="/Smock_CheckmarkCircleOutline_18_N.svg"
                        />
                    </button>
                    {/* Split */}
                    <button
                        onClick={handleSplit}
                        className="bg-white dark:bg-gray-800 rounded-md transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 mt-2 w-9 h-9 p-2"
                        title="Split (S)"
                    >
                        <Image
                            alt="Split"
                            className="h-auto w-auto max-w-[20px] max-h-[20px] dark:invert"
                            height={20}
                            width={20}
                            src="/Smock_Cut_18_N.svg"
                        />
                    </button>
                    {/* Duplicate */}
                    <button
                        onClick={handleDuplicate}
                        className="bg-white dark:bg-gray-800 rounded-md transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 mt-2 w-9 h-9 p-2"
                        title="Duplicate (D)"
                    >
                        <Image
                            alt="Duplicate"
                            className="h-auto w-auto max-w-[20px] max-h-[20px] dark:invert"
                            height={20}
                            width={20}
                            src="/Smock_Duplicate_18_N.svg"
                        />
                    </button>
                    {/* Delete */}
                    <button
                        onClick={handleDelete}
                        className="bg-white dark:bg-gray-800 rounded-md transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 mt-2 w-9 h-9 p-2"
                        title="Delete (Del)"
                    >
                        <Image
                            alt="Delete"
                            className="h-auto w-auto max-w-[20px] max-h-[20px] dark:invert"
                            height={20}
                            width={20}
                            src="/Smock_DeleteOutline_18_N.svg"
                        />
                    </button>
                    {/* Clear Timeline */}
                    <button
                        onClick={handleClearTimeline}
                        className="bg-white dark:bg-gray-800 rounded-md transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 mt-2 w-9 h-9 p-2"
                        title="Clear Timeline"
                    >
                        <Image
                            alt="Clear Timeline"
                            className="h-auto w-auto max-w-[20px] max-h-[20px] dark:invert"
                            height={20}
                            width={20}
                            src="/Smock_OfferDelete_18_N.svg"
                        />
                    </button>
                </div>

                {/* Timeline Zoom */}
                <div className="flex flex-row items-center gap-2 mr-4">
                    <button
                        onClick={() => throttledZoom(Math.max(30, timelineZoom - 10))}
                        className="rounded-md transition-opacity flex items-center justify-center opacity-60 hover:opacity-100 w-8 h-8 p-1.5"
                        title="Zoom Out"
                    >
                        <Image
                            alt="Zoom Out"
                            className="h-auto w-auto dark:invert"
                            height={18}
                            width={18}
                            src="/Smock_ZoomOut_18_N.svg"
                        />
                    </button>
                    <input
                        type="range"
                        min={30}
                        max={120}
                        step="1"
                        value={timelineZoom}
                        onChange={(e) => throttledZoom(Number(e.target.value))}
                        className="w-[100px] bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-md rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => throttledZoom(Math.min(120, timelineZoom + 10))}
                        className="rounded-md transition-opacity flex items-center justify-center opacity-60 hover:opacity-100 w-8 h-8 p-1.5"
                        title="Zoom In"
                    >
                        <Image
                            alt="Zoom In"
                            className="h-auto w-auto dark:invert"
                            height={18}
                            width={18}
                            src="/Smock_ZoomIn_18_N.svg"
                        />
                    </button>
                </div>
            </div>

            <div
                className="relative overflow-x-auto w-full border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 z-10"
                ref={timelineRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Timeline Header */}
                <Header />

                <div className="bg-gray-50 dark:bg-gray-900"

                    style={{
                        width: "100%", /* or whatever width your timeline requires */
                    }}
                >
                    {/* Timeline cursor */}
                    <div
                        className="absolute top-0 bottom-0 w-[2px] z-50"
                        style={{
                            left: `${currentTime * timelineZoom}px`,
                            backgroundColor: 'rgb(52, 91, 248)',
                        }}
                    />
                    {/* Selection box overlay */}
                    {selectionBox?.isSelecting && (
                        <div
                            className="absolute border-2 border-blue-400 bg-blue-200 bg-opacity-20 z-50 pointer-events-none"
                            style={{
                                left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                                top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                                width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                                height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
                            }}
                        />
                    )}
                    {/* Timeline elements */}
                    <div className="w-full">

                        {/* Text Track - highest z-index */}
                        <div className="relative h-12 z-10">
                            <TextTimeline />
                        </div>

                        {/* Image Track */}
                        <div className="relative h-12 z-10">
                            <ImageTimeline />
                        </div>

                        {/* V2 Track - B-roll */}
                        <div className="relative h-12 z-10">
                            <VideoTimeline track="b-roll" />
                        </div>

                        {/* V1 Track - A-roll */}
                        <div className="relative h-12 z-10">
                            <VideoTimeline track="a-roll" />
                        </div>

                        {/* Audio Track - lowest */}
                        <div className="relative h-12 z-10">
                            <AudioTimeline />
                        </div>

                    </div>
                </div>
            </div >
            <GlobalKeyHandlerProps handleDuplicate={handleDuplicate} handleSplit={handleSplit} handleDelete={handleDelete} />
        </div>

    );
};

export default memo(Timeline)
