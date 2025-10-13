"use client";

import { getFile, useAppDispatch, useAppSelector } from "../../../../store";
import { setMediaFiles } from "../../../../store/slices/projectSlice";
import { storeFile } from "../../../../store";
import { categorizeFile, generateNextClipId, DEFAULT_TRACK_Z_INDEX, getDefaultTrackForMediaType } from "../../../../utils/utils";
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function AddMedia({ fileId }: { fileId: string }) {
    const { mediaFiles, textElements, sourceFiles } = useAppSelector((state) => state.projectState);
    const dispatch = useAppDispatch();

    const handleFileChange = async () => {
        const updatedMedia = [...mediaFiles];

        const file = await getFile(fileId);
        const mediaType = categorizeFile(file.type);
        const mediaId = generateNextClipId(
            [...mediaFiles, ...textElements],
            mediaType
        );

        if (fileId) {
            const relevantClips = mediaFiles.filter(clip => clip.type === categorizeFile(file.type));
            const lastEnd = relevantClips.length > 0
                ? Math.max(...relevantClips.map(f => f.positionEnd))
                : 0;

            // Get duration from sourceFiles metadata, fallback to 30 seconds
            const sourceFile = sourceFiles.find(sf => sf.fileId === fileId);
            const duration = sourceFile?.metadata?.durationSeconds ?? 30;

            const track = getDefaultTrackForMediaType(mediaType);
            updatedMedia.push({
                id: mediaId,
                fileName: file.name,
                fileId: fileId,
                startTime: 0,
                endTime: duration,
                src: URL.createObjectURL(file),
                positionStart: lastEnd,
                positionEnd: lastEnd + duration,
                includeInMerge: true,
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                rotation: 0,
                opacity: 100,
                crop: { x: 0, y: 0, width: 1920, height: 1080 },
                playbackSpeed: 1,
                volume: 100,
                type: mediaType,
                track: track,
                zIndex: DEFAULT_TRACK_Z_INDEX[track],
            });
        }
        dispatch(setMediaFiles(updatedMedia));
        toast.success('Media added successfully.');
    };

    return (
        <div
        >
            <label
                className="cursor-pointer rounded-full bg-white border border-solid border-transparent transition-colors flex flex-col items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] font-medium sm:text-base py-2 px-2"
            >
                <Image
                    alt="Add Project"
                    className="Black"
                    height={12}
                    width={12}
                    src="https://www.svgrepo.com/show/513803/add.svg"
                />
                {/* <span className="text-xs">Add Media</span> */}
                <button
                    onClick={handleFileChange}
                >
                </button>
            </label>
        </div>
    );
}
