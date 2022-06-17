<script>
  export let baseRadius;
  export let colour;
  export let data;
  export let shape;
  export let space;
  export let totalTechnologies;
</script>

<g
  class='relationship'
  transform={(() => {
    const ang = data.dist * (360 / totalTechnologies);
    return `rotate(${ang}) translate(0, ${(-baseRadius - 2.5 - (space * data.rank))})`;
  })()}
>
  {#if shape === 'circle'}
    <circle
      cx={0}
      cy={2}
      r={2.5}
      stroke-width={1}
      stroke={colour(data.pos)}
      fill='white'
    />
  {:else if shape === 'square'}
    <rect
      x={-2.5}
      y={-0.75}
      width={5}
      height={5}
      fill={colour(data.pos)}
    />
  {/if}
</g>
