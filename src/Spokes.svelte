<script>
  import { arcSpace, spokesLoaded } from './stores.js';
  import SpokeText from './SpokeText.svelte';

  export let angleShift;
  export let arcBaseRadius;
  export let display = false;
  export let modal = {};
  export let hovered = '';
  export let length;
  export let spokeData;
  export let width;

  const iconWidth = 20;
  let loaded = 0;

  const setHover = (id) => hovered = id;
  const setModal = (info) => {
    modal = info;
    display = true;
  }

  function checkLoading() {
    ++loaded;
    if (loaded === spokeData.length) {
      spokesLoaded.set(true);
    }
  }
</script>

{#each spokeData as spoke}
  <g
    class={`${spoke.id} spoke`}
    opacity={(spoke.faded) ? 0.05 : 1}
    transform={`rotate(${spoke.pos * (360 / length) + angleShift + 180})`}
  >
    <line
      class={`spoke-line`}
      x1=0
      y1={(spoke.orbit === -1) ? 0 : ($arcSpace * spoke.orbit) + arcBaseRadius}
      x2=0
      y2={(width / 4) + ((spoke.unlocks.length > 0) ? spoke.unlocks.length * 14 + 120 : 0)}
      stroke-width=0.5
    />
    <image
      class="tech-icon"
      height={iconWidth}
      on:click={() => setModal(spoke)}
      on:focus={() => setHover(spoke.id)}
      on:load={() => checkLoading()}
      on:mouseleave={() => setHover('')}
      on:mouseover={() => setHover(spoke.id)}
      transform={(spoke.pos > (length / 2)) ?
        `translate(-10, ${(width / 4) + (iconWidth / 2)}) rotate(-90)` :
        `translate(10, ${(width / 4) - (iconWidth / 2)}) rotate(-270)`}
      width={iconWidth}
      href={spoke.imagePath}
    />
    <SpokeText
      iconEnd={(width / 4) + (iconWidth / 2)}
      leftSide={spoke.pos > (length / 2)}
      name={spoke.name}
      textId={spoke.id}
    />
    {#if spoke.unlocks}
      {#each spoke.unlocks as unlock, j}
        <image
          class="unlock-icon"
          height=13
          on:click={() => setModal(unlock)}
          transform={(spoke.pos > (length / 2)) ?
            `translate(-6, ${(width / 4) + 136.5 + (14 * j)}) rotate(-90)` :
            `translate(6, ${(width / 4) + 123.5 + (14 * j)}) rotate(-270)`}
          width={13}
          href={unlock.imagePath}
        />
      {/each}
    {/if}
  </g>
{/each}

<style>
  .spoke-line {
    stroke: #bcbec0;
    stroke-width: 0.5px;
  }
</style>