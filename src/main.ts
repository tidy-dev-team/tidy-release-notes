import { on, emit, showUI } from "@create-figma-plugin/utilities";

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
  SprintReleaseNotesPublishedHandler,
} from "./types";

const PLUGIN_NAMESPACE = "tidy_release_notes";
const COMPONENT_SETS_KEY = "componentSets";
const LAST_COMPONENT_SET_ID_KEY = "last_component_set_id";
const LAST_SPRINT_ID_KEY = "last_sprint_id";
const SPRINT_KEY_PREFIX = "sprint_";

// ===================
// Component Sets Helpers
// ===================

function getLastComponentSetId(): string | null {
  const id = figma.root.getSharedPluginData(
    PLUGIN_NAMESPACE,
    LAST_COMPONENT_SET_ID_KEY
  );
  return id || null;
}

function setLastComponentSetId(id: string | null): void {
  figma.root.setSharedPluginData(
    PLUGIN_NAMESPACE,
    LAST_COMPONENT_SET_ID_KEY,
    id ?? ""
  );
}

function getComponentSetsPayload(
  componentSets: ComponentSetInfo[]
): ComponentSetsPayload {
  let lastSelectedComponentSetId = getLastComponentSetId();

  // Validate that last selected component set still exists
  if (
    lastSelectedComponentSetId &&
    !componentSets.find((cs) => cs.id === lastSelectedComponentSetId)
  ) {
    lastSelectedComponentSetId =
      componentSets.length > 0 ? componentSets[0].id : null;
    setLastComponentSetId(lastSelectedComponentSetId);
  }

  return { componentSets, lastSelectedComponentSetId };
}

// ===================
// Sprint Helpers
// ===================

function loadAllSprints(): Sprint[] {
  const keys = figma.root.getSharedPluginDataKeys(PLUGIN_NAMESPACE);
  const sprintKeys = keys.filter((key) => key.startsWith(SPRINT_KEY_PREFIX));

  const sprints: Sprint[] = [];
  for (const key of sprintKeys) {
    const data = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, key);
    if (data) {
      try {
        const sprint = JSON.parse(data) as Sprint;
        sprints.push(sprint);
      } catch (e) {
        console.error(`Failed to parse sprint data for key ${key}:`, e);
      }
    }
  }

  return sprints;
}

function saveSprint(sprint: Sprint): void {
  const key = `${SPRINT_KEY_PREFIX}${sprint.id}`;
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, key, JSON.stringify(sprint));
}

function deleteSprint(id: string): void {
  const key = `${SPRINT_KEY_PREFIX}${id}`;
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, key, "");
}

function getLastSprintId(): string | null {
  const id = figma.root.getSharedPluginData(
    PLUGIN_NAMESPACE,
    LAST_SPRINT_ID_KEY
  );
  return id || null;
}

function setLastSprintId(id: string | null): void {
  figma.root.setSharedPluginData(
    PLUGIN_NAMESPACE,
    LAST_SPRINT_ID_KEY,
    id ?? ""
  );
}

function getSprintsPayload(): SprintsPayload {
  const sprints = loadAllSprints();
  let lastSelectedSprintId = getLastSprintId();

  // Validate that last selected sprint still exists
  if (
    lastSelectedSprintId &&
    !sprints.find((s) => s.id === lastSelectedSprintId)
  ) {
    lastSelectedSprintId = sprints.length > 0 ? sprints[0].id : null;
    setLastSprintId(lastSelectedSprintId);
  }

  return { sprints, lastSelectedSprintId };
}

// ===================
// Navigation Helpers
// ===================

function findParentPage(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === "PAGE") {
      return current as PageNode;
    }
    current = current.parent;
  }
  return null;
}

function getOrCreateReleaseNotesPage(): PageNode {
  const existing = figma.root.children.find(
    (child) => child.type === "PAGE" && child.name === "Release notes"
  ) as PageNode | undefined;

  if (existing) {
    return existing;
  }

  const page = figma.createPage();
  page.name = "Release notes";
  // New pages are appended to figma.root by default as last child
  return page;
}

function getOrCreateReleaseNotesFrame(page: PageNode): FrameNode {
  const existing = page.children.find(
    (child) => child.type === "FRAME" && child.name === "release-notes-frame"
  ) as FrameNode | undefined;

  if (existing) {
    return existing;
  }

  const frame = figma.createFrame();
  frame.name = "release-notes-frame";
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.itemSpacing = 20;
  frame.paddingTop = 0;
  frame.paddingRight = 0;
  frame.paddingBottom = 0;
  frame.paddingLeft = 0;
  frame.x = 0;
  frame.y = 0;

  page.appendChild(frame);
  return frame;
}

// ===================
// Design System Colors
// ===================
const COLORS = {
  bgSurface: { r: 0x00 / 255, g: 0x0a / 255, b: 0x19 / 255 }, // #000a19
  textBold: { r: 0xee / 255, g: 0xf3 / 255, b: 0xfc / 255 }, // #eef3fc
  textMuted: { r: 0x87 / 255, g: 0x98 / 255, b: 0xb2 / 255 }, // #8798b2
  timelineLine: { r: 0x87 / 255, g: 0x98 / 255, b: 0xb2 / 255 }, // #8798b2
};

// Tag badge config: emoji, label, background color (RGBA with alpha)
const TAG_BADGE_CONFIG: Record<
  string,
  { emoji: string; label: string; bgColor: RGBA }
> = {
  new_component: {
    emoji: "✅",
    label: "Added",
    bgColor: { r: 77 / 255, g: 255 / 255, b: 166 / 255, a: 0.2 },
  },
  enhancement: {
    emoji: "🎾",
    label: "Changed",
    bgColor: { r: 77 / 255, g: 200 / 255, b: 255 / 255, a: 0.2 },
  },
  bug_fix: {
    emoji: "🔨",
    label: "Fixed",
    bgColor: { r: 255 / 255, g: 166 / 255, b: 77 / 255, a: 0.2 },
  },
  deprecation: {
    emoji: "📦",
    label: "Deprecated",
    bgColor: { r: 242 / 255, g: 204 / 255, b: 13 / 255, a: 0.2 },
  },
  deleted: {
    emoji: "🗑️",
    label: "Deleted",
    bgColor: { r: 255 / 255, g: 100 / 255, b: 100 / 255, a: 0.2 },
  },
};

function formatNoteDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function createStatusBadge(tag: string): FrameNode {
  const config = TAG_BADGE_CONFIG[tag] || TAG_BADGE_CONFIG.enhancement;

  const badge = figma.createFrame();
  badge.name = "Status Badge";
  badge.layoutMode = "HORIZONTAL";
  badge.primaryAxisSizingMode = "AUTO";
  badge.counterAxisSizingMode = "AUTO";
  badge.counterAxisAlignItems = "CENTER";
  badge.itemSpacing = 4;
  badge.paddingTop = 2;
  badge.paddingBottom = 2;
  badge.paddingLeft = 6;
  badge.paddingRight = 6;
  badge.cornerRadius = 6;
  badge.topLeftRadius = 2;
  badge.fills = [
    {
      type: "SOLID",
      color: { r: config.bgColor.r, g: config.bgColor.g, b: config.bgColor.b },
      opacity: config.bgColor.a,
    },
  ];

  const emojiText = figma.createText();
  emojiText.fontName = { family: "Inter", style: "Semi Bold" };
  emojiText.fontSize = 14;
  emojiText.characters = config.emoji;
  emojiText.fills = [{ type: "SOLID", color: COLORS.textBold }];

  const labelText = figma.createText();
  labelText.fontName = { family: "Inter", style: "Semi Bold" };
  labelText.fontSize = 14;
  labelText.characters = config.label;
  labelText.fills = [{ type: "SOLID", color: COLORS.textBold }];

  badge.appendChild(emojiText);
  badge.appendChild(labelText);

  return badge;
}

