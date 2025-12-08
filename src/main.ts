import { on, emit, showUI } from '@create-figma-plugin/utilities'

import {
  FindComponentSetsHandler,
  LoadComponentSetsHandler,
  ComponentSetsFoundHandler,
  ComponentSetsLoadedHandler,
  ComponentSetInfo
} from './types'

const PLUGIN_NAMESPACE = 'tidy_release_notes'
const COMPONENT_SETS_KEY = 'componentSets'

export default function () {
  // Handle request to find all component sets
  on<FindComponentSetsHandler>('FIND_COMPONENT_SETS', function () {
    const componentSetNodes = figma.root.findAllWithCriteria({
      types: ['COMPONENT_SET']
    })

    const componentSets: ComponentSetInfo[] = componentSetNodes.map((node) => ({
      id: node.id,
      name: node.name
    }))

    // Save to shared plugin data
    figma.root.setSharedPluginData(
      PLUGIN_NAMESPACE,
      COMPONENT_SETS_KEY,
      JSON.stringify(componentSets)
    )

    // Send back to UI
    emit<ComponentSetsFoundHandler>('COMPONENT_SETS_FOUND', componentSets)
  })

  // Handle request to load saved component sets
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

    emit<ComponentSetsLoadedHandler>('COMPONENT_SETS_LOADED', componentSets)
  })

  showUI({
    height: 200,
    width: 300
  })
}
