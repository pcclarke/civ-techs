<script>
  import Select, { Option } from '@smui/select';

  import Instructions from './Instructions.svelte';
  import Wheel from './Wheel.svelte';

  import { games } from './constants.js';
  import {
    empire,
    empires,
    game
  } from './stores.js';

  let rawData = setGame('civ1');

  function updateGame(event) {
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
  <div class='CivTechs'>
    <div id='container'>
      <Instructions/>

      <div>
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

      <div id='chart'>
        {#await rawData}
          <p>Waiting...</p>
        {:then gotData}
          <Wheel rawData={gotData}/>
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
</style>