function createTimelineDiamond(): FrameNode {
  const container = figma.createFrame();
  container.name = "diamond";
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "FIXED";
  container.counterAxisSizingMode = "AUTO";
  container.primaryAxisAlignItems = "CENTER";
  container.counterAxisAlignItems = "CENTER";
  container.resize(11.314, 11.314);
  container.fills = [];

  const diamond = figma.createRectangle();
  diamond.name = "diamond-shape";
  diamond.resize(8, 8);
  diamond.rotation = 45;
  diamond.cornerRadius = 1;
  diamond.fills = [{ type: "SOLID", color: COLORS.textMuted }];

  container.appendChild(diamond);
  return container;
}

function createTimelineColumn(height: number, isLast: boolean): FrameNode {
  const timeline = figma.createFrame();
  timeline.name = "timeline";
  timeline.layoutMode = "VERTICAL";
  timeline.primaryAxisSizingMode = "FIXED";
  timeline.counterAxisSizingMode = "AUTO";
  timeline.counterAxisAlignItems = "CENTER";
  timeline.layoutSizingHorizontal = "HUG";
  timeline.resize(27, 100);
  timeline.paddingTop = 12;
  timeline.paddingLeft = 8;
  timeline.paddingRight = 8;
  timeline.paddingBottom = 12;
  timeline.itemSpacing = 8;
  timeline.fills = [];
  timeline.layoutAlign = "STRETCH";

  const diamond = createTimelineDiamond();
  timeline.appendChild(diamond);

  if (!isLast) {
    const line = figma.createRectangle();
    line.name = "timeline-line";
    line.resize(1, 10);
    line.fills = [{ type: "SOLID", color: COLORS.timelineLine }];
    line.layoutAlign = "CENTER";
    line.layoutGrow = 1;
    timeline.appendChild(line);
  }

  return timeline;
}

