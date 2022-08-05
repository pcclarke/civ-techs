<script>
  import {
    getLeadsTo,
    getTechById,
    getTechPrereqs
  } from './lib/dataTools.js';
  import { setImageLink, oxfordizer } from './lib/stringTools.js';

  import { scaleOrdinal } from 'd3-scale';
  import { schemeCategory10 } from 'd3-scale-chromatic';

  import LeadsTo from './LeadsTo.svelte';
  import RequirementsModal from './RequirementsModal.svelte';
  import {
    buildArcs,
    buildRelationships,
    buildSpokes,
    setupData
} from './lib/setupData.js'; 
  import {
    arcSpace,
    empire,
    game
  } from './stores.js';

  import startSlice from './assets/img/startSlice.png';
  import Arcs from './Arcs.svelte';
  import Spokes from './Spokes.svelte';

  export let rawData;

  console.log(rawData);

  const data = setupData(rawData, $game.base);
  const relationships = buildRelationships(data);
  const arcs = buildArcs(relationships);
  const spokes = buildSpokes(arcs, data, relationships);

  let hovered = '';
  let hoverArcs = [];
  let hoverSpokes = [];
  
  $: {
    if (hovered.length > 0) {
      const hoverRelationship = relationships.find(r => r.id === hovered);
      const relatedTechs = relationships.filter(r => {
        return r.id === hovered ||
          r?.prerequisites?.find(p => p.id === hovered) ||
          hoverRelationship?.prerequisites?.find(p => p.id === r.id);
      }).map(r => r.id);

      hoverArcs = arcs.filter(a => a.leads.some(l => l.id === hovered))
        .map(a => {
          const newLeads = a.leads.filter(l => relatedTechs.includes(l.id));
          return {
            start: Math.min(...newLeads.map(l => l.pos)),
            end: Math.max(...newLeads.map(l => l.pos)),
            orbit: a.orbit,
            leads: newLeads
          };
        });
      hoverSpokes = spokes.filter(s => relatedTechs.includes(s.id))
        .map(s => {
          const relatedArcs = hoverArcs.filter(a => a.leads.some(l => l.id === s.id));
          if (relatedArcs.length > 0) {
            s.orbit = Math.min(...relatedArcs.map(l => l.orbit));
          }
          return s;
        });
    } else {
      hoverArcs = [];
      hoverSpokes = [];
    }
  };

  const angleShift = 2;
  const arcBaseRadius = 95;
  const arcStrokeWidth = 1;
  const margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1200 - margin.left - margin.right,
    height = 1200 - margin.top - margin.bottom;

  let displayModal = false;
  let modalInfo = {};

  const color = scaleOrdinal(schemeCategory10);

  function displayUnlockModal(reference, data) {
    let requirements = [];

    if (reference.requires) {
      if (typeof reference.requires === 'string') {
        requirements.push(getTechById(reference.requires, data).name);
      } else {
        reference.requires.forEach((requirementId) => {
          requirements.push(getTechById(requirementId, data).name);
        });
      }
    }

    let prepModalInfo = {
      imagePath: setImageLink(reference, $game.id, $empire.id),
      requirements: oxfordizer(requirements, 'and'),
      title: (reference.name) ? reference.name: reference[$empire.id].name,
    };

    if (reference.optional) {
      let optionals = [];
      reference.optional.forEach((optionalId) => {
        optionals.push(getTechById(optionalId, data).name);
      });
      prepModalInfo.optionals = oxfordizer(optionals, 'or');
    }

    if (reference.lreq) {
      let leadsRequirements = [];
      reference.lreq.forEach((leadsReq) => {
        leadsRequirements.push(getTechById(leadsReq.id, data).name);
      });
      prepModalInfo.leadsRequirements = oxfordizer(leadsRequirements, 'and');
    }

    if (reference.lopt) {
      let leadsOptionals = [];
      reference.lopt.forEach((leadsOpt) => {
        leadsOptionals.push(getTechById(leadsOpt.id, data).name);
      });
      prepModalInfo.leadsOptionals = oxfordizer(leadsOptionals, 'and');
    }

    modalInfo = prepModalInfo;

    displayModal = true;
  }
</script>

<svg
  width={width + margin.left + margin.right}
  height={height + margin.top + margin.bottom}
>
<g>
  <g
    class="civTechs"
    transform={`translate(${margin.left + width / 2}, ${margin.top + height / 2})`}
  >
    <circle
      id="bg-circle-1"
      r={width / 4 + 230}
      fill="#faf9f4"
    />
    <circle
      id="bg-circle-2"
      cx=0
      cy=0
      r={width / 4 + 120}
      fill="#ffffff"
    />
    <image
      id="start-slice"
      x={0}
      y={-(height/2)}
      width={167}
      height={height/2}
      href={startSlice}
    />

    {#if hoverSpokes.length > 0}
      <Spokes
        angleShift={angleShift}
        arcBaseRadius={arcBaseRadius}
        length={spokes.length}
        spokeData={hoverSpokes}
        width={width}
      />
      <Arcs
        arcData={hoverArcs}
        angleShift={angleShift}
        arcBaseRadius={arcBaseRadius}
        arcStrokeWidth={arcStrokeWidth}
        colour={color}
        techCount={spokes.length}
      />
    {/if}

    <g class={(hovered.length > 0) ? 'fade' : ''}>
      <Spokes
        angleShift={angleShift}
        arcBaseRadius={arcBaseRadius}
        length={spokes.length}
        spokeData={spokes}
        width={width}
        bind:hovered={hovered}
      />
      <Arcs
        arcData={arcs}
        angleShift={angleShift}
        arcBaseRadius={arcBaseRadius}
        arcStrokeWidth={arcStrokeWidth}
        colour={color}
        techCount={spokes.length}
      />
    </g>

    <image
      id="game-image"
      x={-75}
      y={-75}
      width={150}
      height={150}
      href={`${$game.id}/${$game.id}-center.png`}
    />
  </g>
</svg>

{#if displayModal}
  <RequirementsModal
    bind:display={displayModal}
    imagePath={modalInfo.imagePath}
    leadsRequirements={modalInfo.leadsRequirements}
    leadsOptionals={modalInfo.leadsOptionals}
    optionals={modalInfo.optionals}
    requirements={modalInfo.requirements}
    title={modalInfo.title}
  />
{/if}

<style>
  .fade {
    opacity: 0.05;
    transition: all 0.5s ease;
  }
</style>