<script>
  import { arc } from 'd3-shape';

  export let baseRadius;
  export let className;
  export let colour;
  export let data;
  export let space;
  export let strokeWidth;

  const drawArc = arc()
    .innerRadius((d) => baseRadius + (space * d.rank))
    .outerRadius((d) => (baseRadius + strokeWidth) + (space * d.rank))
    .startAngle((d) => -1 * d.arcBack)
    .endAngle((d) => d.arcDist);
</script>

<path
  class={className}
  d={drawArc(data)}
  fill={colour(data.pos)}
/>