async function buildSprintNotesTable(
  sprint: Sprint,
  notes: ReleaseNote[],
  includeSprintHeader: boolean = true
): Promise<FrameNode> {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  // Main container with dark background
  const container = figma.createFrame();
  container.name = `Changelog – ${sprint.name}`;
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "AUTO";
  container.counterAxisSizingMode = "FIXED";
  container.resize(560, 100);
  container.paddingTop = 32;
  container.paddingBottom = 32;
  container.paddingLeft = 0;
  container.paddingRight = 0;
  container.itemSpacing = 0;
  container.cornerRadius = 24;
  container.fills = [{ type: "SOLID", color: COLORS.bgSurface }];
  container.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.06 },
      offset: { x: 0, y: 4 },
      radius: 16,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  // Changelog section
  const changelogSection = figma.createFrame();
  changelogSection.name = "Changelog";
  changelogSection.layoutMode = "VERTICAL";
  changelogSection.primaryAxisSizingMode = "AUTO";
  changelogSection.counterAxisSizingMode = "AUTO";
  changelogSection.layoutAlign = "STRETCH";
  changelogSection.itemSpacing = 0;
  changelogSection.fills = [];

  // Title row: "Changelog" (only for aggregated view)
  if (includeSprintHeader) {
    const titleRow = figma.createFrame();
    titleRow.name = "Title";
    titleRow.layoutMode = "HORIZONTAL";
    titleRow.primaryAxisSizingMode = "FIXED";
    titleRow.counterAxisSizingMode = "AUTO";
    titleRow.layoutAlign = "STRETCH";
    titleRow.paddingTop = 8;
    titleRow.paddingBottom = 8;
    titleRow.paddingLeft = 24;
    titleRow.paddingRight = 24;
    titleRow.fills = [];

    const titleText = figma.createText();
    titleText.fontName = { family: "Inter", style: "Medium" };
    titleText.fontSize = 24;
    titleText.lineHeight = { value: 32, unit: "PIXELS" };
    titleText.characters = "Changelog";
    titleText.fills = [{ type: "SOLID", color: COLORS.textBold }];

    titleRow.appendChild(titleText);
    changelogSection.appendChild(titleRow);
  }

  // Sprint version header (appears once per sprint, only for component pages)
  if (!includeSprintHeader) {
    const sprintVersionRow = figma.createFrame();
    sprintVersionRow.name = "Sprint version";
    sprintVersionRow.layoutMode = "HORIZONTAL";
    sprintVersionRow.primaryAxisSizingMode = "AUTO";
    sprintVersionRow.counterAxisSizingMode = "AUTO";
    sprintVersionRow.paddingLeft = 24;
    sprintVersionRow.paddingRight = 24;
    sprintVersionRow.fills = [];

    const sprintVersionText = figma.createText();
    sprintVersionText.fontName = { family: "Inter", style: "Bold" };
    sprintVersionText.fontSize = 16;
    sprintVersionText.lineHeight = { value: 24, unit: "PIXELS" };
    sprintVersionText.characters = sprint.name;
    sprintVersionText.fills = [{ type: "SOLID", color: COLORS.textMuted }];

    sprintVersionRow.appendChild(sprintVersionText);
    changelogSection.appendChild(sprintVersionRow);
  }

  // Group notes by tag for each sprint entry, sorted by date (newest first)
  const sortedNotes = [...notes].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Group notes by author+date for combined entries
  const noteGroups = new Map<string, ReleaseNote[]>();
  for (const note of sortedNotes) {
    const key = `${note.tag}-${note.authorName}-${
      note.createdAt.split("T")[0]
    }`;
    const existing = noteGroups.get(key) || [];
    existing.push(note);
    noteGroups.set(key, existing);
  }

  const groupEntries = Array.from(noteGroups.entries());

  // Create a single log row for all notes in this sprint
  if (groupEntries.length > 0) {
    // Log row container (one per sprint)
    const logRow = figma.createFrame();
    logRow.name = "Log";
    logRow.layoutMode = "HORIZONTAL";
    logRow.primaryAxisSizingMode = "FIXED";
    logRow.counterAxisSizingMode = "AUTO";
    logRow.layoutAlign = "STRETCH";
    logRow.paddingLeft = 16;
    logRow.paddingRight = 24;
    logRow.itemSpacing = 0;
    logRow.fills = [];

    // Main content area (holds all note groups)
    const mainContent = figma.createFrame();
    mainContent.name = "main";
    mainContent.layoutMode = "VERTICAL";
    mainContent.primaryAxisSizingMode = "AUTO";
    mainContent.counterAxisSizingMode = "AUTO";
    mainContent.paddingTop = 4;
    mainContent.paddingBottom = 8;
    mainContent.itemSpacing = 8;
    mainContent.fills = [];
    mainContent.layoutGrow = 1;

    // Add all note groups to the main content
    for (let i = 0; i < groupEntries.length; i++) {
      const [, groupNotes] = groupEntries[i];
      const firstNote = groupNotes[0];

      // Title row with badge + author + date
      const infoRow = figma.createFrame();
      infoRow.name = "who + when";
      infoRow.layoutMode = "HORIZONTAL";
      infoRow.primaryAxisSizingMode = "AUTO";
      infoRow.counterAxisSizingMode = "AUTO";
      infoRow.itemSpacing = 4;
      infoRow.fills = [];

      // Status badge
      const badge = createStatusBadge(firstNote.tag);
      infoRow.appendChild(badge);

      // "By" text
      const byText = figma.createText();
      byText.fontName = { family: "Inter", style: "Regular" };
      byText.fontSize = 14;
      byText.lineHeight = { value: 24, unit: "PIXELS" };
      byText.characters = "By";
      byText.fills = [{ type: "SOLID", color: COLORS.textBold }];
      infoRow.appendChild(byText);

      // Author name (bold)
      const authorText = figma.createText();
      authorText.fontName = { family: "Inter", style: "Semi Bold" };
      authorText.fontSize = 14;
      authorText.lineHeight = { value: 24, unit: "PIXELS" };
      authorText.characters = firstNote.authorName;
      authorText.fills = [{ type: "SOLID", color: COLORS.textBold }];
      infoRow.appendChild(authorText);

      // "on" text
      const onText = figma.createText();
      onText.fontName = { family: "Inter", style: "Regular" };
      onText.fontSize = 14;
      onText.lineHeight = { value: 24, unit: "PIXELS" };
      onText.characters = "on";
      onText.fills = [{ type: "SOLID", color: COLORS.textBold }];
      infoRow.appendChild(onText);

      // Date
      const dateText = figma.createText();
      dateText.fontName = { family: "Inter", style: "Regular" };
      dateText.fontSize = 14;
      dateText.lineHeight = { value: 24, unit: "PIXELS" };
      dateText.characters = formatNoteDate(firstNote.createdAt);
      dateText.fills = [{ type: "SOLID", color: COLORS.textBold }];
      infoRow.appendChild(dateText);

      mainContent.appendChild(infoRow);

      // Description section with bullets
      const descSection = figma.createFrame();
      descSection.name = "Description";
      descSection.layoutMode = "VERTICAL";
      descSection.primaryAxisSizingMode = "AUTO";
      descSection.counterAxisSizingMode = "AUTO";
      descSection.layoutAlign = "STRETCH";
      descSection.itemSpacing = 4;
      descSection.fills = [];

      for (const note of groupNotes) {
        const bulletRow = figma.createFrame();
        bulletRow.name = "bullet-item";
        bulletRow.layoutMode = "HORIZONTAL";
        bulletRow.primaryAxisSizingMode = "AUTO";
        bulletRow.counterAxisSizingMode = "AUTO";
        bulletRow.itemSpacing = 8;
        bulletRow.fills = [];

        const bulletText = figma.createText();
        bulletText.fontName = { family: "Inter", style: "Medium" };
        bulletText.fontSize = 14;
        bulletText.lineHeight = { value: 20, unit: "PIXELS" };
        bulletText.characters = "•";
        bulletText.fills = [{ type: "SOLID", color: COLORS.textBold }];
        bulletRow.appendChild(bulletText);

        const descText = figma.createText();
        descText.fontName = { family: "Inter", style: "Medium" };
        descText.fontSize = 14;
        descText.lineHeight = { value: 20, unit: "PIXELS" };
        descText.characters = note.description;
        descText.fills = [{ type: "SOLID", color: COLORS.textBold }];
        bulletRow.appendChild(descText);

        descSection.appendChild(bulletRow);
      }

      mainContent.appendChild(descSection);
    }

    // Create timeline column that spans all notes
    const timelineCol = createTimelineColumn(0, false);
    logRow.appendChild(timelineCol);
    logRow.appendChild(mainContent);

    changelogSection.appendChild(logRow);
  }

  container.appendChild(changelogSection);

  // Logo section at bottom
  const logoSection = figma.createFrame();
  logoSection.name = "Logo";
  logoSection.layoutMode = "VERTICAL";
  logoSection.primaryAxisSizingMode = "AUTO";
  logoSection.counterAxisSizingMode = "AUTO";
  logoSection.layoutAlign = "STRETCH";
  logoSection.paddingTop = 32;
  logoSection.paddingLeft = 32;
  logoSection.paddingRight = 32;
  logoSection.fills = [];

  // Create logo from SVG
  const logoSvg = `<svg width="120" height="65" viewBox="0 0 120 65" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M78.7527 0C79.7935 5.61752e-06 80.6565 0.109568 81.3412 0.328678C82.0533 0.520407 82.3684 0.808057 82.2863 1.1915L81.2591 5.99862H84.9157C85.1074 5.99867 85.217 6.19047 85.2444 6.57388C85.2718 6.92994 85.2307 7.32716 85.1212 7.76538C85.039 8.17622 84.9157 8.71714 84.7514 9.04582C84.587 9.37445 84.4089 9.53879 84.2172 9.53884H80.5606L76.6984 27.5278C76.3697 29.0891 76.3835 30.2533 76.7395 31.0202C77.123 31.7871 77.6435 32.1706 78.3008 32.1706C78.7117 32.1706 79.1362 32.0335 79.5744 31.7597C80.04 31.4858 80.4785 31.0886 80.8893 30.5682C81.3275 30.0204 81.7248 29.3493 82.0808 28.555C82.2168 28.2635 82.3421 27.9547 82.4575 27.6288C82.4739 27.5499 82.49 27.4705 82.507 27.3909L85.1775 14.8595C85.2871 14.257 85.6158 13.7775 86.1635 13.4214C86.7113 13.038 87.3414 12.7503 88.0535 12.5586C88.793 12.3395 89.5464 12.1889 90.3133 12.1067C91.0801 12.0246 91.7103 11.9835 92.2033 11.9835C93.2714 11.9835 94.1344 12.0794 94.7917 12.2711C95.5037 12.4902 95.8189 12.7779 95.7368 13.1339C95.5725 13.9282 95.3944 14.7363 95.2027 15.558C95.0109 16.3523 94.8054 17.174 94.5863 18.0231C94.3945 18.8448 94.2029 19.6529 94.0112 20.4472C93.8468 21.2415 93.6823 22.0223 93.518 22.7893C93.3263 23.6657 93.1619 24.4874 93.025 25.2543C92.888 26.0213 92.7785 26.7608 92.6963 27.473C92.532 28.8973 92.5732 30.0203 92.8197 30.842C93.0114 31.6911 93.5182 32.1158 94.3398 32.1158C94.8875 32.1157 95.3807 31.9651 95.8189 31.6639C96.2571 31.3352 96.6406 30.9379 96.9693 30.4724C97.3253 30.0068 97.6267 29.5136 97.8732 28.9932C98.1197 28.4454 98.3115 27.9523 98.4485 27.5141L101.16 14.8595C101.27 14.257 101.598 13.7775 102.146 13.4214C102.721 13.038 103.365 12.7503 104.077 12.5586C104.817 12.3395 105.57 12.1889 106.337 12.1067C107.104 12.0246 107.734 11.9835 108.227 11.9835C109.268 11.9835 110.131 12.0794 110.815 12.2711C111.527 12.4902 111.843 12.7779 111.76 13.1339L105.803 41.0727L105.561 42.224C110.181 42.0236 114.895 42.9907 118.598 46.0775C118.985 46.4096 119.346 46.7584 119.689 47.1296C119.859 47.3188 119.975 47.5584 119.996 47.8161C120.018 48.0737 119.944 48.3261 119.787 48.5224C119.63 48.7186 119.401 48.8465 119.145 48.8828C118.889 48.9193 118.629 48.8585 118.407 48.7347C118.026 48.5278 117.644 48.3455 117.253 48.1795C113.168 46.5238 108.783 46.7392 104.436 47.593L104.201 48.7147L103.338 52.7822C102.982 54.2612 102.461 55.6856 101.776 57.0551C101.119 58.4246 100.297 59.6162 99.3113 60.6296C98.3527 61.6704 97.2158 62.4923 95.9012 63.0949C94.6138 63.7248 93.1482 64.0399 91.5048 64.04C90.5188 64.0399 89.56 63.9577 88.6288 63.7934C87.6976 63.629 86.8346 63.3276 86.0403 62.8894C85.2734 62.4786 84.6023 61.917 84.0271 61.2049C83.4793 60.5201 83.0821 59.6435 82.8356 58.5753C82.4796 56.9867 82.4796 55.2611 82.8356 53.3986C83.2465 51.2895 84.479 49.2076 86.5333 47.1534C88.5876 45.1265 91.4776 44.4143 95.2027 43.6474L95.7368 40.0729C93.8195 41.8259 91.5458 42.5311 88.9163 42.5311C85.1799 42.5311 82.8865 40.9725 82.0357 37.6597C81.7194 38.1531 81.3923 38.6108 81.0536 39.032C79.958 40.4289 78.7253 41.4561 77.3558 42.1135C76.0137 42.7709 74.5345 43.0995 72.9185 43.0996C69.659 43.0995 67.4951 41.7847 66.4268 39.1553C66.2511 38.7114 66.106 38.2311 65.9912 37.7147C65.6859 38.1872 65.3705 38.6265 65.0444 39.032C63.9488 40.4289 62.7161 41.4561 61.3465 42.1135C60.0044 42.7709 58.5252 43.0995 56.9092 43.0996C53.6498 43.0995 51.4858 41.7847 50.4176 39.1553C50.1872 38.5732 50.0093 37.9287 49.8836 37.2218C49.4587 37.8852 49.0174 38.4888 48.5594 39.032C47.3816 40.4289 46.0942 41.4561 44.6973 42.1135C43.3278 42.7709 41.8349 43.0995 40.2189 43.0996C36.9868 43.0995 34.9325 41.8532 34.0559 39.3607C33.1794 36.8408 33.3163 32.8691 34.4667 27.4457C34.6037 26.7336 34.7269 25.9939 34.8365 25.2269C34.9735 24.4326 35.0282 23.7067 35.0009 23.0494C35.0008 22.3921 34.8913 21.858 34.6722 21.4471C34.4531 21.0089 34.0833 20.7896 33.5629 20.7896C33.1521 20.7896 32.7137 20.9814 32.2481 21.3649C31.7824 21.7483 31.3167 22.2826 30.8511 22.9673C30.3855 23.6247 29.9335 24.4191 29.4953 25.3503C29.0844 26.2816 28.7147 27.3088 28.386 28.4318L26.0214 38.3917C25.4051 41.6785 23.3374 42.7902 22.3805 42.9352C21.8328 43.0448 21.2712 43.0995 20.696 43.0996C20.0113 43.0995 19.3402 42.99 18.6828 42.7709C18.0529 42.5518 17.5049 42.1956 17.0393 41.7026C16.6866 41.2837 16.4228 40.7495 16.2475 40.1C15.3787 40.9215 14.4203 41.5536 13.3322 42.1152C11.763 42.9997 10.0224 43.2707 8.11082 43.2707C4.17341 43.2707 1.90506 41.5588 0.792308 38.8197C-0.291899 36.0806 -0.263376 33.0419 0.877905 27.6494L3.65979 14.5959C3.77393 14.0823 4.07355 13.64 4.55856 13.2691C5.04358 12.8697 5.64284 12.5558 6.35609 12.3276C7.06934 12.0708 7.82555 11.8853 8.6244 11.7712C9.45169 11.6571 9.39485 11.6 10.1651 11.6C11.2493 11.6 12.1482 11.6999 12.8614 11.8996C13.6032 12.0993 13.9313 12.399 13.8458 12.7984C13.5034 14.4247 13.1182 16.1081 12.6902 17.8486C12.2623 19.5605 11.8771 21.2296 11.5347 22.856C11.2494 24.1969 11.0068 25.4667 10.8071 26.665C10.6359 27.8348 10.5646 28.862 10.5931 29.7465C10.6216 30.6024 10.7643 31.2872 11.0211 31.8008C11.3064 32.3143 12.2765 32.5712 12.9042 32.5712C13.7031 32.5711 15.1868 32.1574 15.9857 31.33C16.6778 30.6132 17.5301 29.5643 18.0982 28.1837L21.0316 14.9144C21.1411 14.4213 21.4288 13.9967 21.8944 13.6406C22.2274 13.3663 22.6168 13.1343 23.062 12.9441C23.2854 12.8422 23.5231 12.7506 23.775 12.67L23.7716 12.6835C24.4116 12.4645 25.087 12.3042 25.7975 12.2027C26.5918 12.0931 27.3589 12.0384 28.0985 12.0384C29.1392 12.0384 30.002 12.1342 30.6867 12.3259C31.3988 12.5176 31.714 12.8053 31.6318 13.1887L30.9333 16.3934C32.1111 14.9965 33.3712 13.9283 34.7133 13.1887C36.0828 12.4218 37.4798 12.0384 38.904 12.0384C42.1635 12.0384 44.2178 13.3531 45.067 15.9825C45.9161 18.612 45.793 22.5016 44.6973 27.651C44.3686 29.2123 44.3549 30.3765 44.6562 31.1434C44.9575 31.883 45.4232 32.2527 46.0532 32.2527C46.4366 32.2527 46.8612 32.1158 47.3268 31.8419C47.7924 31.5406 48.2581 31.116 48.7237 30.5682C49.1893 29.993 49.614 29.2946 49.9975 28.4729C50.1981 28.0717 50.3821 27.6442 50.55 27.1908L53.1704 13.8872C53.1704 10.9235 59.5799 11.6115 62.7846 12.3259C63.4967 12.5176 63.8117 12.8053 63.7295 13.1887C63.4008 14.75 63.0311 16.3387 62.6203 17.9547C62.2368 19.5708 61.8807 21.1459 61.552 22.6798C61.2781 23.9945 61.0453 25.2271 60.8535 26.3775C60.6892 27.5279 60.6071 28.5413 60.6071 29.4178C60.6345 30.2669 60.7714 30.938 61.0179 31.431C61.2918 31.924 61.7302 32.1706 62.3327 32.1706C63.2092 32.1705 64.0857 31.6501 64.9622 30.6093C65.5654 29.874 66.0714 28.8662 66.48 27.586C66.4897 27.5394 66.4992 27.4926 66.5091 27.4457L70.3711 9.53884H66.9198C66.7008 9.53878 66.5774 9.36072 66.55 9.00469C66.5227 8.62124 66.5501 8.03926 66.6323 7.60104C66.7145 7.19019 66.8378 6.82031 67.0021 6.49163C67.1938 6.16302 67.3992 5.99865 67.6183 5.99862H71.0696L71.727 2.87601C71.8365 2.38302 72.1242 1.95849 72.5898 1.60243C73.0554 1.21899 73.617 0.917599 74.2743 0.698481C74.959 0.451983 75.6851 0.273901 76.452 0.164339C77.2463 0.0547929 78.0133 3.90117e-06 78.7527 0ZM93.6233 49.7577C93.4646 49.1683 92.6283 49.1683 92.4696 49.7577L91.8129 52.1972C91.7575 52.4027 91.5968 52.5633 91.3913 52.6187L88.9519 53.2755C88.3626 53.4342 88.3626 54.2703 88.9519 54.4291L91.3913 55.0859C91.5968 55.1413 91.7576 55.3018 91.8129 55.5074L92.4696 57.9469C92.6283 58.5362 93.4646 58.5362 93.6233 57.9469L94.28 55.5074C94.3353 55.3018 94.4961 55.1413 94.7016 55.0859L97.141 54.4291C97.7303 54.2704 97.7303 53.4342 97.141 53.2755L94.7016 52.6187C94.4961 52.5633 94.3354 52.4027 94.28 52.1972L93.6233 49.7577Z" fill="#D4E2F7"/>
<path d="M60.0888 0.814839C62.2633 0.814928 64.0263 2.57777 64.0263 4.75228C64.0263 6.92682 62.2634 8.68964 60.0888 8.68973C57.9143 8.6897 56.1514 6.92686 56.1514 4.75228C56.1514 2.57773 57.9143 0.814862 60.0888 0.814839Z" fill="#D4E2F7"/>
</svg>`;
  const logoNode = figma.createNodeFromSvg(logoSvg);
  logoNode.name = "Unity Logo";

  logoSection.appendChild(logoNode);
  container.appendChild(logoSection);

  return container;
}

