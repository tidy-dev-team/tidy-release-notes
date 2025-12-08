import {
  Button,
  Container,
  Dropdown,
  DropdownOption,
  Muted,
  render,
  Text,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'

import {
  ComponentSetInfo,
  ComponentSetsFoundHandler,
  ComponentSetsLoadedHandler,
  FindComponentSetsHandler,
  LoadComponentSetsHandler
} from './types'

function Plugin() {
  const [componentSets, setComponentSets] = useState<ComponentSetInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Load saved component sets on mount
  useEffect(() => {
    // Listen for component sets loaded from storage
    on<ComponentSetsLoadedHandler>('COMPONENT_SETS_LOADED', (sets) => {
      setComponentSets(sets)
      if (sets.length > 0 && !selectedId) {
        setSelectedId(sets[0].id)
      }
    })

    // Listen for newly found component sets
    on<ComponentSetsFoundHandler>('COMPONENT_SETS_FOUND', (sets) => {
      setComponentSets(sets)
      if (sets.length > 0) {
        setSelectedId(sets[0].id)
      }
    })

    // Request saved component sets
    emit<LoadComponentSetsHandler>('LOAD_COMPONENT_SETS')
  }, [])

  const handleFindComponentsClick = useCallback(() => {
    emit<FindComponentSetsHandler>('FIND_COMPONENT_SETS')
  }, [])

  const handleDropdownChange = useCallback(
    (event: h.JSX.TargetedEvent<HTMLInputElement>) => {
      const newValue = event.currentTarget.value
      setSelectedId(newValue)

      // Find the selected component set and log its name
      const selected = componentSets.find((cs) => cs.id === newValue)
      if (selected) {
        console.log('Selected component set:', selected.name)
      }
    },
    [componentSets]
  )

  // Build dropdown options
  const dropdownOptions: DropdownOption[] = componentSets.map((cs) => ({
    value: cs.id,
    text: cs.name
  }))

  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      <Button fullWidth onClick={handleFindComponentsClick}>
        Find Components
      </Button>
      <VerticalSpace space="large" />
      {componentSets.length > 0 && (
        <Text>
          <Muted>Component Sets ({componentSets.length})</Muted>
        </Text>
      )}
      {componentSets.length > 0 && <VerticalSpace space="small" />}
      {componentSets.length > 0 && (
        <Dropdown
          onChange={handleDropdownChange}
          options={dropdownOptions}
          value={selectedId}
        />
      )}
      {componentSets.length === 0 && (
        <Text>
          <Muted>No component sets found. Click "Find Components" to scan.</Muted>
        </Text>
      )}
      <VerticalSpace space="small" />
    </Container>
  )
}

export default render(Plugin)
