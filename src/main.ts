import { on, emit, showUI } from '@create-figma-plugin/utilities'

import {
  FindComponentSetsHandler,
  LoadComponentSetsHandler,
  ComponentSetsFoundHandler,
  ComponentSetsLoadedHandler,
  ComponentSetInfo,
  ComponentSetsPayload,
  SelectComponentSetHandler,
  Sprint,
  SprintsPayload,
  LoadSprintsHandler,
  SprintsLoadedHandler,
  CreateSprintHandler,
  RenameSprintHandler,
  DeleteSprintHandler,
  SelectSprintHandler,
  SprintsUpdatedHandler
} from './types'

const PLUGIN_NAMESPACE = 'tidy_release_notes'
const COMPONENT_SETS_KEY = 'componentSets'
const LAST_COMPONENT_SET_ID_KEY = 'last_component_set_id'
const LAST_SPRINT_ID_KEY = 'last_sprint_id'
const SPRINT_KEY_PREFIX = 'sprint_'

// ===================
// Component Sets Helpers
// ===================

function getLastComponentSetId(): string | null {
  const id = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, LAST_COMPONENT_SET_ID_KEY)
  return id || null
}

function setLastComponentSetId(id: string | null): void {
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, LAST_COMPONENT_SET_ID_KEY, id ?? '')
}

function getComponentSetsPayload(componentSets: ComponentSetInfo[]): ComponentSetsPayload {
  let lastSelectedComponentSetId = getLastComponentSetId()

  // Validate that last selected component set still exists
  if (lastSelectedComponentSetId && !componentSets.find((cs) => cs.id === lastSelectedComponentSetId)) {
    lastSelectedComponentSetId = componentSets.length > 0 ? componentSets[0].id : null
    setLastComponentSetId(lastSelectedComponentSetId)
  }

  return { componentSets, lastSelectedComponentSetId }
}

// ===================
// Sprint Helpers
// ===================

function loadAllSprints(): Sprint[] {
  const keys = figma.root.getSharedPluginDataKeys(PLUGIN_NAMESPACE)
  const sprintKeys = keys.filter((key) => key.startsWith(SPRINT_KEY_PREFIX))

  const sprints: Sprint[] = []
  for (const key of sprintKeys) {
    const data = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, key)
    if (data) {
      try {
        const sprint = JSON.parse(data) as Sprint
        sprints.push(sprint)
      } catch (e) {
        console.error(`Failed to parse sprint data for key ${key}:`, e)
      }
    }
  }

  return sprints
}

function saveSprint(sprint: Sprint): void {
  const key = `${SPRINT_KEY_PREFIX}${sprint.id}`
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, key, JSON.stringify(sprint))
}

function deleteSprint(id: string): void {
  const key = `${SPRINT_KEY_PREFIX}${id}`
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, key, '')
}

function getLastSprintId(): string | null {
  const id = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, LAST_SPRINT_ID_KEY)
  return id || null
}

function setLastSprintId(id: string | null): void {
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, LAST_SPRINT_ID_KEY, id ?? '')
}

function getSprintsPayload(): SprintsPayload {
  const sprints = loadAllSprints()
  let lastSelectedSprintId = getLastSprintId()

  // Validate that last selected sprint still exists
  if (lastSelectedSprintId && !sprints.find((s) => s.id === lastSelectedSprintId)) {
    lastSelectedSprintId = sprints.length > 0 ? sprints[0].id : null
    setLastSprintId(lastSelectedSprintId)
  }

  return { sprints, lastSelectedSprintId }
}

// ===================
// Main Plugin
// ===================

export default function () {
  // ===================
  // Component Sets Handlers
  // ===================

  on<FindComponentSetsHandler>('FIND_COMPONENT_SETS', function () {
    const componentSetNodes = figma.root.findAllWithCriteria({
      types: ['COMPONENT_SET']
    })

    const componentSets: ComponentSetInfo[] = componentSetNodes.map((node) => ({
      id: node.id,
      name: node.name
    }))

    figma.root.setSharedPluginData(
      PLUGIN_NAMESPACE,
      COMPONENT_SETS_KEY,
      JSON.stringify(componentSets)
    )

    const payload = getComponentSetsPayload(componentSets)
    emit<ComponentSetsFoundHandler>('COMPONENT_SETS_FOUND', payload)
  })

  on<LoadComponentSetsHandler>('LOAD_COMPONENT_SETS', function () {
    const savedData = figma.root.getSharedPluginData(
      PLUGIN_NAMESPACE,
      COMPONENT_SETS_KEY
    )

    let componentSets: ComponentSetInfo[] = []
    if (savedData) {
      try {
        componentSets = JSON.parse(savedData)
      } catch (e) {
        console.error('Failed to parse saved component sets:', e)
      }
    }

    const payload = getComponentSetsPayload(componentSets)
    emit<ComponentSetsLoadedHandler>('COMPONENT_SETS_LOADED', payload)
  })

  on<SelectComponentSetHandler>('SELECT_COMPONENT_SET', function (id: string | null) {
    setLastComponentSetId(id)
  })

  // ===================
  // Sprint Handlers
  // ===================

  on<LoadSprintsHandler>('LOAD_SPRINTS', function () {
    const payload = getSprintsPayload()
    emit<SprintsLoadedHandler>('SPRINTS_LOADED', payload)
  })

  on<CreateSprintHandler>('CREATE_SPRINT', function (name: string) {
    const id = Date.now().toString()
    const sprint: Sprint = {
      id,
      name,
      notes: []
    }

    saveSprint(sprint)
    setLastSprintId(id) // Auto-select newly created sprint

    const payload = getSprintsPayload()
    emit<SprintsUpdatedHandler>('SPRINTS_UPDATED', payload)
  })

  on<RenameSprintHandler>('RENAME_SPRINT', function (data: { id: string; name: string }) {
    const sprints = loadAllSprints()
    const sprint = sprints.find((s) => s.id === data.id)

    if (sprint) {
      sprint.name = data.name
      saveSprint(sprint)
    }

    const payload = getSprintsPayload()
    emit<SprintsUpdatedHandler>('SPRINTS_UPDATED', payload)
  })

  on<DeleteSprintHandler>('DELETE_SPRINT', function (id: string) {
    deleteSprint(id)

    // If deleted sprint was last selected, clear or move selection
    const lastId = getLastSprintId()
    if (lastId === id) {
      const remainingSprints = loadAllSprints()
      const newLastId = remainingSprints.length > 0 ? remainingSprints[0].id : null
      setLastSprintId(newLastId)
    }

    const payload = getSprintsPayload()
    emit<SprintsUpdatedHandler>('SPRINTS_UPDATED', payload)
  })

  on<SelectSprintHandler>('SELECT_SPRINT', function (id: string | null) {
    setLastSprintId(id)
  })

  showUI({
    height: 400,
    width: 320
  })
}
