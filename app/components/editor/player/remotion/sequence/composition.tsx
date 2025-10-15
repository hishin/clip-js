import { storeProject, useAppDispatch, useAppSelector } from "@/app/store";
import { SequenceItem } from "./sequence-item";
import { MediaFile, TextElement } from "@/app/types";
import { useCurrentFrame, useVideoConfig } from 'remotion';
import React, { use, useCallback, useEffect, useRef, useState } from "react";
import { setCurrentTime, setMediaFiles } from "@/app/store/slices/projectSlice";

const Composition = () => {
    const projectState = useAppSelector((state) => state.projectState);
    const { mediaFiles, textElements } = projectState;
    const frame = useCurrentFrame();
    const dispatch = useAppDispatch();

    const THRESHOLD = 0.1; // Minimum change to trigger dispatch (in seconds)
    const previousTime = useRef(0); // Store previous time to track changes

    useEffect(() => {
        const currentTimeInSeconds = frame / fps;
        if (Math.abs(currentTimeInSeconds - previousTime.current) > THRESHOLD) {
            if (currentTimeInSeconds !== undefined) {
                dispatch(setCurrentTime(currentTimeInSeconds));
            }
        }

    }, [frame, dispatch]);

    const fps = 30;
    return (
        <>
            {mediaFiles
                .map((item: MediaFile) => {
                    if (!item) return null;
                    const trackItem = {
                        ...item,
                    } as MediaFile;
                    return <React.Fragment key={trackItem.id}>
                        {SequenceItem[trackItem.type](trackItem, { fps })}
                    </React.Fragment>;
                })}
            {textElements
                .map((item: TextElement) => {
                    if (!item) return null;
                    const trackItem = {
                        ...item,
                    } as TextElement;
                    return <React.Fragment key={trackItem.id}>
                        {SequenceItem["text"](trackItem, { fps })}
                    </React.Fragment>;
                })}
        </>
    );
};

export default Composition;
