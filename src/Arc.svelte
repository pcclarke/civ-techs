<script>
  import { arc } from 'd3-shape';

  export let baseRadius;
  export let className;
  export let colour;
  export let end;
  export let orbit;
  export let space;
  export let start;
  export let strokeWidth;

  const drawArc = arc()
    .innerRadius(baseRadius + (space * orbit))
    .outerRadius((baseRadius + strokeWidth) + (space * orbit))
    .startAngle(start)
    .endAngle(end);
</script>

<path
  class={className}
  d={drawArc()}
  fill={colour(orbit)}
/>
