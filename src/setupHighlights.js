import getHighlightedTechs from "./createSelectedUnlocks";
import { setupSpokes } from "./setupSpokes";

export function setupHighlights(allTechs) {
    const { selected } = window.app;

    const { highlightedIds, selectionPrerequisites } = getHighlightedTechs(allTechs);

    const selectedSpokes = (selectionPrerequisites.length > 0) ?
      setupSpokes(allTechs, selectionPrerequisites, true) : [];

    const prerequisiteIds = [];
  if (selected) {
      if (selected.reqTo) {
          prerequisiteIds.push(...selected.reqTo.map(t => t.id));
      }
      if (selected.optTo) {
          prerequisiteIds.push(...selected.optTo.map(t => t.id));
      }
  }

    return {
        highlightedIds,
        selectionPrerequisites,
        selectedSpokes,
        prerequisiteIds
    };
}
