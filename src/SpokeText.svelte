<script>
  export let iconEnd;
  export let name;
  export let leftSide;
  export let textId;

  import { onMount } from 'svelte';

  let rectWidth = 100;

	onMount(() => {
    const textElem = document.querySelector(`#${textId}-label`);
    const bbox = textElem.getBBox();
    rectWidth = bbox.width + 10;
  });
</script>

<rect
  x=-6
  y={iconEnd + 5}
  width=12
  height={rectWidth}
  fill="white"
  stroke="#808080"
  stroke-width=0.5
  rx=2
/>
<text
  id={`${textId}-label`}
  transform={(leftSide) ?
    `translate(3, ${iconEnd + 10}) rotate(-90)` :
    `translate(-3, ${iconEnd + 10}) rotate(-270)`}
  font-family="'Helvetica Neue'"
  font-size=10
  text-anchor={((leftSide) ? 'end' : 'start')}
>
  {name}
</text>