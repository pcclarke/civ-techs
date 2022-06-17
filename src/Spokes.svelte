<script>
  import { setImageLink } from './lib/stringTools.js';

  import Arc from './Arc.svelte';
  import Relationship from './Relationship.svelte';

  export let angleShift;
  export let arcBaseRadius;
  export let arcSpace;
  export let arcStrokeWidth;
  export let colour;
  export let data;
  export let displayUnlockModal;
  export let game;
  export let empire;
  export let notFaded;
  export let notUnlockFaded;
  export let updateDataFade;
  export let updateUnlockFade;
  export let width;

  $: setFade = (d) => {
    if (notFaded.length > 0) {
      const notFadedIds = notFaded.map((n) => n.id);

      if (notFadedIds.indexOf(d.id) < 0) {
        return 'fade';
      }
    }

    return '';
  };
</script>

<g class='spokes'>
  {#each data.displayed as d, i}
    <g
      class={`${d.id} spoke`}
      transform={`rotate(${d.pos * (360 / data.displayed.length) + angleShift})`}
    >
      <line
        class={`spokeLine ${(notFaded.length > 0) ? 'fade' : ''}`}
        x1={0}
        y1={(!d.requires && !d.optional) ? 0 : -(arcBaseRadius + (arcSpace * d.spokeRank))}
        x2={0}
        y2={-(width / 2) + 160 - (d.unlocks.length * 14)}
      />
      <image
        class={`techImg ${setFade(d)}`}
        height={25}
        on:click={() => displayUnlockModal(d, data)}
        on:mouseleave={() => notFaded = []}
        on:mouseover={() => updateDataFade(d)}
        transform={(() => (d.pos > (data.displayed.length / 2)) ?
          `translate(10, ${(-(width / 2) + 157)}) rotate(90)` :
          `translate(-10, ${(-(width / 2) + 182)}) rotate(270)`)()}
        width={25}
        href={`${game}/${d.cat}/${d.id}.png`}
      />
      {#each d.unlocks as u}
        <g>
          {#if u.lreq}
            <g class={`unlock${(notUnlockFaded === u.ref.id) ? '' : ' opaque'} ${u.ref.id}${u.pos}`}>
              <Arc
                baseRadius={442.5}
                className='unlockArc'
                colour={colour}
                data={u}
                space={14}
                strokeWidth={arcStrokeWidth}
              />
              {#each u.lreq as l, k}
                <Relationship
                  baseRadius={(width/2) - 147.5}
                  colour={colour}
                  data={l}
                  shape={'square'}
                  space={14}
                  totalTechnologies={data.displayed.length}
                />
              {/each}
            </g>
          {/if}
          <image
            class={`unlockIcon ${setFade(d)}${(notUnlockFaded === null || u.ref.id === notUnlockFaded) ? '' : ' fade'}`}
            height={13}
            on:click={() => displayUnlockModal(u.ref, data)}
            on:mouseleave={() => updateUnlockFade(null)}
            on:mouseover={() => updateUnlockFade(u.ref.id)}
            transform={(() => (u.pos > (data.displayed.length / 2)) ?
              `translate(6, ${(-(width / 2) + (142 - (14 * u.rank)))}) rotate(90)` :
              `translate(-6, ${(-(width / 2) + (153 - (14 * u.rank)))}) rotate(270)`)()}
            width={13}
            href={(() => setImageLink(u.ref, game, empire))()}
          />
        </g>
      {/each}
    </g>
  {/each}
</g>

<style>
  .fade {
    opacity: 0.05;
    transition: all 0.5s ease;
  }

  .opaque {
    opacity: 0;
    transition: all 0.5s ease;
  }

  .spokeLine {
    stroke: #bcbec0;
    stroke-width: 0.5px;
  }
</style>