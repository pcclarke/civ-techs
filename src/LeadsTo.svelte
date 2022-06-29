<script>
  import Arc from './Arc.svelte';
  import Relationship from './Relationship.svelte';

  import { arcSpace } from './stores.js';

  export let angleShift;
  export let arcBaseRadius;
  export let arcStrokeWidth;
  export let colour;
  export let data;
  export let fade = '';
  export let totalTechnologies;
</script>

<g
  class={`${data.id}${fade}`}
  transform={`rotate(${data.pos * (360 / totalTechnologies) + angleShift})`}
>
  <Arc
    baseRadius={100}
    className={'spokeArc'}
    colour={colour}
    data={data}
    space={$arcSpace}
    strokeWidth={arcStrokeWidth}
  />
  <line
    class='spokePin'
    x1={0}
    y1={-(arcBaseRadius + 7 + ($arcSpace * data.rank))}
    x2={0}
    y2={-(arcBaseRadius - 5 + ($arcSpace * data.rank))}
    stroke-width={arcStrokeWidth}
    stroke={colour(data.pos)}
  />
  {#each data.lreq as r, j}
    <Relationship
      baseRadius={arcBaseRadius}
      colour={colour}
      data={r}
      shape={'square'}
      space={$arcSpace}
      totalTechnologies={totalTechnologies}
    />
  {/each}
  {#each data.lopt as o, j}
    <Relationship
      baseRadius={arcBaseRadius}
      colour={colour}
      data={o}
      shape={'circle'}
      space={$arcSpace}
      totalTechnologies={totalTechnologies}
    />
  {/each}
</g>

<style>
  .fade {
    opacity: 0.05;
    transition: all 0.5s ease;
  }
</style>
