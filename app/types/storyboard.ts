// Flexible backend format
export interface ClipReference {
  file_alias: string;
  start_ms: number; // Backend sends in milliseconds
  end_ms: number; // Backend sends in milliseconds
  transcript?: string; // Optional: transcript text if this is a transcript segment
  speaker?: string; // Optional: speaker name if this is a transcript segment
  visual?: string; // Optional: visual caption if this is a visual segment
  visual_details?: any; // Optional: detailed visual metadata
}

export interface Section {
  name: string;
  description: string; // Required - explains section purpose
  sample_segments: ClipReference[]; // Unified array of exemplary clips
}

export interface FlexiblePlan {
  title: string;
  overview: string;
  target_duration?: number; // Optional: total video duration in seconds
  sections: Section[]; // Changed from storyline
}

// BlockNote format
export interface VideoSegmentAttributes {
  fileAlias: string;
  startTime: number; // In seconds (float)
  endTime: number; // In seconds (float)
  name: string;
  url?: string;
  transcript?: string; // Optional: transcript text
  speaker?: string; // Optional: speaker name
  visual?: string; // Optional: visual caption
}

export interface BlockNoteDocument {
  blocks: any[]; // BlockNote's block array
}

export interface StoryboardData {
  plan: FlexiblePlan;
  document?: BlockNoteDocument; // Converted from plan (BlockNote format)
}
