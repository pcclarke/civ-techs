/**
    * Filter and modify data for unlocks by a given selected technology
    * @param {Object[]} techData
*/
export default function(techData) {
    var selected = window.app.selected;
    var related = [];

    if (!selected) return related;
    for (const tech of techData) {
        const current = tech.id == selected.id;

        const reqTo = tech.reqTo && tech.reqTo.find(r => r.id == selected.id);
        const optTo = tech.optTo && tech.optTo.find(o => o.id == selected.id);
        const reqFor = tech.reqFor && tech.reqFor.find(r => r.id == selected.id);
        const optFor = tech.optFor && tech.optFor.find(o => o.id == selected.id);

        if (current || reqTo || optTo || reqFor || optFor) {
            if (reqFor || optFor) {
                const maxRange = tech.range[1] > selected.position ?
                    selected.position : tech.range[1];
                const fixedRange = [tech.range[0], maxRange];
                const obj = {
                    id: tech.id,
                    count: tech.count,
                    range: fixedRange,
                    step: tech.step
                };
                if (reqFor) {
                    obj.reqFor = tech.reqFor;
                }
                if (optFor) {
                    obj.optFor = tech.optFor;
                }
                related.push(obj);
            } else if (reqTo || optTo) {
                related.push({
                    id: tech.id,
                    step: tech.step
                });
            } else {
              related.push(tech);
            }
        }
    }

  return related;
}
