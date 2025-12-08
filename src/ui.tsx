import {
  Bold,
  Button,
  Columns,
  Container,
  Divider,
  Dropdown,
  DropdownOption,
  Modal,
  Muted,
  render,
  Text,
  Textbox,
  TextboxAutocomplete,
  TextboxAutocompleteOption,
  VerticalSpace,
} from "@create-figma-plugin/ui";
import { emit, on } from "@create-figma-plugin/utilities";
import { h } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import {
  ComponentSetInfo,
  ComponentSetsFoundHandler,
  ComponentSetsLoadedHandler,
  ComponentSetsPayload,
  CreateSprintHandler,
  DeleteSprintHandler,
  FindComponentSetsHandler,
  LoadComponentSetsHandler,
  LoadSprintsHandler,
  RenameSprintHandler,
  SelectComponentSetHandler,
  SelectSprintHandler,
  Sprint,
  SprintsLoadedHandler,
  SprintsPayload,
  SprintsUpdatedHandler,
} from "./types";

function Plugin() {
  // ===================
  // Component Sets State
  // ===================
  const [componentSets, setComponentSets] = useState<ComponentSetInfo[]>([]);
  const [selectedComponentId, setSelectedComponentId] =
    useState<string | null>(null);
  const [componentSearchValue, setComponentSearchValue] = useState<string>("");

  // ===================
  // Sprint State
  // ===================
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [newSprintName, setNewSprintName] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameSprintName, setRenameSprintName] = useState<string>("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] =
    useState<boolean>(false);

  // ===================
  // Initialization
  // ===================
  useEffect(() => {
    // Component Sets listeners
    const handleComponentSetsPayload = (payload: ComponentSetsPayload) => {
      setComponentSets(payload.componentSets);
      setSelectedComponentId(payload.lastSelectedComponentSetId);
      // Set the search value to the selected component's name
      if (payload.lastSelectedComponentSetId) {
        const selected = payload.componentSets.find(
          (cs) => cs.id === payload.lastSelectedComponentSetId
        );
        if (selected) {
          setComponentSearchValue(selected.name);
        }
      }
    };

    on<ComponentSetsLoadedHandler>(
      "COMPONENT_SETS_LOADED",
      handleComponentSetsPayload
    );
    on<ComponentSetsFoundHandler>(
      "COMPONENT_SETS_FOUND",
      handleComponentSetsPayload
    );

    // Sprint listeners
    const handleSprintsPayload = (payload: SprintsPayload) => {
      setSprints(payload.sprints);
      setSelectedSprintId(payload.lastSelectedSprintId);
    };

    on<SprintsLoadedHandler>("SPRINTS_LOADED", handleSprintsPayload);
    on<SprintsUpdatedHandler>("SPRINTS_UPDATED", handleSprintsPayload);

    // Load data on startup
    emit<LoadComponentSetsHandler>("LOAD_COMPONENT_SETS");
    emit<LoadSprintsHandler>("LOAD_SPRINTS");
  }, []);

  // ===================
  // Component Sets Handlers
  // ===================
  const handleFindComponentsClick = useCallback(() => {
    emit<FindComponentSetsHandler>("FIND_COMPONENT_SETS");
  }, []);

  const handleComponentSearchChange = useCallback(
    (newValue: string) => {
      setComponentSearchValue(newValue);

      // Find the component set by name and select it
      const selected = componentSets.find((cs) => cs.name === newValue);
      if (selected) {
        setSelectedComponentId(selected.id);
        emit<SelectComponentSetHandler>("SELECT_COMPONENT_SET", selected.id);
        console.log("Selected component set:", selected.name);
      }
    },
    [componentSets]
  );

  // ===================
  // Sprint Handlers
  // ===================
  const handleSprintDropdownChange = useCallback(
    (event: Event) => {
      const target = event.target as HTMLInputElement;
      const newValue = target.value;
      setSelectedSprintId(newValue);
      emit<SelectSprintHandler>("SELECT_SPRINT", newValue);

      const selected = sprints.find((s) => s.id === newValue);
      if (selected) {
        console.log("Selected sprint:", selected.name);
      }
    },
    [sprints]
  );

  const handleCreateSprint = useCallback(() => {
    const trimmedName = newSprintName.trim();
    if (trimmedName) {
      emit<CreateSprintHandler>("CREATE_SPRINT", trimmedName);
      setNewSprintName("");
    }
  }, [newSprintName]);

  const handleNewSprintNameChange = useCallback((event: Event) => {
    const target = event.target as HTMLInputElement;
    setNewSprintName(target.value);
  }, []);

  const handleStartRename = useCallback(() => {
    const currentSprint = sprints.find((s) => s.id === selectedSprintId);
    if (currentSprint) {
      setRenameSprintName(currentSprint.name);
      setIsRenaming(true);
    }
  }, [sprints, selectedSprintId]);

  const handleRenameSprintNameChange = useCallback((event: Event) => {
    const target = event.target as HTMLInputElement;
    setRenameSprintName(target.value);
  }, []);

  const handleConfirmRename = useCallback(() => {
    const trimmedName = renameSprintName.trim();
    if (trimmedName && selectedSprintId) {
      emit<RenameSprintHandler>("RENAME_SPRINT", {
        id: selectedSprintId,
        name: trimmedName,
      });
      setIsRenaming(false);
      setRenameSprintName("");
    }
  }, [renameSprintName, selectedSprintId]);

  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameSprintName("");
  }, []);

  const handleOpenDeleteConfirm = useCallback(() => {
    if (selectedSprintId) {
      setIsDeleteConfirmOpen(true);
    }
  }, [selectedSprintId]);

  const handleConfirmDelete = useCallback(() => {
    if (selectedSprintId) {
      emit<DeleteSprintHandler>("DELETE_SPRINT", selectedSprintId);
      setIsDeleteConfirmOpen(false);
    }
  }, [selectedSprintId]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteConfirmOpen(false);
  }, []);

  // ===================
  // Dropdown Options
  // ===================
  const componentAutocompleteOptions: TextboxAutocompleteOption[] =
    componentSets.map((cs) => ({
      value: cs.name,
    }));

  const sprintDropdownOptions: DropdownOption[] = sprints.map((s) => ({
    value: s.id,
    text: s.name,
  }));

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  // ===================
  // Render
  // ===================
  return (
    <Container space="medium">
      <VerticalSpace space="large" />

      {/* Sprint Management Section */}
      <Text>
        <Bold>Sprints</Bold>
      </Text>
      <VerticalSpace space="small" />

      {/* Create Sprint */}
      <Columns space="extraSmall">
        <Textbox
          onChange={handleNewSprintNameChange}
          placeholder="New sprint name"
          value={newSprintName}
        />
        <Button onClick={handleCreateSprint} disabled={!newSprintName.trim()}>
          Create
        </Button>
      </Columns>
      <VerticalSpace space="small" />

      {/* Sprint Dropdown */}
      {sprints.length > 0 && (
        <Dropdown
          onChange={handleSprintDropdownChange}
          options={sprintDropdownOptions}
          value={selectedSprintId}
        />
      )}
      {sprints.length === 0 && (
        <Text>
          <Muted>No sprints yet. Create one above.</Muted>
        </Text>
      )}
      <VerticalSpace space="small" />

      {/* Rename / Delete Buttons */}
      {selectedSprintId && !isRenaming && (
        <Columns space="extraSmall">
          <Button fullWidth onClick={handleStartRename} secondary>
            Rename
          </Button>
          <Button fullWidth onClick={handleOpenDeleteConfirm} secondary>
            Delete
          </Button>
        </Columns>
      )}

      {/* Rename Inline UI */}
      {isRenaming && (
        <div>
          <Textbox
            onChange={handleRenameSprintNameChange}
            placeholder="New name"
            value={renameSprintName}
          />
          <VerticalSpace space="extraSmall" />
          <Columns space="extraSmall">
            <Button
              fullWidth
              onClick={handleConfirmRename}
              disabled={!renameSprintName.trim()}
            >
              Save
            </Button>
            <Button fullWidth onClick={handleCancelRename} secondary>
              Cancel
            </Button>
          </Columns>
        </div>
      )}

      <VerticalSpace space="large" />
      <Divider />
      <VerticalSpace space="large" />

      {/* Component Sets Section */}
      <Text>
        <Bold>Component Sets</Bold>
      </Text>
      <VerticalSpace space="small" />

      <Button fullWidth onClick={handleFindComponentsClick}>
        Find Components
      </Button>
      <VerticalSpace space="small" />

      {componentSets.length > 0 && (
        <Text>
          <Muted>Found {componentSets.length} component set(s)</Muted>
        </Text>
      )}
      {componentSets.length > 0 && <VerticalSpace space="small" />}
      {componentSets.length > 0 && (
        <TextboxAutocomplete
          filter
          onValueInput={handleComponentSearchChange}
          options={componentAutocompleteOptions}
          placeholder="Search components..."
          value={componentSearchValue}
        />
      )}
      {componentSets.length === 0 && (
        <Text>
          <Muted>
            No component sets found. Click "Find Components" to scan.
          </Muted>
        </Text>
      )}

      <VerticalSpace space="large" />
      <Divider />
      <VerticalSpace space="large" />

      {/* Delete Confirmation Modal */}
      <Modal
        onCloseButtonClick={handleCancelDelete}
        open={isDeleteConfirmOpen}
        title="Delete Sprint"
      >
        <div style={{ padding: "16px" }}>
          <Text>
            Are you sure you want to delete sprint "
            <Bold>{selectedSprint?.name}</Bold>"?
          </Text>
          <VerticalSpace space="small" />
          <Text>
            <Muted>
              This action cannot be undone. All release notes in this sprint
              will be lost.
            </Muted>
          </Text>
          <VerticalSpace space="large" />
          <Columns space="extraSmall">
            <Button fullWidth onClick={handleConfirmDelete} danger>
              Delete
            </Button>
            <Button fullWidth onClick={handleCancelDelete} secondary>
              Cancel
            </Button>
          </Columns>
        </div>
      </Modal>
    </Container>
  );
}

export default render(Plugin);
