<script>
  import {
    getLeadsTo,
    getTechById,
    getTechPrereqs
  } from './lib/dataTools.js';
  import {setupData} from './lib/setupData.js';
  import { setImageLink, oxfordizer } from './lib/stringTools.js';

  import { scaleOrdinal } from 'd3-scale';
  import { schemeCategory10 } from 'd3-scale-chromatic';

  import LeadsTo from './LeadsTo.svelte';
  import RequirementsModal from './RequirementsModal.svelte';
  import Spokes from './Spokes.svelte';

  import startSlice from './assets/img/startSlice.png';

  export let arcSpace;
  export let gameData;
  export let empire;
  export let game;

  const angleShift = 2;
  const arcBaseRadius = 100;
  const arcStrokeWidth = 1.5;
  const margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1200 - margin.left - margin.right,
    height = 1200 - margin.top - margin.bottom;

  let nonTechnologies = {};
  for (let category in gameData) {
    if (category !== 'technologies') {
      gameData[category].forEach((reference) => {
        nonTechnologies[reference.id] = reference;
      });
    }
  }

  const dataTypes = [
    'units',
    'buildings',
    'religions',
    'build',
    'resources',
    'projects',
    'promotions',
    'civics',
  ];

  const data = setupData(gameData, nonTechnologies, game.base, dataTypes);

  console.log(data);

  let notFaded = [];
  let tempArcs = [];
  let notUnlockFaded = null;
  let displayModal = false;
  let modalInfo = {};

  const color = scaleOrdinal(schemeCategory10);

  const updateDataFade = (d) => {
    let minRank = 50;
    let updateNotFaded = getTechPrereqs(d, data);

    let updateTempArcs = updateNotFaded.map((n) => {
      let tempDist;
      let tempBack;
      if (d.pos > n.pos) {
        tempDist = (d.pos - n.pos) * ((2 * Math.PI) / data.displayed.length);
        tempBack = 0;
      } else if (d.pos < n.pos) {
        tempDist = 0;
        tempBack = (d.pos - n.pos) * ((2 * Math.PI) / data.displayed.length);
      } else if (d.pos === n.pos) {
        tempDist = n.arcDist;
        tempBack = n.arcBack;
      }

      let lopt = [];
      if (n.id === d.id) {
        lopt = d.lopt;
      } else {
        n.lopt.forEach((o) => {
          if (o.id === d.id) {
            lopt.push(o);
          }
        });
      }

      let lreq = [];
      if (n.id === d.id) {
        lreq = d.lreq;
      } else {
        n.lreq.forEach((r) => {
          if (r.id === d.id) {
            lreq.push(r);
          }
        });
      }

      let spokeRank = 50;

      if (d.pos === n.pos) {
        spokeRank = minRank;
      } else {
        lopt.forEach((o) => {
          if (o.rank < spokeRank) {
            spokeRank = o.rank;
          }
        });
        lreq.forEach((r) => {
          if (r.rank < spokeRank) {
            spokeRank = r.rank;
          }
        });
      }
      if (spokeRank < minRank) {
        minRank = spokeRank;
      }

      return {
        arcBack: tempBack,
        arcDist: tempDist,
        rank: n.rank,
        id: n.id,
        lopt: lopt,
        lreq: lreq,
        pos: n.pos,
        spokeRank: spokeRank,
        unlocks: n.unlocks,
      };
    });
    updateNotFaded = updateNotFaded.concat(d);
    updateNotFaded = updateNotFaded.concat(getLeadsTo(d, data.displayed));

    updateTempArcs.push(d);
    getLeadsTo(d, data.displayed).forEach((l) => {
      updateTempArcs.push({
        arcBack: 0,
        arcDist: 0,
        rank: 0,
        id: l.id,
        lopt: [],
        lreq: [],
        pos: l.pos,
        spokeRank: d.rank,
        unlocks: l.unlocks,
      });
    });

    notFaded = updateNotFaded;
    tempArcs = updateTempArcs;
  };

  const updateUnlockFade = (u) => {
    notUnlockFaded = (u) ? u : null;
  }

  function displayUnlockModal(reference, data) {
    let requirements = [];
    console.log(reference);
    if (reference.requires) {
      reference.requires.forEach((requirementId) => {
        requirements.push(getTechById(requirementId, data).name);
      });
    }

    let prepModalInfo = {
      imagePath: setImageLink(reference, game.id, empire),
      requirements: oxfordizer(requirements, 'and'),
      title: (reference.name) ? reference.name: reference[empire].name,
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
    console.log(displayModal);
  }
</script>

<svg
  width={width + margin.left + margin.right}
  height={height + margin.top + margin.bottom}
>
  <g
    class="civTechs"
    transform={`translate(${margin.left + width / 2}, ${margin.top + height / 2})`}
  >
    <image
      id="startSlice"
      x={0}
      y={-(height/2)}
      width={167}
      height={height/2}
      href={startSlice}
    />

  {#if notFaded.length > 0 && tempArcs.length > 0}
    <g class='tempArcs'>
      {#each tempArcs as tempArc}
        <g
          class='temp-spokes'
          transform={`rotate(${tempArc.pos * (360 / data.displayed.length) + angleShift})`}
        >
          <line
            class='spokeLine'
            x1={0}
            y1={-(arcBaseRadius + (arcSpace * tempArc.spokeRank))}
            x2={0}
            y2={-(width / 2) + 160 - (tempArc.unlocks.length * 14)}
          />
        </g>
      {/each}
      {#each tempArcs.filter((t) => t.lopt.length > 0 || t.lreq.length > 0) as tempArc}
        <LeadsTo
          angleShift={angleShift}
          arcBaseRadius={arcBaseRadius}
          arcSpace={arcSpace}
          arcStrokeWidth={arcStrokeWidth}
          colour={color}
          data={tempArc}
          totalTechnologies={data.displayed.length}
        />
      {/each}
    </g>
  {/if}

    <Spokes
      angleShift={angleShift}
      arcBaseRadius={arcBaseRadius}
      arcSpace={arcSpace}
      arcStrokeWidth={arcStrokeWidth}
      colour={color}
      data={data}
      displayUnlockModal={displayUnlockModal}
      game={game.id}
      empire={empire}
      bind:notFaded={notFaded}
      notUnlockFaded={notUnlockFaded}
      updateDataFade={updateDataFade}
      updateUnlockFade={updateUnlockFade}
      width={width}
    />



    <g class='reqArcs'>
      {#each data.displayed as d}
        <LeadsTo
          angleShift={angleShift}
          arcBaseRadius={arcBaseRadius}
          arcSpace={arcSpace}
          arcStrokeWidth={arcStrokeWidth}
          colour={color}
          data={d}
          fade={` ${(notFaded.length > 0) ? 'fade' : ''}`}
          totalTechnologies={data.displayed.length}
        />
      {/each}
    </g>

    <image
      x={-75}
      y={-75}
      width={150}
      height={150}
      href={`${game.id}/${game.id}-center.png`}
    />
  </g>
</svg>

<RequirementsModal
  bind:display={displayModal}
  imagePath={modalInfo.imagePath}
  leadsRequirements={modalInfo.leadsRequirements}
  leadsOptionals={modalInfo.leadsOptionals}
  optionals={modalInfo.optionals}
  requirements={modalInfo.requirements}
  title={modalInfo.title}
/>

<style>
  .spokeLine {
    stroke: #bcbec0;
    stroke-width: 0.5px;
  }
</style>