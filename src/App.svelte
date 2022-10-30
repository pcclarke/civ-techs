<script>
  import Select, { Option } from '@smui/select';
  import { fade } from 'svelte/transition';

  import Instructions from './Instructions.svelte';
  import Wheel from './Wheel.svelte';

  import { games } from './constants.js';
  import {
    empire,
    empires,
    game,
    spokesLoaded
  } from './stores.js';

  let rawData = setGame('civ1');

  function updateGame(event) {
    spokesLoaded.set(false);
    rawData = setGame(event.detail.value.id);
  }

  function setGame(gameId) {
    const matchedGame = games.find(g => g.id === gameId);
    game.set(matchedGame);
    return loadData(matchedGame);
  }

  async function loadData(game) {
    const response = await fetch(`./data/${game.id}.json`);
    const responseJson = await response.json();

    if (game.base >= 3) {
      const defaultEmpire = {id: 'CIVILIZATION_ALL', name: 'Default'};
      empires.set([defaultEmpire, ...responseJson.civilizations]);
      empire.set(defaultEmpire);
    } else {
      empires.set([]);
    }

    return responseJson;
  }

  function setEmpire(event) {
    empire.set(event.detail.value);
  }
</script>

<main>
  <div id="container">
    <Instructions/>

    <div id="game-selectors">
      <Select
        key={(gameOption) => `${(gameOption && gameOption.id) || ''}`}
        value={$game}
        label="Game"
        on:SMUISelect:change={updateGame}
        style="width:300px"
      >
        {#each games as gameOption (gameOption.name)}
          <Option value={gameOption}>{gameOption.name}</Option>
        {/each}
      </Select>
      {#if $empires.length > 0}
        <Select
          key={(empireOption) => `${(empireOption && empireOption.id) || ''}`}
          value={$empire}
          label="Empire"
          on:SMUISelect:change={setEmpire}
          style="width:300px"
        >
          {#each $empires as empireOption (empireOption.name)}
            <Option value={empireOption}>{empireOption.name}</Option>
          {/each}
        </Select>
      {/if}
    </div>

    <div id="chart">
      {#await rawData}
        <p id="loading-text" out:fade>Building civilization...</p>
      {:then gotData}
        <Wheel rawData={gotData}/>
        {#if !$spokesLoaded}
          <div id="overlay" out:fade></div>
        {/if}
      {:catch error}
        <p>Civilization error</p>
      {/await}
    </div>
  </div>
</main>

<style>
  #container {
    margin: 0 auto;
    width: 1200px;
  }

  #game-selectors {
    margin: 0 auto;
    width: 960px;
  }

  #chart {
    min-height: 1200px;
    position: relative;
  }

  #loading-text {
    margin: 50px 0;
    text-align: center;
  }

  #overlay {
    background: #fff9e2;
    z-index: 5000;
    width: 1200px;
    height: 1200px;
    position: absolute;
    top: 0;
  }
</style>
