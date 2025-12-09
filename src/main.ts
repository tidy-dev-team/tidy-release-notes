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
  SprintsUpdatedHandler,
  ReleaseNote,
  AddNoteHandler,
  AddNotePayload,
  EditNoteHandler,
  EditNotePayload,
  DeleteNoteHandler,
  DeleteNotePayload,
  ViewComponentSetHandler,
  PublishSprintReleaseNotesHandler,
  SprintReleaseNotesPublishedHandler
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
// Navigation Helpers
// ===================

function findParentPage(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node
  while (current) {
    if (current.type === 'PAGE') {
      return current as PageNode
    }
    current = current.parent
  }
  return null
}

function getOrCreateReleaseNotesPage(): PageNode {
  const existing = figma.root.children.find(
    (child) => child.type === 'PAGE' && child.name === 'Release notes'
  ) as PageNode | undefined

  if (existing) {
    return existing
  }

  const page = figma.createPage()
  page.name = 'Release notes'
  // New pages are appended to figma.root by default as last child
  return page
}

function getOrCreateReleaseNotesFrame(page: PageNode): FrameNode {
  const existing = page.children.find(
    (child) => child.type === 'FRAME' && child.name === 'release-notes-frame'
  ) as FrameNode | undefined

  if (existing) {
    return existing
  }

  const frame = figma.createFrame()
  frame.name = 'release-notes-frame'
  frame.layoutMode = 'VERTICAL'
  frame.primaryAxisSizingMode = 'AUTO'
  frame.counterAxisSizingMode = 'AUTO'
  frame.itemSpacing = 20
  frame.paddingTop = 0
  frame.paddingRight = 0
  frame.paddingBottom = 0
  frame.paddingLeft = 0
  frame.x = 0
  frame.y = 0

  page.appendChild(frame)
  return frame
}

async function buildSprintNotesTable(sprint: Sprint, notes: ReleaseNote[]): Promise<FrameNode> {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' })

  const table = figma.createFrame()
  table.name = `Release notes – ${sprint.name}`
  table.layoutMode = 'VERTICAL'
  table.primaryAxisSizingMode = 'AUTO'
  table.counterAxisSizingMode = 'AUTO'
  table.itemSpacing = 8

  // Header row: sprint name + publish date
  const headerRow = figma.createFrame()
  headerRow.layoutMode = 'HORIZONTAL'
  headerRow.primaryAxisSizingMode = 'AUTO'
  headerRow.counterAxisSizingMode = 'AUTO'
  headerRow.itemSpacing = 16

  const headerText = figma.createText()
  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  headerText.characters = `Sprint ${sprint.name} – ${formattedDate}`
  headerText.fontName = { family: 'Inter', style: 'Bold' }

  headerRow.appendChild(headerText)
  table.appendChild(headerRow)

  // Note rows, newest first
  const sortedNotes = [...notes].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  for (const note of sortedNotes) {
    const row = figma.createFrame()
    row.layoutMode = 'HORIZONTAL'
    row.primaryAxisSizingMode = 'AUTO'
    row.counterAxisSizingMode = 'AUTO'
    row.itemSpacing = 16

    // Date of adding note
    const dateText = figma.createText()
    dateText.fontName = { family: 'Inter', style: 'Regular' }
    dateText.characters = new Date(note.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })

    // Component name with hyperlink
    const componentText = figma.createText()
    componentText.fontName = { family: 'Inter', style: 'Regular' }
    componentText.characters = note.componentSetName

    componentText.setRangeHyperlink(0, componentText.characters.length, {
      type: 'NODE',
      value: note.componentSetId
    })

    // Tag
    const tagText = figma.createText()
    tagText.fontName = { family: 'Inter', style: 'Regular' }
    tagText.characters = note.tag

    // Description
    const descriptionText = figma.createText()
    descriptionText.fontName = { family: 'Inter', style: 'Regular' }
    descriptionText.characters = note.description

    // Author
    const authorText = figma.createText()
    authorText.fontName = { family: 'Inter', style: 'Regular' }
    authorText.characters = note.authorName

    row.appendChild(dateText)
    row.appendChild(componentText)
    row.appendChild(tagText)
    row.appendChild(descriptionText)
    row.appendChild(authorText)

    table.appendChild(row)
  }

  return table
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

  // ===================
  // Note Handlers
  // ===================

  on<AddNoteHandler>('ADD_NOTE', function (data: AddNotePayload) {
    const sprints = loadAllSprints()
    const sprint = sprints.find((s) => s.id === data.sprintId)

    if (sprint) {
      const note: ReleaseNote = {
        id: Date.now().toString(),
        description: data.description,
        tag: data.tag,
        componentSetId: data.componentSetId,
        componentSetName: data.componentSetName,
        createdAt: new Date().toISOString(),
        authorId: figma.currentUser?.id ?? 'unknown',
        authorName: figma.currentUser?.name ?? 'Unknown User'
      }

      sprint.notes.push(note)
      saveSprint(sprint)
    }

    const payload = getSprintsPayload()
    emit<SprintsUpdatedHandler>('SPRINTS_UPDATED', payload)
  })

  on<EditNoteHandler>('EDIT_NOTE', function (data: EditNotePayload) {
    const sprints = loadAllSprints()
    const sprint = sprints.find((s) => s.id === data.sprintId)

    if (sprint) {
      const note = sprint.notes.find((n) => n.id === data.noteId)
      if (note) {
        note.description = data.description
        note.tag = data.tag
        saveSprint(sprint)
      }
    }

    const payload = getSprintsPayload()
    emit<SprintsUpdatedHandler>('SPRINTS_UPDATED', payload)
  })

  on<DeleteNoteHandler>('DELETE_NOTE', function (data: DeleteNotePayload) {
    const sprints = loadAllSprints()
    const sprint = sprints.find((s) => s.id === data.sprintId)

    if (sprint) {
      sprint.notes = sprint.notes.filter((n) => n.id !== data.noteId)
      saveSprint(sprint)
    }

    const payload = getSprintsPayload()
    emit<SprintsUpdatedHandler>('SPRINTS_UPDATED', payload)
  })

  on<ViewComponentSetHandler>('VIEW_COMPONENT_SET', function (componentSetId: string) {
    const node = figma.getNodeById(componentSetId)
    if (node && node.type === 'COMPONENT_SET') {
      // Navigate to the page containing the component set
      const page = findParentPage(node)
      if (page && figma.currentPage !== page) {
        figma.currentPage = page
      }
      // Zoom and scroll viewport to the component set
      figma.viewport.scrollAndZoomIntoView([node])
    }
  })

  on<PublishSprintReleaseNotesHandler>('PUBLISH_SPRINT_RELEASE_NOTES', async function (sprintId: string) {
    const sprints = loadAllSprints()
    const sprint = sprints.find((s) => s.id === sprintId)

    if (!sprint || sprint.notes.length === 0) {
      emit<SprintReleaseNotesPublishedHandler>('SPRINT_RELEASE_NOTES_PUBLISHED')
      return
    }

    const page = getOrCreateReleaseNotesPage()
    const frame = getOrCreateReleaseNotesFrame(page)

    const table = await buildSprintNotesTable(sprint, sprint.notes)

    if (frame.children.length === 0) {
      frame.appendChild(table)
    } else {
      frame.insertChild(0, table)
    }

    figma.currentPage = page
    figma.viewport.scrollAndZoomIntoView([frame])

    emit<SprintReleaseNotesPublishedHandler>('SPRINT_RELEASE_NOTES_PUBLISHED')
  })

  showUI({
    height: 600,
    width: 320
  })
}
