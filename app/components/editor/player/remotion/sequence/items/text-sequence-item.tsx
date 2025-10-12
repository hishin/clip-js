import { TextElement } from "@/app/types";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { setTextElements } from "@/app/store/slices/projectSlice";
import { DEFAULT_TRACK_Z_INDEX } from "@/app/utils/utils";
import { Sequence } from "remotion";

const REMOTION_SAFE_FRAME = 0;

interface SequenceItemOptions {
    handleTextChange?: (id: string, text: string) => void;
    fps: number;
    editableTextId?: string | null;
    currentTime?: number;
}

const calculateFrames = (
    display: { from: number; to: number },
    fps: number
) => {
    const from = display.from * fps;
    const to = display.to * fps;
    const durationInFrames = Math.max(1, to - from);
    return { from, durationInFrames };
};

export const TextSequenceItem: React.FC<{ item: TextElement; options: SequenceItemOptions }> = ({ item, options }) => {
    const { handleTextChange, fps, editableTextId } = options;
    const dispatch = useAppDispatch();
    const { textElements, resolution } = useAppSelector((state) => state.projectState);

    const { from, durationInFrames } = calculateFrames(
        {
            from: item.positionStart,
            to: item.positionEnd
        },
        fps
    );

    const onUpdateText = (id: string, updates: Partial<TextElement>) => {
        dispatch(setTextElements(textElements.map(text =>
            text.id === id ? { ...text, ...updates } : text
        )));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX - item.x;
        const startY = e.clientY - item.y;

        const handleMouseMove = (e: MouseEvent) => {
            const newX = e.clientX - startX;
            const newY = e.clientY - startY;
            onUpdateText(item.id, { x: newX, y: newY});
            
            // handleTextChange fonksiyonu varsa pozisyon güncellemesini bildir
            if (handleTextChange) {
                // Burada pozisyon değişikliğini parent component'e bildirebiliriz
                // handleTextChange(item.id, `position:${newX},${newY}`);
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // TODO: add more options for text
    return (
        <Sequence
            className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-text `}
            key={item.id}
            from={from}
            durationInFrames={durationInFrames + REMOTION_SAFE_FRAME}
            data-track-item="transition-element"
            style={{
                position: "absolute",
                width: item.width || 3000,
                height: item.height || 400,
                fontSize: item.fontSize || "16px",
                top: item.y,
                left: item.x,
                color: item.color || "#000000",
                zIndex: DEFAULT_TRACK_Z_INDEX.text,
                // backgroundColor: item.backgroundColor || "transparent",
                opacity: item.opacity! / 100,
                fontFamily: item.font || "Arial",
            }}
        >
            <div
                data-text-id={item.id}
                style={{
                    height: "100%",
                    boxShadow: "none",
                    outline: "none",
                    whiteSpace: "normal",
                    backgroundColor: item.backgroundColor || "transparent",
                    position: "relative",
                    width: "100%",
                    cursor:"move",
                }}
                onMouseDown={handleMouseDown}
                // onMouseMove={handleMouseMove}
                // onMouseUp={handleMouseUp}
                dangerouslySetInnerHTML={{ __html: item.text }}
                className="designcombo_textLayer"
            />
        </Sequence>
    );
};