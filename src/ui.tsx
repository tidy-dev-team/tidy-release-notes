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
  TextboxMultiline,
  VerticalSpace,
} from "@create-figma-plugin/ui";
import {
  IconColumns,
  IconEdit,
  IconFocus2,
  IconTrash,
} from "@tabler/icons-preact";
import { emit, on } from "@create-figma-plugin/utilities";
import { h } from "preact";
import { useCallback, useEffect, useState, useMemo } from "preact/hooks";
import "!./app.css";

import {
  AddNoteHandler,
  ComponentSetInfo,
  ComponentSetsFoundHandler,
  ComponentSetsLoadedHandler,
  ComponentSetsPayload,
  CreateSprintHandler,
  DeleteNoteHandler,
  DeleteSprintHandler,
  EditNoteHandler,
  FindComponentSetsHandler,
  LoadComponentSetsHandler,
  LoadSprintsHandler,
  NoteTag,
  ReleaseNote,
  RenameSprintHandler,
  SelectComponentSetHandler,
  SelectSprintHandler,
  Sprint,
  SprintsLoadedHandler,
  SprintsPayload,
  SprintsUpdatedHandler,
  ViewComponentSetHandler,
  PublishSprintReleaseNotesHandler,
  SprintReleaseNotesPublishedHandler,
} from "./types";

// ===================
// Constants
// ===================

const TAG_OPTIONS: DropdownOption[] = [
  { value: "bug_fix", text: "Bug fix" },
  { value: "enhancement", text: "Enhancement" },
  { value: "new_component", text: "New component" },
  { value: "deprecation", text: "Deprecation" },
  { value: "deleted", text: "Deleted" },
];

const TAG_COLORS: Record<NoteTag, string> = {
  bug_fix: "#F24822",
  enhancement: "#0D99FF",
  new_component: "#14AE5C",
  deprecation: "#FFA629",
  deleted: "#8B0000",
};

const TAG_LABELS: Record<NoteTag, string> = {
  bug_fix: "Bug fix",
  enhancement: "Enhancement",
  new_component: "New component",
  deprecation: "Deprecation",
  deleted: "Deleted",
};

// ===================
// Helper Functions
// ===================

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

// ===================
// Note Card Component
// ===================

interface NoteCardProps {
  note: ReleaseNote;
  onView: (note: ReleaseNote) => void;
  onEdit: (note: ReleaseNote) => void;
  onDelete: (noteId: string) => void;
}

function NoteCard({ note, onView, onEdit, onDelete }: NoteCardProps) {
  const tagColor = TAG_COLORS[note.tag];
  const tagLabel = TAG_LABELS[note.tag];

  return (
    <div
      style={{
        border: "1px solid var(--figma-color-border)",
        borderRadius: "4px",
        padding: "12px",
        marginBottom: "8px",
      }}
    >
      {/* Tag Badge */}
      <div
        style={{
          display: "inline-block",
          backgroundColor: tagColor,
          color: "white",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: "bold",
          marginBottom: "8px",
        }}
      >
        {tagLabel}
      </div>

      {/* Description */}
      <div style={{ marginBottom: "8px" }}>
        <Text>{truncateText(note.description, 100)}</Text>
      </div>

      {/* Component */}
      <div style={{ marginBottom: "4px" }}>
        <Text>
          <Muted>Component: </Muted>
          <span style={{ color: "#9747FF" }}>{note.componentSetName}</span>
        </Text>
      </div>

      {/* Date & Author */}
      <div style={{ marginBottom: "8px" }}>
        <Text>
          <Muted>
            {formatDate(note.createdAt)} • {note.authorName}
          </Muted>
        </Text>
      </div>

      {/* Actions */}
      <Columns space="extraSmall">
        <Button
          className={"button-flex"}
          fullWidth
          onClick={() => onView(note)}
          secondary
        >
          <IconFocus2 size={16} />
        </Button>
        <Button
          className={"button-flex"}
          fullWidth
          onClick={() => onEdit(note)}
          secondary
        >
          <IconEdit size={16} />
        </Button>
        <Button
          className={"button-flex"}
          fullWidth
          onClick={() => onDelete(note.id)}
          secondary
        >
          <IconTrash size={16} />
        </Button>
      </Columns>
    </div>
  );
}

// ===================
// Main Plugin Component
// ===================

