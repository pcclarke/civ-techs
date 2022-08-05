<script>
  import Arc from './Arc.svelte';
  import { arcSpace } from './stores.js';

  export let arcData;
  export let angleShift;
  export let arcBaseRadius;
  export let arcStrokeWidth;
  export let colour;
  export let techCount;

  const radShift = angleShift * (Math.PI / 180);
</script>

{#each arcData as arc}
  <Arc
    baseRadius={arcBaseRadius}
    className={'tech-arc'}
    colour={colour}
    end={((2 * Math.PI) / techCount) * arc.end + radShift}
    orbit={arc.orbit}
    space={$arcSpace}
    start={((2 * Math.PI) / techCount) * arc.start + radShift}
    strokeWidth={arcStrokeWidth}
  />
  {#each arc.leads as relationship}
    {#if relationship.type === "origin"}
      <g transform={`rotate(${relationship.pos * (360 / techCount) + angleShift})`}>
        <line
          class="arc-origin"
          x1=0
          y1={-(arcBaseRadius + 5 + ($arcSpace * arc.orbit))}
          x2=0
          y2={-(arcBaseRadius - 3 + ($arcSpace * arc.orbit))}
          stroke-width={arcStrokeWidth}
          stroke={colour(arc.orbit)}
        />
      </g>
    {:else if relationship.type === "requires"}
      <g transform={`rotate(${relationship.pos * (360 / techCount) + angleShift})`}>
        <rect
          x=-2
          y={-(arcBaseRadius + 2.5 + ($arcSpace * arc.orbit))}
          width=4
          height=4
          fill={colour(arc.orbit)}
        />
      </g>
    {:else if relationship.type === "optional"}
      <g transform={`rotate(${relationship.pos * (360 / techCount) + angleShift})`}>
        <circle
          cx=0
          cy={-(arcBaseRadius + 0.5 + ($arcSpace * arc.orbit))}
          r=2
          stroke-width={1}
          stroke={colour(arc.orbit)}
          fill="white"
        />
      </g>
    {/if}
  {/each}
{/each}