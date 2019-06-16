import React, {useState} from 'react';

import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

import Wheel from './Wheel.js';


import arc from '../img/arc.gif';
import arcCircle from '../img/arc_circle.gif';
import arcPin from '../img/arc_pin.gif';
import arcSquare from '../img/arc_square.gif';
import largeIcon from '../img/large_icon.gif';
import smallIcon from '../img/small_icon.gif';
import spoke from '../img/spoke.gif';

import '../css/CivTechs.css';

import civ1Data from '../data/civ1.json';
import civ2Data from '../data/civ2.json';
import civ3Data from '../data/civ3.json';
import civ3PtwData from '../data/civ3ptw.json';
import civ3ConData from '../data/civ3con.json';
import civ4Data from '../data/civ4.json';
import civ4WarData from '../data/civ4war.json';
import civ4BtsData from '../data/civ4bts.json';

const gameData = {
  civ1: civ1Data,
  civ2: civ2Data,
  civ3: civ3Data,
  civ3ptw: civ3PtwData,
  civ3con: civ3ConData,
  civ4: civ4Data,
  civ4war: civ4WarData,
  civ4bts: civ4BtsData,
};

function CivTechs() {
  const [game, setGame] = useState('civ4');
  const [empire, setEmpire] = useState('CIVILIZATION_ALL');

  return (
    <div className='CivTechs'>
      <div id='container'>
        <div id='intro'>
          <h1 className='title'>Civilization Technologies Wheel</h1>
          <div id='leftIntro' className='col'>
            <h2>The Challenge of History</h2>
            <p>In the Sid Meier’s Civilization series of games, the objective is to build an empire that will stand the test of time. Advances in knowledge are represented by the technology tree, a diagram that shows the progression of advances and what things they enable for the player. For example, a tank might require the technology industrialism, which requires electricity and assembly line. This tree of relationships spans the whole of human history, from agriculture to space flight.</p>
            <p>However, representing so much history and culture in one tree has made for some very complex, albeit attractive, diagrams. The goal of this project was to make the encoding of information in the technology tree consistent, explicit, and as much as possible, condensed on to one screen. Where the trees in the other Civilization games left relationships unclear and spread out, the Technologies wheel puts it all in one place.</p>
          </div>
          <div id='rightIntro' className='col'>
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
          <div className='selectBox'>
            <FormControl className='selectGame'>
              <InputLabel htmlFor='civ-game'>Game</InputLabel>
              <Select
                inputProps={{
                  name: 'game',
                  id: 'civ-game',
                }}
                onChange={(event) => setGame(event.target.value)}
                value={game}
              >
                <MenuItem value='civ1'>Civilization</MenuItem>
                <MenuItem value='civ2'>Civilization II</MenuItem>
                <MenuItem value='civ3'>Civilization III</MenuItem>
                <MenuItem value='civ3ptw'>Civilization III: Play the World</MenuItem>
                <MenuItem value='civ3con'>Civilization III: Conquests</MenuItem>
                <MenuItem value='civ4'>Civilization IV</MenuItem>
                <MenuItem value='civ4war'>Civilization IV: Warlords</MenuItem>
                <MenuItem value='civ4bts'>Civilization IV: Beyond the Sword</MenuItem>
              </Select>
            </FormControl>
          </div>
          {(+(game[3]) >= 3) &&
            <div className='selectBox' id='selectCivBox'>
              <FormControl className='selectEmpire'>
                <InputLabel htmlFor='civ-empire'>Empire</InputLabel>
                <Select
                  inputProps={{
                    name: 'empire',
                    id: 'civ-empire',
                  }}
                  onChange={(event) => setEmpire(event.target.value)}
                  value={empire}
                >
                  <MenuItem value='CIVILIZATION_ALL'>Common Units &amp; Buildings</MenuItem>
                  {gameData[game].civilizations.map((emp, i) => (
                    <MenuItem key={`empire-${i}`} value={emp.id}>{emp.name}</MenuItem>)
                  )}
                </Select>
              </FormControl>
            </div>
          }
        </div>

        <div id='chart'>
          <Wheel
            arcSpace={(+(game[3]) < 4) ? 16 : 18}
            gameData={gameData[game]}
            empire={empire}
            game={game}
          />
        </div>
      </div>
    </div>
  );
}

export default CivTechs;
