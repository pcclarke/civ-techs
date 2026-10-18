import { json } from "d3-fetch";

import {
    ARC_BASE,
    ARC_GAP_FROM_ICONS,
    ARC_SPACE_MAX,
    TECH_IMG_WIDTH,
} from "./constants";
import { buildUnlockIndex } from "./buildUnlockIndex";
import { computeWheelLayout } from "./computeWheelLayout";
import { computeEraRanges, getEraOrdering } from "./eraData";
import { depthSortTechnologies } from "./depthSortTechnologies";
import createUnlocks from "./createUnlocks";
import { renderActiveView } from "./renderView";
import { setupSpokes } from "./setupSpokes";
import { hideTooltip, showTooltip } from "./tooltip";

// Bumped on every call so a fetch that resolves after a newer one has
// already started can tell it's stale. Nothing previously guarded against
// this: clicking a second game/expansion/tree before the first `json()`
// resolves meant whichever fetch finished last won, not whichever was
// clicked last. That was always a latent bug; the switch animation would
// make it an obviously visible one (a wheel animating into data that's
// about to be immediately clobbered), so it's fixed here.
let loadRequestId = 0;

/**
 * Load and process data for the wheel visualization.
 * Call this once on startup and when the game changes.
 */
export async function initWheelData() {
  var { game, tree } = window.app;
  var path = game + "/civdata.json";
  const requestId = ++loadRequestId;

  // A pinned advance's id — read before anything else touches it — is
  // resolved against the new dataset once it's loaded, below, so a pin
  // that still exists there survives the switch (see the animate paths in
  // makeWheel.js/makeTable.js) instead of always resetting. Read through
  // `pinned` specifically rather than `selected`: a hover-only selection
  // wouldn't realistically still be set here anyway (the mouse has to
  // leave the advance — clearing it via onNodeLeave — to reach whatever UI
  // triggered this switch), and pinning is the only way in on touch.
  const priorPinnedId = window.app.pinned ? window.app.pinned.id : null;

  // Nothing to animate from on the very first load — wheelData doesn't
  // exist yet — so only switches after that one get the transition.
  const hadPreviousData = Boolean(window.app.wheelData);

  var data = await json(path);
  if (requestId !== loadRequestId) return; // superseded by a newer switch
  // Pick the right node array for the active tree (default: technologies).
  // For pre-tree games this is just `data.technologies`; for Civ 6 it can
  // also be `data.civics`.
  var dataKey = (tree && tree.dataKey) || "technologies";
  var rawNodes = data[dataKey] || data.technologies;

  // Civ 3 stores eras as fake-tech entries (kind: "Era") inline with the
  // real techs so prereqs like "Pottery → Ancient Times" can resolve. We
  // don't render eras as nodes — they're a separate visualization layer —
  // so strip them out before anything else looks at the list.
  var nodes = rawNodes.filter((n) => n.kind !== "Era");

  // Build a canonical era-ordering map from the techs (in their authored
  // JSON order, which is chronological for every game). Pass it to the
  // sorter so techs cluster by era, then sub-sort by depth/cost. Games
  // with no era info (Civ 1, Civ 4) end up with an empty map and the sort
  // falls back to its original depth-then-cost behaviour.
  const eraIndex = getEraOrdering(nodes);
  var sortedTechs = depthSortTechnologies(nodes, eraIndex);
  var { allTechs, prerequisites } = createUnlocks(sortedTechs);
  var spokeData = setupSpokes(allTechs, prerequisites);

  // After the era-aware sort, eras are contiguous on the wheel — derive
  // each era's first/last tech index so the era ring/background can draw
  // them as wedges. We feed `sortedTechs` (not `allTechs`) because
  // createUnlocks rebuilds each tech as a new object that omits the .era
  // field; the two arrays share order and length, so positions match.
  // Empty for games without era data.
  const eraRanges = computeEraRanges(sortedTechs);

  // Pre-compute square and circle data from prerequisites
  var squareData = [];
  var circleData = [];
  for (let u of prerequisites) {
    if (u.reqFor) {
      for (let r of u.reqFor) {
        squareData.push({
          ...r,
          step: u.step,
          arcId: u.id
        });
      }
    }

    if (u.optFor) {
      for (let o of u.optFor) {
        circleData.push({
          ...o,
          step: u.step,
          arcId: u.id
        });
      }
    }
  }

  // Size the wheel to its data: measure the actual rendered label widths so
  // the largest one sits ~EDGE_PADDING from the SVG edge, then derive the
  // icon ring inward from that. Done per data load, after the SVG exists,
  // because widths depend on the live font + the specific tech names.
  // Era labels render in the interior (between the centre image and the
  // icons), so they don't influence the tech label layout.
  const { labelRadius, techImgRadius, eraLabelRadius, eraBackgroundRadius } =
      computeWheelLayout(window.app.svg.techLabels, allTechs);

  // Space the arc rings to fill the gap between ARC_BASE and the icon ring,
  // capped at ARC_SPACE_MAX so trees with few steps don't end up with absurdly
  // wide gaps. The icon ring's inner edge sits at (techImgRadius - half the
  // icon width); reserve ARC_GAP_FROM_ICONS between that edge and the
  // outermost arc. If there are no arcs (maxStep === 0) the value is unused;
  // keep the max so any future single-arc render still looks reasonable.
  let maxStep = 0;
  for (const p of prerequisites) {
      if (p.step > maxStep) maxStep = p.step;
  }
  const iconInnerEdge = techImgRadius - TECH_IMG_WIDTH / 2;
  const arcSpace = maxStep > 0
      ? Math.min(
          ARC_SPACE_MAX,
          (iconInnerEdge - ARC_BASE - ARC_GAP_FROM_ICONS) / maxStep
        )
      : ARC_SPACE_MAX;

  // Index buildings/units/improvements/etc. by which tech (or civic) gates
  // them, plus the inverse for items the tech makes obsolete. The active
  // tree's own array is excluded — tech-to-tech edges already render via
  // the existing Required/Required-for sections.
  const { unlocksByTech, obsoletesByTech } = buildUnlockIndex(data, dataKey);

  // Store processed data on window.app
  window.app.wheelData = {
      allTechs,
      prerequisites,
      spokeData,
      squareData,
      circleData,
      labelRadius,
      techImgRadius,
      eraLabelRadius,
      eraBackgroundRadius,
      eraRanges,
      arcSpace,
      unlocksByTech,
      obsoletesByTech,
  };

  // The pinned advance's *id* can be stable across games; the object never
  // is — reqTo/reqFor/position/range all belong to the outgoing dataset —
  // so what carries over is a fresh lookup in the new allTechs, not the
  // old object. No match means it's released outright: pin, selection,
  // and tooltip alike, since there's nothing correct left to show for an
  // advance that no longer exists.
  const carried = (priorPinnedId && allTechs.find((t) => t.id === priorPinnedId)) || null;
  window.app.pinned = carried;
  window.app._selected = carried;
  if (!carried) hideTooltip();

  renderActiveView({ animate: hadPreviousData });
  // After the render above, not before: the mobile sheet's positioning
  // scrolls the tapped row into view, which needs that row to already
  // exist in the DOM. Content (unlocks, requires — anything that differs
  // per game) and position both refresh here rather than leaving the
  // previous game's tooltip showing.
  if (carried) showTooltip(carried);
}