async function buildComponentReleaseNotesFrame(
  componentSet: ComponentSetNode,
  sprints: Sprint[]
): Promise<FrameNode | null> {
  const page = findParentPage(componentSet);
  if (!page) {
    console.warn(
      `Component set "${componentSet.name}" has no parent page, skipping.`
    );
    return null;
  }

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  const frameName = `${componentSet.name}-release-notes`;
  // Remove old frame if it exists
  const existing = page.children.find(
    (child) => child.type === "FRAME" && child.name === frameName
  ) as FrameNode | undefined;

  if (existing) {
    existing.remove();
  }

  // Get all sprints with notes for this component set, sorted by creation (newer first)
  const sprintsWithNotes = sprints
    .filter((sprint) =>
      sprint.notes.some((note) => note.componentSetId === componentSet.id)
    )
    .sort((a, b) => parseInt(b.id) - parseInt(a.id)); // Newer sprints first (by ID as timestamp)

  if (sprintsWithNotes.length === 0) {
    return null;
  }

  // Create ONE main container with dark background for all sprints
  const container = figma.createFrame();
  container.name = frameName;
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "AUTO";
  container.counterAxisSizingMode = "FIXED";
  container.resize(560, 100);
  container.paddingTop = 32;
  container.paddingBottom = 32;
  container.paddingLeft = 0;
  container.paddingRight = 0;
  container.itemSpacing = 0;
  container.cornerRadius = 24;
  container.fills = [{ type: "SOLID", color: COLORS.bgSurface }];
  container.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.06 },
      offset: { x: 0, y: 4 },
      radius: 16,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  // Changelog section
  const changelogSection = figma.createFrame();
  changelogSection.name = "Changelog";
  changelogSection.layoutMode = "VERTICAL";
  changelogSection.primaryAxisSizingMode = "AUTO";
  changelogSection.counterAxisSizingMode = "AUTO";
  changelogSection.layoutAlign = "STRETCH";
  changelogSection.itemSpacing = 0;
  changelogSection.fills = [];

  // Title row: "Changelog"
  const titleRow = figma.createFrame();
  titleRow.name = "Title";
  titleRow.layoutMode = "HORIZONTAL";
  titleRow.primaryAxisSizingMode = "FIXED";
  titleRow.counterAxisSizingMode = "AUTO";
  titleRow.layoutAlign = "STRETCH";
  titleRow.paddingTop = 8;
  titleRow.paddingBottom = 8;
  titleRow.paddingLeft = 24;
  titleRow.paddingRight = 24;
  titleRow.fills = [];

  const titleText = figma.createText();
  titleText.fontName = { family: "Inter", style: "Medium" };
  titleText.fontSize = 24;
  titleText.lineHeight = { value: 32, unit: "PIXELS" };
  titleText.characters = "Changelog";
  titleText.fills = [{ type: "SOLID", color: COLORS.textBold }];

  titleRow.appendChild(titleText);
  changelogSection.appendChild(titleRow);

  // Add each sprint's content
  for (
    let sprintIndex = 0;
    sprintIndex < sprintsWithNotes.length;
    sprintIndex++
  ) {
    const sprint = sprintsWithNotes[sprintIndex];
    const sprintNotes = sprint.notes.filter(
      (note) => note.componentSetId === componentSet.id
    );
    const isLastSprint = sprintIndex === sprintsWithNotes.length - 1;

    // Sort notes by date (newest first)
    const sortedNotes = [...sprintNotes].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Group notes by tag+author+date
    const noteGroups = new Map<string, ReleaseNote[]>();
    for (const note of sortedNotes) {
      const key = `${note.tag}-${note.authorName}-${
        note.createdAt.split("T")[0]
      }`;
      const existing = noteGroups.get(key) || [];
      existing.push(note);
      noteGroups.set(key, existing);
    }

    const groupEntries = Array.from(noteGroups.entries());

    if (groupEntries.length > 0) {
      // Log row container (one per sprint)
      const logRow = figma.createFrame();
      logRow.name = "Log";
      logRow.layoutMode = "HORIZONTAL";
      logRow.primaryAxisSizingMode = "FIXED";
      logRow.counterAxisSizingMode = "AUTO";
      logRow.layoutAlign = "STRETCH";
      logRow.paddingLeft = 16;
      logRow.paddingRight = 24;
      logRow.itemSpacing = 0;
      logRow.fills = [];

      // Main content area (holds sprint name + all note groups)
      const mainContent = figma.createFrame();
      mainContent.name = "main";
      mainContent.layoutMode = "VERTICAL";
      mainContent.primaryAxisSizingMode = "AUTO";
      mainContent.counterAxisSizingMode = "AUTO";
      mainContent.paddingTop = 4;
      mainContent.paddingBottom = 8;
      mainContent.itemSpacing = 8;
      mainContent.fills = [];
      mainContent.layoutGrow = 1;

      // Sprint version header
      const sprintVersionRow = figma.createFrame();
      sprintVersionRow.name = "Sprint version";
      sprintVersionRow.layoutMode = "HORIZONTAL";
      sprintVersionRow.primaryAxisSizingMode = "AUTO";
      sprintVersionRow.counterAxisSizingMode = "AUTO";
      sprintVersionRow.fills = [];

      const sprintVersionText = figma.createText();
      sprintVersionText.fontName = { family: "Inter", style: "Bold" };
      sprintVersionText.fontSize = 16;
      sprintVersionText.lineHeight = { value: 24, unit: "PIXELS" };
      sprintVersionText.characters = sprint.name;
      sprintVersionText.fills = [{ type: "SOLID", color: COLORS.textMuted }];

      sprintVersionRow.appendChild(sprintVersionText);
      mainContent.appendChild(sprintVersionRow);

      // Add all note groups to the main content
      for (let i = 0; i < groupEntries.length; i++) {
        const [, groupNotes] = groupEntries[i];
        const firstNote = groupNotes[0];

        // Title row with badge + author + date
        const infoRow = figma.createFrame();
        infoRow.name = "who + when";
        infoRow.layoutMode = "HORIZONTAL";
        infoRow.primaryAxisSizingMode = "AUTO";
        infoRow.counterAxisSizingMode = "AUTO";
        infoRow.itemSpacing = 4;
        infoRow.fills = [];

        // Status badge
        const badge = createStatusBadge(firstNote.tag);
        infoRow.appendChild(badge);

        // "By" text
        const byText = figma.createText();
        byText.fontName = { family: "Inter", style: "Regular" };
        byText.fontSize = 14;
        byText.lineHeight = { value: 24, unit: "PIXELS" };
        byText.characters = "By";
        byText.fills = [{ type: "SOLID", color: COLORS.textBold }];
        infoRow.appendChild(byText);

        // Author name (bold)
        const authorText = figma.createText();
        authorText.fontName = { family: "Inter", style: "Semi Bold" };
        authorText.fontSize = 14;
        authorText.lineHeight = { value: 24, unit: "PIXELS" };
        authorText.characters = firstNote.authorName;
        authorText.fills = [{ type: "SOLID", color: COLORS.textBold }];
        infoRow.appendChild(authorText);

        // "on" text
        const onText = figma.createText();
        onText.fontName = { family: "Inter", style: "Regular" };
        onText.fontSize = 14;
        onText.lineHeight = { value: 24, unit: "PIXELS" };
        onText.characters = "on";
        onText.fills = [{ type: "SOLID", color: COLORS.textBold }];
        infoRow.appendChild(onText);

        // Date
        const dateText = figma.createText();
        dateText.fontName = { family: "Inter", style: "Regular" };
        dateText.fontSize = 14;
        dateText.lineHeight = { value: 24, unit: "PIXELS" };
        dateText.characters = formatNoteDate(firstNote.createdAt);
        dateText.fills = [{ type: "SOLID", color: COLORS.textBold }];
        infoRow.appendChild(dateText);

        mainContent.appendChild(infoRow);

        // Description section with bullets
        const descSection = figma.createFrame();
        descSection.name = "Description";
        descSection.layoutMode = "VERTICAL";
        descSection.primaryAxisSizingMode = "AUTO";
        descSection.counterAxisSizingMode = "AUTO";
        descSection.layoutAlign = "STRETCH";
        descSection.itemSpacing = 4;
        descSection.fills = [];

        for (const note of groupNotes) {
          const bulletRow = figma.createFrame();
          bulletRow.name = "bullet-item";
          bulletRow.layoutMode = "HORIZONTAL";
          bulletRow.primaryAxisSizingMode = "AUTO";
          bulletRow.counterAxisSizingMode = "AUTO";
          bulletRow.itemSpacing = 8;
          bulletRow.fills = [];

          const bulletText = figma.createText();
          bulletText.fontName = { family: "Inter", style: "Medium" };
          bulletText.fontSize = 14;
          bulletText.lineHeight = { value: 20, unit: "PIXELS" };
          bulletText.characters = "•";
          bulletText.fills = [{ type: "SOLID", color: COLORS.textBold }];
          bulletRow.appendChild(bulletText);

          const descText = figma.createText();
          descText.fontName = { family: "Inter", style: "Medium" };
          descText.fontSize = 14;
          descText.lineHeight = { value: 20, unit: "PIXELS" };
          descText.characters = note.description;
          descText.fills = [{ type: "SOLID", color: COLORS.textBold }];
          bulletRow.appendChild(descText);

          descSection.appendChild(bulletRow);
        }

        mainContent.appendChild(descSection);
      }

      // Create timeline column for this sprint
      const timelineCol = createTimelineColumn(0, isLastSprint);
      logRow.appendChild(timelineCol);
      logRow.appendChild(mainContent);

      changelogSection.appendChild(logRow);
    }
  }

  container.appendChild(changelogSection);

  // Logo section at bottom
  const logoSection = figma.createFrame();
  logoSection.name = "Logo";
  logoSection.layoutMode = "VERTICAL";
  logoSection.primaryAxisSizingMode = "AUTO";
  logoSection.counterAxisSizingMode = "AUTO";
  logoSection.layoutAlign = "STRETCH";
  logoSection.paddingTop = 32;
  logoSection.paddingLeft = 32;
  logoSection.paddingRight = 32;
  logoSection.fills = [];

  // Create logo from SVG
  const logoSvg = `<svg width="120" height="65" viewBox="0 0 120 65" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M78.7527 0C79.7935 5.61752e-06 80.6565 0.109568 81.3412 0.328678C82.0533 0.520407 82.3684 0.808057 82.2863 1.1915L81.2591 5.99862H84.9157C85.1074 5.99867 85.217 6.19047 85.2444 6.57388C85.2718 6.92994 85.2307 7.32716 85.1212 7.76538C85.039 8.17622 84.9157 8.71714 84.7514 9.04582C84.587 9.37445 84.4089 9.53879 84.2172 9.53884H80.5606L76.6984 27.5278C76.3697 29.0891 76.3835 30.2533 76.7395 31.0202C77.123 31.7871 77.6435 32.1706 78.3008 32.1706C78.7117 32.1706 79.1362 32.0335 79.5744 31.7597C80.04 31.4858 80.4785 31.0886 80.8893 30.5682C81.3275 30.0204 81.7248 29.3493 82.0808 28.555C82.2168 28.2635 82.3421 27.9547 82.4575 27.6288C82.4739 27.5499 82.49 27.4705 82.507 27.3909L85.1775 14.8595C85.2871 14.257 85.6158 13.7775 86.1635 13.4214C86.7113 13.038 87.3414 12.7503 88.0535 12.5586C88.793 12.3395 89.5464 12.1889 90.3133 12.1067C91.0801 12.0246 91.7103 11.9835 92.2033 11.9835C93.2714 11.9835 94.1344 12.0794 94.7917 12.2711C95.5037 12.4902 95.8189 12.7779 95.7368 13.1339C95.5725 13.9282 95.3944 14.7363 95.2027 15.558C95.0109 16.3523 94.8054 17.174 94.5863 18.0231C94.3945 18.8448 94.2029 19.6529 94.0112 20.4472C93.8468 21.2415 93.6823 22.0223 93.518 22.7893C93.3263 23.6657 93.1619 24.4874 93.025 25.2543C92.888 26.0213 92.7785 26.7608 92.6963 27.473C92.532 28.8973 92.5732 30.0203 92.8197 30.842C93.0114 31.6911 93.5182 32.1158 94.3398 32.1158C94.8875 32.1157 95.3807 31.9651 95.8189 31.6639C96.2571 31.3352 96.6406 30.9379 96.9693 30.4724C97.3253 30.0068 97.6267 29.5136 97.8732 28.9932C98.1197 28.4454 98.3115 27.9523 98.4485 27.5141L101.16 14.8595C101.27 14.257 101.598 13.7775 102.146 13.4214C102.721 13.038 103.365 12.7503 104.077 12.5586C104.817 12.3395 105.57 12.1889 106.337 12.1067C107.104 12.0246 107.734 11.9835 108.227 11.9835C109.268 11.9835 110.131 12.0794 110.815 12.2711C111.527 12.4902 111.843 12.7779 111.76 13.1339L105.803 41.0727L105.561 42.224C110.181 42.0236 114.895 42.9907 118.598 46.0775C118.985 46.4096 119.346 46.7584 119.689 47.1296C119.859 47.3188 119.975 47.5584 119.996 47.8161C120.018 48.0737 119.944 48.3261 119.787 48.5224C119.63 48.7186 119.401 48.8465 119.145 48.8828C118.889 48.9193 118.629 48.8585 118.407 48.7347C118.026 48.5278 117.644 48.3455 117.253 48.1795C113.168 46.5238 108.783 46.7392 104.436 47.593L104.201 48.7147L103.338 52.7822C102.982 54.2612 102.461 55.6856 101.776 57.0551C101.119 58.4246 100.297 59.6162 99.3113 60.6296C98.3527 61.6704 97.2158 62.4923 95.9012 63.0949C94.6138 63.7248 93.1482 64.0399 91.5048 64.04C90.5188 64.0399 89.56 63.9577 88.6288 63.7934C87.6976 63.629 86.8346 63.3276 86.0403 62.8894C85.2734 62.4786 84.6023 61.917 84.0271 61.2049C83.4793 60.5201 83.0821 59.6435 82.8356 58.5753C82.4796 56.9867 82.4796 55.2611 82.8356 53.3986C83.2465 51.2895 84.479 49.2076 86.5333 47.1534C88.5876 45.1265 91.4776 44.4143 95.2027 43.6474L95.7368 40.0729C93.8195 41.8259 91.5458 42.5311 88.9163 42.5311C85.1799 42.5311 82.8865 40.9725 82.0357 37.6597C81.7194 38.1531 81.3923 38.6108 81.0536 39.032C79.958 40.4289 78.7253 41.4561 77.3558 42.1135C76.0137 42.7709 74.5345 43.0995 72.9185 43.0996C69.659 43.0995 67.4951 41.7847 66.4268 39.1553C66.2511 38.7114 66.106 38.2311 65.9912 37.7147C65.6859 38.1872 65.3705 38.6265 65.0444 39.032C63.9488 40.4289 62.7161 41.4561 61.3465 42.1135C60.0044 42.7709 58.5252 43.0995 56.9092 43.0996C53.6498 43.0995 51.4858 41.7847 50.4176 39.1553C50.1872 38.5732 50.0093 37.9287 49.8836 37.2218C49.4587 37.8852 49.0174 38.4888 48.5594 39.032C47.3816 40.4289 46.0942 41.4561 44.6973 42.1135C43.3278 42.7709 41.8349 43.0995 40.2189 43.0996C36.9868 43.0995 34.9325 41.8532 34.0559 39.3607C33.1794 36.8408 33.3163 32.8691 34.4667 27.4457C34.6037 26.7336 34.7269 25.9939 34.8365 25.2269C34.9735 24.4326 35.0282 23.7067 35.0009 23.0494C35.0008 22.3921 34.8913 21.858 34.6722 21.4471C34.4531 21.0089 34.0833 20.7896 33.5629 20.7896C33.1521 20.7896 32.7137 20.9814 32.2481 21.3649C31.7824 21.7483 31.3167 22.2826 30.8511 22.9673C30.3855 23.6247 29.9335 24.4191 29.4953 25.3503C29.0844 26.2816 28.7147 27.3088 28.386 28.4318L26.0214 38.3917C25.4051 41.6785 23.3374 42.7902 22.3805 42.9352C21.8328 43.0448 21.2712 43.0995 20.696 43.0996C20.0113 43.0995 19.3402 42.99 18.6828 42.7709C18.0529 42.5518 17.5049 42.1956 17.0393 41.7026C16.6866 41.2837 16.4228 40.7495 16.2475 40.1C15.3787 40.9215 14.4203 41.5536 13.3322 42.1152C11.763 42.9997 10.0224 43.2707 8.11082 43.2707C4.17341 43.2707 1.90506 41.5588 0.792308 38.8197C-0.291899 36.0806 -0.263376 33.0419 0.877905 27.6494L3.65979 14.5959C3.77393 14.0823 4.07355 13.64 4.55856 13.2691C5.04358 12.8697 5.64284 12.5558 6.35609 12.3276C7.06934 12.0708 7.82555 11.8853 8.6244 11.7712C9.45169 11.6571 9.39485 11.6 10.1651 11.6C11.2493 11.6 12.1482 11.6999 12.8614 11.8996C13.6032 12.0993 13.9313 12.399 13.8458 12.7984C13.5034 14.4247 13.1182 16.1081 12.6902 17.8486C12.2623 19.5605 11.8771 21.2296 11.5347 22.856C11.2494 24.1969 11.0068 25.4667 10.8071 26.665C10.6359 27.8348 10.5646 28.862 10.5931 29.7465C10.6216 30.6024 10.7643 31.2872 11.0211 31.8008C11.3064 32.3143 12.2765 32.5712 12.9042 32.5712C13.7031 32.5711 15.1868 32.1574 15.9857 31.33C16.6778 30.6132 17.5301 29.5643 18.0982 28.1837L21.0316 14.9144C21.1411 14.4213 21.4288 13.9967 21.8944 13.6406C22.2274 13.3663 22.6168 13.1343 23.062 12.9441C23.2854 12.8422 23.5231 12.7506 23.775 12.67L23.7716 12.6835C24.4116 12.4645 25.087 12.3042 25.7975 12.2027C26.5918 12.0931 27.3589 12.0384 28.0985 12.0384C29.1392 12.0384 30.002 12.1342 30.6867 12.3259C31.3988 12.5176 31.714 12.8053 31.6318 13.1887L30.9333 16.3934C32.1111 14.9965 33.3712 13.9283 34.7133 13.1887C36.0828 12.4218 37.4798 12.0384 38.904 12.0384C42.1635 12.0384 44.2178 13.3531 45.067 15.9825C45.9161 18.612 45.793 22.5016 44.6973 27.651C44.3686 29.2123 44.3549 30.3765 44.6562 31.1434C44.9575 31.883 45.4232 32.2527 46.0532 32.2527C46.4366 32.2527 46.8612 32.1158 47.3268 31.8419C47.7924 31.5406 48.2581 31.116 48.7237 30.5682C49.1893 29.993 49.614 29.2946 49.9975 28.4729C50.1981 28.0717 50.3821 27.6442 50.55 27.1908L53.1704 13.8872C53.1704 10.9235 59.5799 11.6115 62.7846 12.3259C63.4967 12.5176 63.8117 12.8053 63.7295 13.1887C63.4008 14.75 63.0311 16.3387 62.6203 17.9547C62.2368 19.5708 61.8807 21.1459 61.552 22.6798C61.2781 23.9945 61.0453 25.2271 60.8535 26.3775C60.6892 27.5279 60.6071 28.5413 60.6071 29.4178C60.6345 30.2669 60.7714 30.938 61.0179 31.431C61.2918 31.924 61.7302 32.1706 62.3327 32.1706C63.2092 32.1705 64.0857 31.6501 64.9622 30.6093C65.5654 29.874 66.0714 28.8662 66.48 27.586C66.4897 27.5394 66.4992 27.4926 66.5091 27.4457L70.3711 9.53884H66.9198C66.7008 9.53878 66.5774 9.36072 66.55 9.00469C66.5227 8.62124 66.5501 8.03926 66.6323 7.60104C66.7145 7.19019 66.8378 6.82031 67.0021 6.49163C67.1938 6.16302 67.3992 5.99865 67.6183 5.99862H71.0696L71.727 2.87601C71.8365 2.38302 72.1242 1.95849 72.5898 1.60243C73.0554 1.21899 73.617 0.917599 74.2743 0.698481C74.959 0.451983 75.6851 0.273901 76.452 0.164339C77.2463 0.0547929 78.0133 3.90117e-06 78.7527 0ZM93.6233 49.7577C93.4646 49.1683 92.6283 49.1683 92.4696 49.7577L91.8129 52.1972C91.7575 52.4027 91.5968 52.5633 91.3913 52.6187L88.9519 53.2755C88.3626 53.4342 88.3626 54.2703 88.9519 54.4291L91.3913 55.0859C91.5968 55.1413 91.7576 55.3018 91.8129 55.5074L92.4696 57.9469C92.6283 58.5362 93.4646 58.5362 93.6233 57.9469L94.28 55.5074C94.3353 55.3018 94.4961 55.1413 94.7016 55.0859L97.141 54.4291C97.7303 54.2704 97.7303 53.4342 97.141 53.2755L94.7016 52.6187C94.4961 52.5633 94.3354 52.4027 94.28 52.1972L93.6233 49.7577Z" fill="#D4E2F7"/>
<path d="M60.0888 0.814839C62.2633 0.814928 64.0263 2.57777 64.0263 4.75228C64.0263 6.92682 62.2634 8.68964 60.0888 8.68973C57.9143 8.6897 56.1514 6.92686 56.1514 4.75228C56.1514 2.57773 57.9143 0.814862 60.0888 0.814839Z" fill="#D4E2F7"/>
</svg>`;
  const logoNode = figma.createNodeFromSvg(logoSvg);
  logoNode.name = "Unity Logo";

  logoSection.appendChild(logoNode);
  container.appendChild(logoSection);

  page.appendChild(container);

  return container;
}

