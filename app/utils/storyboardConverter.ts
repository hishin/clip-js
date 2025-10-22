import type {
  FlexiblePlan,
  BlockNoteDocument,
  Section,
  ClipReference,
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

  // Target duration (if present)
  if (plan.target_duration) {
    const minutes = Math.floor(plan.target_duration / 60);
    const seconds = plan.target_duration % 60;
    const durationText =
      minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    blocks.push({
      id: generateId(),
      type: "paragraph",
      props: {
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        { type: "text", text: "Target Duration: ", styles: { bold: true } },
        { type: "text", text: durationText, styles: { italic: true } },
      ],
      children: [],
    });
  }

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

  // Sections (formerly storyline)
  plan.sections.forEach((section, idx) => {
    // Section heading (no duration_estimate)
    blocks.push({
      id: generateId(),
      type: "heading",
      props: {
        level: 2,
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [{ type: "text", text: section.name, styles: {} }],
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

    // Two-column layout: Transcript segments (left) and Visual segments (right)
    if (section.sample_segments && section.sample_segments.length > 0) {
      // Split segments by type
      const transcriptClips: ClipReference[] = [];
      const visualClips: ClipReference[] = [];

      section.sample_segments.forEach((clip) => {
        if (clip.transcript || clip.speaker) {
          transcriptClips.push(clip);
        } else if (clip.visual) {
          visualClips.push(clip);
        }
      });

      // Create column list with two columns
      const leftColumnChildren: any[] = [];
      const rightColumnChildren: any[] = [];

      // Left column: Transcript segments
      if (transcriptClips.length > 0) {
        leftColumnChildren.push({
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
              text: "📝 Transcript Segments",
              styles: { bold: true },
            },
          ],
          children: [],
        });

        transcriptClips.forEach((clip) => {
          const displayName =
            aliasToFileName[clip.file_alias] || clip.file_alias;
          const startSec = clip.start_ms / 1000;
          const endSec = clip.end_ms / 1000;

          leftColumnChildren.push({
            id: generateId(),
            type: "videoSegment",
            props: {
              fileAlias: clip.file_alias,
              startTime: startSec,
              endTime: endSec,
              name: displayName,
              transcript: clip.transcript || "",
              speaker: clip.speaker || "",
              visual: clip.visual || "",
              initialExpanded: false, // Transcripts collapsed by default
              url: "", // Will be loaded from IndexedDB when rendering
              textColor: "default",
              backgroundColor: "default",
              textAlignment: "left",
            },
            content: [],
            children: [],
          });
        });
      } else {
        // Empty placeholder if no transcript segments
        leftColumnChildren.push({
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
              text: "(No transcript segments)",
              styles: { italic: true },
            },
          ],
          children: [],
        });
      }

      // Right column: Visual segments
      if (visualClips.length > 0) {
        rightColumnChildren.push({
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
              text: "🎥 Visual Segments",
              styles: { bold: true },
            },
          ],
          children: [],
        });

        visualClips.forEach((clip) => {
          const displayName =
            aliasToFileName[clip.file_alias] || clip.file_alias;
          const startSec = clip.start_ms / 1000;
          const endSec = clip.end_ms / 1000;

          rightColumnChildren.push({
            id: generateId(),
            type: "videoSegment",
            props: {
              fileAlias: clip.file_alias,
              startTime: startSec,
              endTime: endSec,
              name: displayName,
              transcript: clip.transcript || "",
              speaker: clip.speaker || "",
              visual: clip.visual || "",
              initialExpanded: true, // Visuals expanded by default
              url: "", // Will be loaded from IndexedDB when rendering
              textColor: "default",
              backgroundColor: "default",
              textAlignment: "left",
            },
            content: [],
            children: [],
          });
        });
      } else {
        // Empty placeholder if no visual segments
        rightColumnChildren.push({
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
              text: "(No visual segments)",
              styles: { italic: true },
            },
          ],
          children: [],
        });
      }

      // Create the column list block
      blocks.push({
        id: generateId(),
        type: "columnList",
        props: {
          textColor: "default",
          backgroundColor: "default",
        },
        content: [],
        children: [
          {
            id: generateId(),
            type: "column",
            props: {
              textColor: "default",
              backgroundColor: "default",
            },
            content: [],
            children: leftColumnChildren,
          },
          {
            id: generateId(),
            type: "column",
            props: {
              textColor: "default",
              backgroundColor: "default",
            },
            content: [],
            children: rightColumnChildren,
          },
        ],
      });
    }

    // Section divider (except for last section)
    if (idx < plan.sections.length - 1) {
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
    sections: [],
  };
}

/**
 * Converts BlockNote document to simple text format for backend
 */
export function blockNoteToSimpleText(blocks: any[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    processBlock(block, lines, 0);
  }
  return lines.join("\n");
}

function processBlock(block: any, lines: string[], indent: number) {
  const indentStr = "  ".repeat(indent);

  switch (block.type) {
    case "heading":
      const level = block.props?.level || 1;
      const text = extractTextContent(block.content);
      if (level === 1) {
        lines.push(`<<<${text}>>>`);
      } else if (level === 2) {
        lines.push(`\n<${text}>`);
      } else {
        lines.push(`${indentStr}${text}`);
      }
      break;

    case "paragraph":
      const paraText = extractTextContent(block.content);
      if (paraText && paraText !== "---") {
        lines.push(`${indentStr}${paraText}`);
      }
      break;

    case "videoSegment":
      const props = block.props;
      // Simple format: - fileAlias, start-endsec
      lines.push(
        `${indentStr}- ${props.fileAlias}, ${props.startTime}-${props.endTime}sec`
      );
      break;

    case "columnList":
      for (const col of block.children || []) {
        if (col.type === "column") {
          for (const child of col.children || []) {
            processBlock(child, lines, indent + 1);
          }
        }
      }
      break;
  }

  if (block.children && block.type !== "columnList") {
    for (const child of block.children) {
      processBlock(child, lines, indent + 1);
    }
  }
}

function extractTextContent(content: any[]): string {
  if (!content) return "";
  return content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("");
}
