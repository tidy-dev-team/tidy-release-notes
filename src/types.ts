import { EventHandler } from "@create-figma-plugin/utilities";

// ===================
// Data types
// ===================

export interface ComponentSetInfo {
  id: string;
  name: string;
}

export interface ComponentSetsPayload {
  componentSets: ComponentSetInfo[];
  lastSelectedComponentSetId: string | null;
}

export type NoteTag =
  | "bug_fix"
  | "enhancement"
  | "new_component"
  | "deprecation"
  | "deleted";

export interface ReleaseNote {
  id: string;
  description: string;
  tag: NoteTag;
  componentSetId: string;
  componentSetName: string;
  createdAt: string; // ISO date string
  authorId: string;
  authorName: string;
}

export interface Sprint {
  id: string;
  name: string;
  notes: ReleaseNote[];
}

export interface SprintsPayload {
  sprints: Sprint[];
  lastSelectedSprintId: string | null;
}

// ===================
// Component Sets Events
// ===================

// UI -> Main: Request to scan for component sets
export interface FindComponentSetsHandler extends EventHandler {
  name: "FIND_COMPONENT_SETS";
  handler: () => void;
}

// Main -> UI: Return found component sets
export interface ComponentSetsFoundHandler extends EventHandler {
  name: "COMPONENT_SETS_FOUND";
  handler: (payload: ComponentSetsPayload) => void;
}

// UI -> Main: Request to load saved component sets on init
export interface LoadComponentSetsHandler extends EventHandler {
  name: "LOAD_COMPONENT_SETS";
  handler: () => void;
}

// Main -> UI: Return saved component sets
export interface ComponentSetsLoadedHandler extends EventHandler {
  name: "COMPONENT_SETS_LOADED";
  handler: (payload: ComponentSetsPayload) => void;
}

// UI -> Main: Select a component set (persist last used)
export interface SelectComponentSetHandler extends EventHandler {
  name: "SELECT_COMPONENT_SET";
  handler: (id: string | null) => void;
}

// Main -> UI: Canvas selection changed to a known component set
export interface CanvasComponentSetSelectedHandler extends EventHandler {
  name: "CANVAS_COMPONENT_SET_SELECTED";
  handler: (id: string) => void;
}

// ===================
// Sprint Events
// ===================

// UI -> Main: Request to load all sprints on init
export interface LoadSprintsHandler extends EventHandler {
  name: "LOAD_SPRINTS";
  handler: () => void;
}

// Main -> UI: Return loaded sprints
export interface SprintsLoadedHandler extends EventHandler {
  name: "SPRINTS_LOADED";
  handler: (payload: SprintsPayload) => void;
}

// UI -> Main: Create a new sprint
export interface CreateSprintHandler extends EventHandler {
  name: "CREATE_SPRINT";
  handler: (name: string) => void;
}

// UI -> Main: Rename an existing sprint
export interface RenameSprintHandler extends EventHandler {
  name: "RENAME_SPRINT";
  handler: (payload: { id: string; name: string }) => void;
}

// UI -> Main: Delete a sprint
export interface DeleteSprintHandler extends EventHandler {
  name: "DELETE_SPRINT";
  handler: (id: string) => void;
}

// UI -> Main: Select a sprint (persist last used)
export interface SelectSprintHandler extends EventHandler {
  name: "SELECT_SPRINT";
  handler: (id: string | null) => void;
}

// Main -> UI: Sprints updated (after create/rename/delete)
export interface SprintsUpdatedHandler extends EventHandler {
  name: "SPRINTS_UPDATED";
  handler: (payload: SprintsPayload) => void;
}

// ===================
// Note Events
// ===================

export interface AddNotePayload {
  sprintId: string;
  description: string;
  tag: NoteTag;
  componentSetId: string;
  componentSetName: string;
}

export interface EditNotePayload {
  sprintId: string;
  noteId: string;
  description: string;
  tag: NoteTag;
}

export interface DeleteNotePayload {
  sprintId: string;
  noteId: string;
}

// UI -> Main: Add a new note to a sprint
export interface AddNoteHandler extends EventHandler {
  name: "ADD_NOTE";
  handler: (payload: AddNotePayload) => void;
}

// UI -> Main: Edit an existing note
export interface EditNoteHandler extends EventHandler {
  name: "EDIT_NOTE";
  handler: (payload: EditNotePayload) => void;
}

// UI -> Main: Delete a note from a sprint
export interface DeleteNoteHandler extends EventHandler {
  name: "DELETE_NOTE";
  handler: (payload: DeleteNotePayload) => void;
}

// UI -> Main: Navigate viewport to a component set
export interface ViewComponentSetHandler extends EventHandler {
  name: "VIEW_COMPONENT_SET";
  handler: (componentSetId: string) => void;
}

// UI -> Main: Publish aggregated sprint release notes to canvas
export interface PublishSprintReleaseNotesHandler extends EventHandler {
  name: "PUBLISH_SPRINT_RELEASE_NOTES";
  handler: (sprintId: string) => void;
}

// Main -> UI: Aggregated sprint release notes publishing finished
export interface SprintReleaseNotesPublishedHandler extends EventHandler {
  name: "SPRINT_RELEASE_NOTES_PUBLISHED";
  handler: () => void;
}

// UI -> Main: Clear all release notes from canvas (keep data)
export interface ClearReleaseNotesFromCanvasHandler extends EventHandler {
  name: "CLEAR_RELEASE_NOTES_FROM_CANVAS";
  handler: () => void;
}

// Main -> UI: Release notes cleared from canvas
export interface ReleaseNotesFromCanvasClearedHandler extends EventHandler {
  name: "RELEASE_NOTES_FROM_CANVAS_CLEARED";
  handler: () => void;
}

// ===================
// Export/Import Events
// ===================

export interface ReleaseNotesExportData {
  version: string;
  exportedAt: string;
  sprints: Sprint[];
}

// UI -> Main: Request export of all release notes data
export interface ExportReleaseNotesHandler extends EventHandler {
  name: "EXPORT_RELEASE_NOTES";
  handler: () => void;
}

// Main -> UI: Return exported release notes data
export interface ReleaseNotesExportedHandler extends EventHandler {
  name: "RELEASE_NOTES_EXPORTED";
  handler: (data: ReleaseNotesExportData) => void;
}

// UI -> Main: Import release notes data (replaces existing)
export interface ImportReleaseNotesHandler extends EventHandler {
  name: "IMPORT_RELEASE_NOTES";
  handler: (data: ReleaseNotesExportData) => void;
}

// Main -> UI: Release notes import completed
export interface ReleaseNotesImportedHandler extends EventHandler {
  name: "RELEASE_NOTES_IMPORTED";
  handler: (success: boolean, message: string) => void;
}
