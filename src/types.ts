import { EventHandler } from '@create-figma-plugin/utilities'

// ===================
// Data types
// ===================

export interface ComponentSetInfo {
  id: string
  name: string
}

export interface ComponentSetsPayload {
  componentSets: ComponentSetInfo[]
  lastSelectedComponentSetId: string | null
}

export interface Sprint {
  id: string
  name: string
  notes: unknown[]
}

export interface SprintsPayload {
  sprints: Sprint[]
  lastSelectedSprintId: string | null
}

// ===================
// Component Sets Events
// ===================

// UI -> Main: Request to scan for component sets
export interface FindComponentSetsHandler extends EventHandler {
  name: 'FIND_COMPONENT_SETS'
  handler: () => void
}

// Main -> UI: Return found component sets
export interface ComponentSetsFoundHandler extends EventHandler {
  name: 'COMPONENT_SETS_FOUND'
  handler: (payload: ComponentSetsPayload) => void
}

// UI -> Main: Request to load saved component sets on init
export interface LoadComponentSetsHandler extends EventHandler {
  name: 'LOAD_COMPONENT_SETS'
  handler: () => void
}

// Main -> UI: Return saved component sets
export interface ComponentSetsLoadedHandler extends EventHandler {
  name: 'COMPONENT_SETS_LOADED'
  handler: (payload: ComponentSetsPayload) => void
}

// UI -> Main: Select a component set (persist last used)
export interface SelectComponentSetHandler extends EventHandler {
  name: 'SELECT_COMPONENT_SET'
  handler: (id: string | null) => void
}

// ===================
// Sprint Events
// ===================

// UI -> Main: Request to load all sprints on init
export interface LoadSprintsHandler extends EventHandler {
  name: 'LOAD_SPRINTS'
  handler: () => void
}

// Main -> UI: Return loaded sprints
export interface SprintsLoadedHandler extends EventHandler {
  name: 'SPRINTS_LOADED'
  handler: (payload: SprintsPayload) => void
}

// UI -> Main: Create a new sprint
export interface CreateSprintHandler extends EventHandler {
  name: 'CREATE_SPRINT'
  handler: (name: string) => void
}

// UI -> Main: Rename an existing sprint
export interface RenameSprintHandler extends EventHandler {
  name: 'RENAME_SPRINT'
  handler: (payload: { id: string; name: string }) => void
}

// UI -> Main: Delete a sprint
export interface DeleteSprintHandler extends EventHandler {
  name: 'DELETE_SPRINT'
  handler: (id: string) => void
}

// UI -> Main: Select a sprint (persist last used)
export interface SelectSprintHandler extends EventHandler {
  name: 'SELECT_SPRINT'
  handler: (id: string | null) => void
}

// Main -> UI: Sprints updated (after create/rename/delete)
export interface SprintsUpdatedHandler extends EventHandler {
  name: 'SPRINTS_UPDATED'
  handler: (payload: SprintsPayload) => void
}
