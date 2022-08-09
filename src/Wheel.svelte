<script>
  import { getTechById } from './lib/dataTools.js';
  import { setImageLink, oxfordizer } from './lib/stringTools.js';

  import { scaleOrdinal } from 'd3-scale';
  import { schemeCategory10 } from 'd3-scale-chromatic';

  import RequirementsModal from './RequirementsModal.svelte';
  import {
    buildArcs,
    buildRelationships,
    buildSpokes,
    setupData
  } from './lib/setupData.js'; 
  import { empire, game } from './stores.js';

  import startSlice from './assets/img/startSlice.png';
  import Arcs from './Arcs.svelte';
  import Spokes from './Spokes.svelte';

  export let rawData;

  // Data for drawing elements
  const relationships = buildRelationships(rawData);
  const arcs = buildArcs(relationships);
  $: spokes = buildSpokes(arcs, rawData, $empire, relationships);

  // Presentation values
  const angleShift = 2;
  const arcBaseRadius = 95;
  const arcStrokeWidth = 1;
  const color = scaleOrdinal(schemeCategory10);
  const margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1200 - margin.left - margin.right,
    height = 1200 - margin.top - margin.bottom;

  // Fade out/in on hover setup
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

  let displayModal = {};
  let modalInfo = {};

  $: modalInfo = (() => {
    if (displayModal.id) {
      let modalSetup = {};

      const modalRelationship = relationships.find(r => r.id === displayModal.id);

      if (modalRelationship.prerequisites) {
        const prerequisites = modalRelationship.prerequisites
          .map(p => {
            return {
              name: relationships.find(r => r.id === p.id).name,
              type: p.type
            };
          });

        modalSetup.requirements = oxfordizer(
          prerequisites.filter(p => p.type === 'requires').map(p => p.name),
        'and');

        const optionals = prerequisites.filter(p => p.type === 'optional');
        if (optionals.length > 0) {
          modalSetup.optionals = oxfordizer(optionals.map(o => o.name), 'and');
        }
      }

      modalSetup.imagePath = setImageLink(displayModal, $game.id);

      modalSetup.title = (displayModal.name) ? displayModal.name : displayModal[$empire.id].name;

      const leadsTechs = relationships.filter(r => {
        return r?.prerequisites?.find(p => p.id === displayModal.id);
      }).map(r => {
        const rel = r.prerequisites.find(p => p.id === displayModal.id);

        return {
          name: r.name,
          type: rel.type
        };
      });

      const leadsRequired = leadsTechs.filter(t => t.type === 'requires');
      if (leadsRequired.length > 0) {
        modalSetup.leadsRequirements = oxfordizer(leadsRequired.map(l => l.name), 'and');
      }

      const leadsOptional = leadsTechs.filter(t => t.type === 'optional');
      if (leadsOptional.length > 0) {
        modalSetup.leadsOptionals = oxfordizer(leadsOptional.map(l => l.name), 'and');
      }

      return modalSetup;
    } else {
      return {};
    }
  })();
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
        bind:modal={displayModal}
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

{#if Object.keys(modalInfo).length > 0}
  <RequirementsModal
    info={modalInfo}
    bind:display={displayModal}
  />
{/if}

<style>
  .fade {
    opacity: 0.05;
    transition: all 0.5s ease;
  }
</style>