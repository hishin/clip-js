import type {
  FlexiblePlan,
  BlockNoteDocument,
  StorylineSection,
} from "@/app/types/storyboard";
import type { FileInfo } from "@/app/types";

// Generate unique block IDs
function generateId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Converts a flexible backend plan format to BlockNote blocks array
 * @param plan - The flexible plan from backend
 * @param sourceFiles - Optional array of FileInfo to map alias to fileName
 */
export function flexiblePlanToBlockNote(
  plan: FlexiblePlan,
  sourceFiles?: FileInfo[]
): any[] {
  // Create alias to fileName mapping
  const aliasToFileName: Record<string, string> = {};

  if (sourceFiles) {
    sourceFiles.forEach((file) => {
      aliasToFileName[file.alias] = file.fileName;
    });
  }

  const blocks: any[] = [];

  // Title as heading level 1
  blocks.push({
    id: generateId(),
    type: "heading",
    props: {
      level: 1,
      textColor: "default",
      backgroundColor: "default",
      textAlignment: "left",
    },
    content: [{ type: "text", text: plan.title, styles: {} }],
    children: [],
  });

  // Overview as paragraph
  blocks.push({
    id: generateId(),
    type: "paragraph",
    props: {
      textColor: "default",
      backgroundColor: "default",
      textAlignment: "left",
    },
    content: [{ type: "text", text: plan.overview, styles: {} }],
    children: [],
  });

  // Horizontal divider
  blocks.push({
    id: generateId(),
    type: "paragraph",
    props: {
      textColor: "default",
      backgroundColor: "default",
      textAlignment: "left",
    },
    content: [{ type: "text", text: "---", styles: {} }],
    children: [],
  });

  // Storyline sections
  plan.storyline.forEach((section, idx) => {
    // Section heading with optional duration
    const headingText = section.duration_estimate
      ? `${section.name} (${section.duration_estimate})`
      : section.name;

    blocks.push({
      id: generateId(),
      type: "heading",
      props: {
        level: 2,
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [{ type: "text", text: headingText, styles: {} }],
      children: [],
    });

    // Description paragraph (italicized)
    blocks.push({
      id: generateId(),
      type: "paragraph",
      props: {
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: section.description,
          styles: { italic: true },
        },
      ],
      children: [],
    });

    // A-roll section (if exists and has clips)
    if (section.tracks?.a_roll && section.tracks.a_roll.length > 0) {
      blocks.push({
        id: generateId(),
        type: "paragraph",
        props: {
          textColor: "default",
          backgroundColor: "default",
          textAlignment: "left",
        },
        content: [
          { type: "text", text: "🎬 A-roll: ", styles: { bold: true } },
        ],
        children: [],
      });

      // Add each a-roll clip as a videoSegment block
      section.tracks.a_roll.forEach((clip) => {
        const displayName = aliasToFileName[clip.file_alias] || clip.file_alias;
        const startSec = clip.start_ms / 1000;
        const endSec = clip.end_ms / 1000;

        blocks.push({
          id: generateId(),
          type: "videoSegment",
          props: {
            fileAlias: clip.file_alias,
            startTime: startSec,
            endTime: endSec,
            name: displayName,
            caption: clip.description,
            url: "", // Will be loaded from IndexedDB when rendering
            textColor: "default",
            backgroundColor: "default",
            textAlignment: "left",
          },
          content: [],
          children: [],
        });
      });
    }

    // B-roll section (if exists and has clips)
    if (section.tracks?.b_roll && section.tracks.b_roll.length > 0) {
      blocks.push({
        id: generateId(),
        type: "paragraph",
        props: {
          textColor: "default",
          backgroundColor: "default",
          textAlignment: "left",
        },
        content: [
          { type: "text", text: "🎥 B-roll: ", styles: { bold: true } },
        ],
        children: [],
      });

      // Add each b-roll clip as a videoSegment block
      section.tracks.b_roll.forEach((clip) => {
        const displayName = aliasToFileName[clip.file_alias] || clip.file_alias;
        const startSec = clip.start_ms / 1000;
        const endSec = clip.end_ms / 1000;

        blocks.push({
          id: generateId(),
          type: "videoSegment",
          props: {
            fileAlias: clip.file_alias,
            startTime: startSec,
            endTime: endSec,
            name: displayName,
            caption: clip.description,
            url: "", // Will be loaded from IndexedDB when rendering
            textColor: "default",
            backgroundColor: "default",
            textAlignment: "left",
          },
          content: [],
          children: [],
        });
      });
    }

    // Section divider (except for last section)
    if (idx < plan.storyline.length - 1) {
      blocks.push({
        id: generateId(),
        type: "paragraph",
        props: {
          textColor: "default",
          backgroundColor: "default",
          textAlignment: "left",
        },
        content: [{ type: "text", text: "---", styles: {} }],
        children: [],
      });
    }
  });

  return blocks;
}

/**
 * Converts a BlockNote document back to flexible plan format
 * (for future iteration support)
 */
export function blockNoteToFlexiblePlan(blocks: any[]): FlexiblePlan {
  // TODO: Implement reverse conversion for plan iteration
  // For now, return a basic structure
  return {
    title: "Extracted Plan",
    overview: "Plan extracted from edited storyboard",
    storyline: [],
  };
}
