<script>
  import { arcSpace, game } from './stores.js';
  import { setImageLink } from './lib/stringTools.js';
  import SpokeText from './SpokeText.svelte';

  export let angleShift;
  export let arcBaseRadius;
  export let modal = {};
  export let hovered = '';
  export let length;
  export let spokeData;
  export let width;

  const iconWidth = 20;

  const setHover = (id) => hovered = id;
  const setModal = (spoke) => {
    if (Object.keys(modal).length === 0) {
      const {
        id,
        name
      } = spoke;

      modal = {
        cat: 'technologies',
        id: id,
        name: name
      };
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
      on:mouseleave={() => setHover('')}
      on:mouseover={() => setHover(spoke.id)}
      transform={(spoke.pos > (length / 2)) ?
        `translate(-10, ${(width / 4) + (iconWidth / 2)}) rotate(-90)` :
        `translate(10, ${(width / 4) - (iconWidth / 2)}) rotate(-270)`}
      width={iconWidth}
      href={`${$game.id}/technologies/${spoke.id}.png`}
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
          transform={(spoke.pos > (length / 2)) ?
            `translate(-6, ${(width / 4) + 136.5 + (14 * j)}) rotate(-90)` :
            `translate(6, ${(width / 4) + 123.5 + (14 * j)}) rotate(-270)`}
          width={13}
          href={(() => setImageLink(unlock, $game.id))()}
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