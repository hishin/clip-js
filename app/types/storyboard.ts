// Flexible backend format
export interface ClipReference {
  file_alias: string;
  start_ms: number; // Backend sends in milliseconds
  end_ms: number; // Backend sends in milliseconds
  description: string;
}

export interface StorylineSection {
  name: string;
  duration_estimate?: string;
  description: string; // Required - explains section purpose
  tracks: {
    a_roll: ClipReference[]; // Main track key example clips
    b_roll?: ClipReference[]; // Overlay track key example clips (optional)
  };
}

export interface FlexiblePlan {
  title: string;
  overview: string;
  storyline: StorylineSection[];
}

// BlockNote format
export interface VideoSegmentAttributes {
  fileAlias: string;
  startTime: number; // In seconds (float)
  endTime: number; // In seconds (float)
  name: string;
  caption?: string;
  url?: string;
}

export interface BlockNoteDocument {
  blocks: any[]; // BlockNote's block array
}

export interface StoryboardData {
  plan: FlexiblePlan;
  document?: BlockNoteDocument; // Converted from plan (BlockNote format)
}