// ===================
// Main Plugin
// ===================

export default function () {
  // ===================
  // Component Sets Handlers
  // ===================

  on<FindComponentSetsHandler>("FIND_COMPONENT_SETS", function () {
    const componentSetNodes = figma.root.findAllWithCriteria({
      types: ["COMPONENT_SET"],
    });

    const componentSets: ComponentSetInfo[] = componentSetNodes.map((node) => ({
      id: node.id,
      name: node.name,
    }));

    figma.root.setSharedPluginData(
      PLUGIN_NAMESPACE,
      COMPONENT_SETS_KEY,
      JSON.stringify(componentSets)
    );

    const payload = getComponentSetsPayload(componentSets);
    emit<ComponentSetsFoundHandler>("COMPONENT_SETS_FOUND", payload);
  });

  on<LoadComponentSetsHandler>("LOAD_COMPONENT_SETS", function () {
    const savedData = figma.root.getSharedPluginData(
      PLUGIN_NAMESPACE,
      COMPONENT_SETS_KEY
    );

    let componentSets: ComponentSetInfo[] = [];
    if (savedData) {
      try {
        componentSets = JSON.parse(savedData);
      } catch (e) {
        console.error("Failed to parse saved component sets:", e);
      }
    }

    const payload = getComponentSetsPayload(componentSets);
    emit<ComponentSetsLoadedHandler>("COMPONENT_SETS_LOADED", payload);
  });

  on<SelectComponentSetHandler>(
    "SELECT_COMPONENT_SET",
    function (id: string | null) {
      setLastComponentSetId(id);
    }
  );

  // ===================
  // Sprint Handlers
  // ===================

  on<LoadSprintsHandler>("LOAD_SPRINTS", function () {
    const payload = getSprintsPayload();
    emit<SprintsLoadedHandler>("SPRINTS_LOADED", payload);
  });

  on<CreateSprintHandler>("CREATE_SPRINT", function (name: string) {
    const id = Date.now().toString();
    const sprint: Sprint = {
      id,
      name,
      notes: [],
    };

    saveSprint(sprint);
    setLastSprintId(id); // Auto-select newly created sprint

    const payload = getSprintsPayload();
    emit<SprintsUpdatedHandler>("SPRINTS_UPDATED", payload);
  });

  on<RenameSprintHandler>(
    "RENAME_SPRINT",
    function (data: { id: string; name: string }) {
      const sprints = loadAllSprints();
      const sprint = sprints.find((s) => s.id === data.id);

      if (sprint) {
        sprint.name = data.name;
        saveSprint(sprint);
      }

      const payload = getSprintsPayload();
      emit<SprintsUpdatedHandler>("SPRINTS_UPDATED", payload);
    }
  );

  on<DeleteSprintHandler>("DELETE_SPRINT", function (id: string) {
    deleteSprint(id);

    // If deleted sprint was last selected, clear or move selection
    const lastId = getLastSprintId();
    if (lastId === id) {
      const remainingSprints = loadAllSprints();
      const newLastId =
        remainingSprints.length > 0 ? remainingSprints[0].id : null;
      setLastSprintId(newLastId);
    }

    const payload = getSprintsPayload();
    emit<SprintsUpdatedHandler>("SPRINTS_UPDATED", payload);
  });

  on<SelectSprintHandler>("SELECT_SPRINT", function (id: string | null) {
    setLastSprintId(id);
  });

  // ===================
  // Note Handlers
  // ===================

  on<AddNoteHandler>("ADD_NOTE", function (data: AddNotePayload) {
    const sprints = loadAllSprints();
    const sprint = sprints.find((s) => s.id === data.sprintId);

    if (sprint) {
      const note: ReleaseNote = {
        id: Date.now().toString(),
        description: data.description,
        tag: data.tag,
        componentSetId: data.componentSetId,
        componentSetName: data.componentSetName,
        createdAt: new Date().toISOString(),
        authorId: figma.currentUser?.id ?? "unknown",
        authorName: figma.currentUser?.name ?? "Unknown User",
      };

      sprint.notes.push(note);
      saveSprint(sprint);
    }

    const payload = getSprintsPayload();
    emit<SprintsUpdatedHandler>("SPRINTS_UPDATED", payload);
  });

  on<EditNoteHandler>("EDIT_NOTE", function (data: EditNotePayload) {
    const sprints = loadAllSprints();
    const sprint = sprints.find((s) => s.id === data.sprintId);

    if (sprint) {
      const note = sprint.notes.find((n) => n.id === data.noteId);
      if (note) {
        note.description = data.description;
        note.tag = data.tag;
        saveSprint(sprint);
      }
    }

    const payload = getSprintsPayload();
    emit<SprintsUpdatedHandler>("SPRINTS_UPDATED", payload);
  });

  on<DeleteNoteHandler>("DELETE_NOTE", function (data: DeleteNotePayload) {
    const sprints = loadAllSprints();
    const sprint = sprints.find((s) => s.id === data.sprintId);

    if (sprint) {
      sprint.notes = sprint.notes.filter((n) => n.id !== data.noteId);
      saveSprint(sprint);
    }

    const payload = getSprintsPayload();
    emit<SprintsUpdatedHandler>("SPRINTS_UPDATED", payload);
  });

  on<ViewComponentSetHandler>(
    "VIEW_COMPONENT_SET",
    function (componentSetId: string) {
      const node = figma.getNodeById(componentSetId);
      if (node && node.type === "COMPONENT_SET") {
        // Navigate to the page containing the component set
        const page = findParentPage(node);
        if (page && figma.currentPage !== page) {
          figma.currentPage = page;
        }
        // Zoom and scroll viewport to the component set
        figma.viewport.scrollAndZoomIntoView([node]);
      }
    }
  );

  on<PublishSprintReleaseNotesHandler>(
    "PUBLISH_SPRINT_RELEASE_NOTES",
    async function (sprintId: string) {
      const sprints = loadAllSprints();
      const sprint = sprints.find((s) => s.id === sprintId);

      if (!sprint || sprint.notes.length === 0) {
        emit<SprintReleaseNotesPublishedHandler>(
          "SPRINT_RELEASE_NOTES_PUBLISHED"
        );
        return;
      }

      const page = getOrCreateReleaseNotesPage();
      const frame = getOrCreateReleaseNotesFrame(page);

      const table = await buildSprintNotesTable(sprint, sprint.notes, true);

      if (frame.children.length === 0) {
        frame.appendChild(table);
      } else {
        frame.insertChild(0, table);
      }

      // Build per-component frames in the background
      const notesByComponentSet = new Map<string, ReleaseNote[]>();
      for (const note of sprint.notes) {
        const existing = notesByComponentSet.get(note.componentSetId) || [];
        existing.push(note);
        notesByComponentSet.set(note.componentSetId, existing);
      }

      for (const entry of Array.from(notesByComponentSet.entries())) {
        const componentSetId = entry[0];
        const node = figma.getNodeById(componentSetId);
        if (!node || node.type !== "COMPONENT_SET") {
          continue;
        }

        const componentSet = node as ComponentSetNode;
        const componentFrame = await buildComponentReleaseNotesFrame(
          componentSet,
          sprints
        );

        // Only position if frame was successfully created
        if (componentFrame) {
          // Position the frame to the left of the component set, aligned by top, with 100px gap
          componentFrame.x = componentSet.x - componentFrame.width - 100;
          componentFrame.y = componentSet.y;
        }
      }

      // Only navigate to the aggregated table
      figma.currentPage = page;
      figma.viewport.scrollAndZoomIntoView([frame]);

      emit<SprintReleaseNotesPublishedHandler>(
        "SPRINT_RELEASE_NOTES_PUBLISHED"
      );
    }
  );

  showUI({
    height: 600,
    width: 320,
  });
}
