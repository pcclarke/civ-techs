<script>
  import { onMount } from 'svelte';

  import Instructions from './Instructions.svelte';
  import Wheel from './Wheel.svelte';

  import { games } from './constants.js';
  import {
    data,
    empire,
    empires,
    game
  } from './stores.js';

  function updateGame(event) {
    setGame(event.target.value);
  }

  function setGame(gameId) {
    game.set(games.find(g => g.id === gameId));
  }

  function setEmpire(event) {
    empire.set($empires.find(e => e.id === event.target.value));
  }

  onMount(() => {
		setGame('civ1');
	});
</script>

<main>
  <link rel="stylesheet" href="node_modules/svelte-material-ui/bare.css" />

  <div class='CivTechs'>
    <div id='container'>
      <Instructions/>

      <div id='selectOptions'>
        <div class='selectBox'>
          <label for="selectGame">Game</label>
          <select
            name="games"
            id="selectGame"
            on:change={updateGame}
          >
            {#each games as gameOption}
              <option selected={gameOption.id === $game.id} value={gameOption.id}>{gameOption.name}</option>
            {/each}
          </select>
        </div>
        {#if $empires.length > 0}
          <div class='selectBox'>
            <label for="selectEmp">Empire</label>
            <select
              name="empires"
              id="selectEmp"
              on:change={setEmpire}
            >
              {#each $empires as e}
                <option selected={e.id === $empire.id} value={e.id}>{e.name}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      <div id='chart'>
        {#await $data}
          <p>Waiting...</p>
        {:then gotData}
          <Wheel gameData={gotData}/>
        {:catch error}
          <p>Oh no!</p>
        {/await}
      </div>
    </div>
  </div>
</main>

<style>
  #container {
      margin: 0 auto;
      width: 1200px;
  }

  .selectBox {
    display: inline-block;
    margin-right: 15px;
  }
</style>
