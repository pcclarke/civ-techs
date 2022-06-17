<script>
  import { onMount } from 'svelte';
  import Wheel from './Wheel.svelte';

  import arc from './assets/img/arc.gif';
  import arcCircle from './assets/img/arc_circle.gif';
  import arcPin from './assets/img/arc_pin.gif';
  import arcSquare from './assets/img/arc_square.gif';
  import largeIcon from './assets/img/large_icon.gif';
  import smallIcon from './assets/img/small_icon.gif';
  import spoke from './assets/img/spoke.gif';

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
      <div id='intro'>
        <h1 class='title'>Civilization Technologies Wheel</h1>
        <div id='leftIntro' class="col">
          <h2>The Challenge of History</h2>
          <p>In the Sid Meier’s Civilization series of games, the objective is to build an empire that will stand the test of time. Advances in knowledge are represented by the technology tree, a diagram that shows the progression of advances and what things they enable for the player. For example, a tank might require the technology industrialism, which requires electricity and assembly line. This tree of relationships spans the whole of human history, from agriculture to space flight.</p>
          <p>However, representing so much history and culture in one tree has made for some very complex, albeit attractive, diagrams. The goal of this project was to make the encoding of information in the technology tree consistent, explicit, and as much as possible, condensed on to one screen. Where the trees in the other Civilization games left relationships unclear and spread out, the Technologies wheel puts it all in one place.</p>
        </div>
        <div id='rightIntro' class="col">
          <h2>How to Read the Wheel</h2>
          <p>The wheel is divided into two components, spokes and arcs:</p>
          <h3>Spokes</h3>
          <ul>
            <li><img alt='spoke' src={spoke} /> <p>There is one spoke for every advance in Civilization</p></li>
            <li><img alt='spoke with a single icon' src={largeIcon} /> <p>Large icons show what advance the spoke represents</p></li>
            <li><img alt='spoke with one large icons and two smaller icons' src={smallIcon} /> <p>Small icons show what buildings, units, and other things an advance gives you</p></li>
          </ul>
          <h3>Arcs</h3>
          <ul>
            <li><img alt='an arc' src={arc} /> <p>Arcs show relationships between advances</p></li>
            <li><img alt='arc with a line crossing it' src={arcPin} /> <p>Perpendicular lines point to the spoke with the arc's origin advance</p></li>
            <li><img alt='arc with a square on it' src={arcSquare} /> <p>Squares on a spoke indicate that the arc's origin is required for this advance</p></li>
            <li><img alt='arc with a circle on it' src={arcCircle} /> <p>Circles on a spoke indicate that the arc's origin is optional for this advance</p></li>
          </ul>
        </div>
      </div>

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
  h1, h2 {
    font-family: "Goudy Trajan Regular";
    font-weight: normal;
  }

  h1 {
      font-size: 3em;
      text-align: center;
  }

  #container {
      margin: 0 auto;
      width: 1200px;
  }

  #intro {
    border-bottom: 1px solid #bcbec0;
    margin: 50px 0;
}

.col {
    display: inline-block;
    width: 570px;
    padding: 10px;
    vertical-align: top;
}

.col h3 {
    font-size: 1em;
    margin: 5px 0 0 0;
}

.col img {
    vertical-align: top;
}

.col ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.col ul li {
    margin-bottom: 3px;
}

.col ul li img {
    display: inline-block;
}

.col ul li p {
    display: inline-block;
    margin: 0;
    width: 400px;
}

.selectBox {
    display: inline-block;
    margin-right: 15px;
}
</style>
