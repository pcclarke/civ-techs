<script>
  import { onMount } from 'svelte';

  import Instructions from './Instructions.svelte';
  import Wheel from './Wheel.svelte';

  const games = [
    {id: 'civ1', base: 1, name: 'Civilization'},
    {id: 'civ2', base: 2, name: 'Civilization II'},
    {id: 'civ3', base: 3, name: 'Civilization III'},
    {id: 'civ3ptw', base: 3, name: 'Civilization III: Play the World'},
    {id: 'civ3con', base: 3, name: 'Civilization III: Conquests'},
    {id: 'civ4', base: 4, name: 'Civilization IV'},
    {id: 'civ4war', base: 4, name: 'Civilization IV: Warlords'},
    {id: 'civ4bts', base: 4, name: 'Civilization IV: Beyond the Sword'},
  ];
  let empires = [];

  let data;

  let selectedGame = games[0];
  let selectedEmpire;
  let loadingGame = true;

  function updateGame(event) {
    setGame(event.target.value);
  }

  async function setGame(gameId) {
    loadingGame = true;
    const response = await fetch(`./data/${gameId}.json`);
    data = await response.json();
    console.log(data);
    selectedGame = games.find(g => g.id === gameId);

    if (selectedGame.base >= 3) {
      empires = [{id: 'any', name: 'Default'}, ...data.civilizations];
      selectedEmpire = empires[0];
    } else {
      empires = [];
    }

    loadingGame = false;
  }

  function setEmpire(event) {
    selectedEmpire = empires.find(e => e.id === event.target.value);
  }

  onMount(() => {
		setGame(selectedGame.id);
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
            {#each games as game}
              <option selected={game.id === selectedGame.id} value={game.id}>{game.name}</option>
            {/each}
          </select>
        </div>
        {#if !loadingGame && selectedGame.base >= 3}
          <div class='selectBox'>
            <label for="selectEmp">Empire</label>
            <select
              name="empires"
              id="selectEmp"
              on:change={setEmpire}
            >
              {#each empires as empire}
                <option selected={empire.id === selectedEmpire.id} value={empire.id}>{empire.name}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      <div id='chart'>
        {#if loadingGame}
          <p>Loading</p>
        {:else}
          <Wheel
            arcSpace={(selectedGame.base < 4) ? 16 : 18}
            gameData={data}
            empire={selectedEmpire}
            game={selectedGame}
          />
        {/if}
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
