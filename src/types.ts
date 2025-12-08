import { EventHandler } from '@create-figma-plugin/utilities'

// Data types
export interface ComponentSetInfo {
  id: string
  name: string
}

// UI -> Main: Request to scan for component sets
export interface FindComponentSetsHandler extends EventHandler {
  name: 'FIND_COMPONENT_SETS'
  handler: () => void
}

// Main -> UI: Return found component sets
export interface ComponentSetsFoundHandler extends EventHandler {
  name: 'COMPONENT_SETS_FOUND'
  handler: (componentSets: ComponentSetInfo[]) => void
}

// UI -> Main: Request to load saved component sets on init
export interface LoadComponentSetsHandler extends EventHandler {
  name: 'LOAD_COMPONENT_SETS'
  handler: () => void
}

// Main -> UI: Return saved component sets
export interface ComponentSetsLoadedHandler extends EventHandler {
  name: 'COMPONENT_SETS_LOADED'
  handler: (componentSets: ComponentSetInfo[]) => void
}