function Plugin() {
  // ===================
  // Component Sets State
  // ===================
  const [componentSets, setComponentSets] = useState<ComponentSetInfo[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null
  );
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
  // Note State
  // ===================
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<ReleaseNote | null>(null);
  const [noteDescription, setNoteDescription] = useState<string>("");
  const [noteTag, setNoteTag] = useState<NoteTag>("enhancement");
  const [isDeleteNoteConfirmOpen, setIsDeleteNoteConfirmOpen] =
    useState<boolean>(false);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(
    null
  );
  const [isPublishingSprintNotes, setIsPublishingSprintNotes] =
    useState<boolean>(false);

  // ===================
  // Derived State
  // ===================
  const selectedSprint = useMemo(
    () => sprints.find((s) => s.id === selectedSprintId),
    [sprints, selectedSprintId]
  );

  const selectedComponent = useMemo(
    () => componentSets.find((cs) => cs.id === selectedComponentId),
    [componentSets, selectedComponentId]
  );

  const currentSprintNotes = useMemo(() => {
    if (!selectedSprint) return [];
    return [...selectedSprint.notes].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [selectedSprint]);

  // ===================
  // Initialization
  // ===================
  useEffect(() => {
    // Component Sets listeners
    const handleComponentSetsPayload = (payload: ComponentSetsPayload) => {
      setComponentSets(payload.componentSets);
      setSelectedComponentId(payload.lastSelectedComponentSetId);
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

    on<SprintReleaseNotesPublishedHandler>(
      "SPRINT_RELEASE_NOTES_PUBLISHED",
      () => {
        setIsPublishingSprintNotes(false);
      }
    );

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

  const handlePublishSprintNotes = useCallback(() => {
    if (!selectedSprintId) {
      return;
    }
    setIsPublishingSprintNotes(true);
    emit<PublishSprintReleaseNotesHandler>(
      "PUBLISH_SPRINT_RELEASE_NOTES",
      selectedSprintId
    );
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
  // Note Handlers
  // ===================
  const handleOpenAddNote = useCallback(() => {
    setEditingNote(null);
    setNoteDescription("");
    setNoteTag("enhancement");
    setIsNoteModalOpen(true);
  }, []);

  const handleViewNoteComponent = useCallback((note: ReleaseNote) => {
    emit<ViewComponentSetHandler>("VIEW_COMPONENT_SET", note.componentSetId);
  }, []);

  const handleOpenEditNote = useCallback((note: ReleaseNote) => {
    setEditingNote(note);
    setNoteDescription(note.description);
    setNoteTag(note.tag);
    setIsNoteModalOpen(true);
  }, []);

  const handleCloseNoteModal = useCallback(() => {
    setIsNoteModalOpen(false);
    setEditingNote(null);
    setNoteDescription("");
    setNoteTag("enhancement");
  }, []);

  const handleNoteDescriptionChange = useCallback((newValue: string) => {
    setNoteDescription(newValue);
  }, []);

  const handleNoteTagChange = useCallback((event: Event) => {
    const target = event.target as HTMLInputElement;
    setNoteTag(target.value as NoteTag);
  }, []);

  const handleSaveNote = useCallback(() => {
    const trimmedDescription = noteDescription.trim();
    if (
      !trimmedDescription ||
      !selectedSprintId ||
      !selectedComponentId ||
      !selectedComponent
    ) {
      return;
    }

    if (editingNote) {
      // Edit existing note
      emit<EditNoteHandler>("EDIT_NOTE", {
        sprintId: selectedSprintId,
        noteId: editingNote.id,
        description: trimmedDescription,
        tag: noteTag,
      });
    } else {
      // Add new note
      emit<AddNoteHandler>("ADD_NOTE", {
        sprintId: selectedSprintId,
        description: trimmedDescription,
        tag: noteTag,
        componentSetId: selectedComponentId,
        componentSetName: selectedComponent.name,
      });
    }

    handleCloseNoteModal();
  }, [
    noteDescription,
    noteTag,
    selectedSprintId,
    selectedComponentId,
    selectedComponent,
    editingNote,
    handleCloseNoteModal,
  ]);

  const handleOpenDeleteNoteConfirm = useCallback((noteId: string) => {
    setPendingDeleteNoteId(noteId);
    setIsDeleteNoteConfirmOpen(true);
  }, []);

  const handleConfirmDeleteNote = useCallback(() => {
    if (pendingDeleteNoteId && selectedSprintId) {
      emit<DeleteNoteHandler>("DELETE_NOTE", {
        sprintId: selectedSprintId,
        noteId: pendingDeleteNoteId,
      });
      setIsDeleteNoteConfirmOpen(false);
      setPendingDeleteNoteId(null);
    }
  }, [pendingDeleteNoteId, selectedSprintId]);

  const handleCancelDeleteNote = useCallback(() => {
    setIsDeleteNoteConfirmOpen(false);
    setPendingDeleteNoteId(null);
  }, []);

  // ===================
  // Dropdown Options
  // ===================
  const componentAutocompleteOptions: TextboxAutocompleteOption[] = [
    ...componentSets,
  ]
    .filter((cs) => !cs.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cs) => ({
      value: cs.name,
    }));

  const sprintDropdownOptions: DropdownOption[] = sprints.map((s) => ({
    value: s.id,
    text: s.name,
  }));

  const canAddNote = selectedSprintId && selectedComponentId;

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

      {/* Sprint Action Buttons */}
      {selectedSprintId && !isRenaming && (
        <Columns space="extraSmall">
          <Button
            className={"button-flex"}
            fullWidth
            onClick={handlePublishSprintNotes}
            secondary
            disabled={isPublishingSprintNotes}
          >
            <IconColumns size={16} />
          </Button>
          <Button
            className={"button-flex"}
            fullWidth
            onClick={handleStartRename}
            secondary
          >
            <IconEdit size={16} />
          </Button>
          <Button
            className={"button-flex"}
            fullWidth
            onClick={handleOpenDeleteConfirm}
            secondary
          >
            <IconTrash size={16} />
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

      <Button fullWidth onClick={handleFindComponentsClick} secondary>
        Scan for new components
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

      {/* Release Notes Section */}
      <Text>
        <Bold>Release Notes</Bold>
      </Text>
      <VerticalSpace space="small" />

      <Button fullWidth onClick={handleOpenAddNote} disabled={!canAddNote}>
        + Add Note
      </Button>
      {!canAddNote && (
        <div>
          <VerticalSpace space="small" />
          <Text>
            <Muted>Select a sprint and component to add notes.</Muted>
          </Text>
        </div>
      )}
      <VerticalSpace space="small" />

      {/* Notes List */}
      {currentSprintNotes.length === 0 && selectedSprintId && (
        <Text>
          <Muted>No notes yet. Click "Add Note" to create one.</Muted>
        </Text>
      )}

      {currentSprintNotes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onView={handleViewNoteComponent}
          onEdit={handleOpenEditNote}
          onDelete={handleOpenDeleteNoteConfirm}
        />
      ))}

      <VerticalSpace space="small" />

      {/* Delete Sprint Confirmation Modal */}
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

      {/* Add/Edit Note Modal */}
      <Modal
        onCloseButtonClick={handleCloseNoteModal}
        open={isNoteModalOpen}
        title={editingNote ? "Edit Note" : "Add Note"}
      >
        <div style={{ padding: "16px" }}>
          <Text>
            <Bold>Description</Bold>
          </Text>
          <VerticalSpace space="small" />
          <TextboxMultiline
            onValueInput={handleNoteDescriptionChange}
            placeholder="Describe the change..."
            rows={4}
            value={noteDescription}
          />
          <VerticalSpace space="medium" />

          <Text>
            <Bold>Tag</Bold>
          </Text>
          <VerticalSpace space="small" />
          <Dropdown
            onChange={handleNoteTagChange}
            options={TAG_OPTIONS}
            value={noteTag}
          />
          <VerticalSpace space="medium" />

          <Text>
            <Bold>Component Set</Bold>
          </Text>
          <VerticalSpace space="small" />
          <Text>
            <Muted>
              {editingNote
                ? editingNote.componentSetName
                : selectedComponent?.name ?? "None selected"}
            </Muted>
          </Text>

          {editingNote && (
            <div>
              <VerticalSpace space="medium" />
              <Text>
                <Muted>
                  Created: {formatDate(editingNote.createdAt)} by{" "}
                  {editingNote.authorName}
                </Muted>
              </Text>
            </div>
          )}

          <VerticalSpace space="large" />
          <Columns space="extraSmall">
            <Button
              fullWidth
              onClick={handleSaveNote}
              disabled={!noteDescription.trim()}
            >
              {editingNote ? "Save Changes" : "Add Note"}
            </Button>
            <Button fullWidth onClick={handleCloseNoteModal} secondary>
              Cancel
            </Button>
          </Columns>
        </div>
      </Modal>

      {/* Delete Note Confirmation Modal */}
      <Modal
        onCloseButtonClick={handleCancelDeleteNote}
        open={isDeleteNoteConfirmOpen}
        title="Delete Note"
      >
        <div style={{ padding: "16px" }}>
          <Text>Are you sure you want to delete this note?</Text>
          <VerticalSpace space="small" />
          <Text>
            <Muted>This action cannot be undone.</Muted>
          </Text>
          <VerticalSpace space="large" />
          <Columns space="extraSmall">
            <Button fullWidth onClick={handleConfirmDeleteNote} danger>
              Delete
            </Button>
            <Button fullWidth onClick={handleCancelDeleteNote} secondary>
              Cancel
            </Button>
          </Columns>
        </div>
      </Modal>
    </Container>
  );
}

export default render(Plugin);
