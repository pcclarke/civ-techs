/**
 * Get technologies that should be highlighted when a technology is selected.
 * @param {Object[]} allTechs - All technologies with unlock relationships
 * @returns {{ highlightedIds: string[], selectionPrerequisites: Object[] }}
 */
export default function getHighlightedTechs(allTechs) {
    var { selected } = window.app;

    if (!selected) {
        return { highlightedIds: [], selectionPrerequisites: [] };
    }

    var highlightedIds = [];
    var selectionPrerequisites = [];

    for (const tech of allTechs) {
        const isCurrent = tech.id === selected.id;
        const isRequiredBySelection = tech.reqFor && tech.reqFor.find(r => r.id === selected.id);
        const isOptionalForSelection = tech.optFor && tech.optFor.find(o => o.id === selected.id);
        const requiresSelection = tech.reqTo && tech.reqTo.find(r => r.id === selected.id);
        const optionallyRequiresSelection = tech.optTo && tech.optTo.find(o => o.id === selected.id);

        const isPrerequisite = isRequiredBySelection || isOptionalForSelection;
        const isDependent = requiresSelection || optionallyRequiresSelection;

        if (isCurrent || isPrerequisite || isDependent) {
            highlightedIds.push(tech.id);
        }

        if (isPrerequisite) {
            const maxRange = Math.min(tech.range[1], selected.position);
            selectionPrerequisites.push({
                id: tech.id,
                count: tech.count,
                range: [tech.range[0], maxRange],
                step: tech.step,
                reqFor: isRequiredBySelection ? tech.reqFor : undefined,
                optFor: isOptionalForSelection ? tech.optFor : undefined
            });
        } else if (isDependent) {
            // Techs that require the selection (for spoke drawing)
            selectionPrerequisites.push({ id: tech.id });
        } else if (isCurrent) {
            // Always include the selected tech (for spoke drawing)
            selectionPrerequisites.push(tech);
        }
    }

    return { highlightedIds, selectionPrerequisites };
}
