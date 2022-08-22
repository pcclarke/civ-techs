<script>
  import { scaleOrdinal } from 'd3-scale';
  import { schemeCategory10 } from 'd3-scale-chromatic';

  import RequirementsModal from './RequirementsModal.svelte';
  import {
    buildArcs,
    buildRelationships,
    buildSpokes
  } from './lib/setupData.js'; 
  import { empire, game } from './stores.js';

  import startSlice from './assets/img/startSlice.png';
  import Arcs from './Arcs.svelte';
  import Spokes from './Spokes.svelte';

  export let rawData;

  // Data for drawing elements
  const relationships = buildRelationships(rawData);
  const arcs = buildArcs(relationships);
  $: spokes = buildSpokes(arcs, rawData, $game, $empire, relationships);

  // Presentation values
  const angleShift = 2;
  const arcBaseRadius = 95;
  const arcStrokeWidth = 1;
  const color = scaleOrdinal(schemeCategory10);
  const margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1200 - margin.left - margin.right,
    height = 1200 - margin.top - margin.bottom;

  let displayModal = false;
  let modalInfo = {};

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
</script>

<svg
  width={width + margin.left + margin.right}
  height={height + margin.top + margin.bottom}
>
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
        bind:display={displayModal}
        bind:hovered={hovered}
        bind:modal={modalInfo}
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

<RequirementsModal
  bind:display={displayModal}
  bind:info={modalInfo}
/>

<style>
  .fade {
    opacity: 0.05;
    transition: all 0.5s ease;
  }
</style>