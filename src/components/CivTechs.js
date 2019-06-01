import React, {useState} from 'react';

import Wheel from './Wheel.js';
import {orderDisplayed}  from '../libs/orderDisplayed.js';
import {setupArcs} from '../libs/setupArcs.js';
import {setupData} from '../libs/setupData.js';

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

function CivTechs() {
  let empire = 'CIVILIZATION_ALL';
  const dataTypes = [
    'units',
    'buildings',
    'religions',
    'build',
    'resources',
    'projects',
    'promotions',
    'civics'
  ];

  const defaults = {
    arcBase: 100,
    arcWidth: 1.5,
    coords: [0, 0],
    width: 1200,
    height: 1200,
    angleShift: 2
  };

  const data = {
    civ1: civ1Data,
    civ2: civ2Data,
    civ3: civ3Data,
    civ3ptw: civ3PtwData,
    civ3con: civ3ConData,
    civ4: civ4Data,
    civ4war: civ4WarData,
    civ4bts: civ4BtsData,
  };

  const margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = defaults.width - margin.left - margin.right,
    height = defaults.width - margin.top - margin.bottom;

  const [game, setGame] = useState('civ4');

  const selectEmpire = (event) => {
    empire = event.target.value;
  };

  const sortedData = setupData(data[game], +(game[3]), dataTypes);
  const orderedData = orderDisplayed(sortedData, +(game[3]));
  const arcData = setupArcs(orderedData);

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
            <p>Select a Civilization Game:</p>
            <select
              id='selectGame'
              onChange={(event) => setGame(event.target.value)}
              value={game}
            >
              <option value='civ1'>Civilization</option>
              <option value='civ2'>Civilization II</option>
              <option value='civ3'>Civilization III</option>
              <option value='civ3ptw'>Civilization III: Play the World</option>
              <option value='civ3con'>Civilization III: Conquests</option>
              <option value='civ4'>Civilization IV</option>
              <option value='civ4war'>Civilization IV: Warlords</option>
              <option value='civ4bts'>Civilization IV: Beyond the Sword</option>
            </select>
          </div>
          {(+(game[3]) >= 3) &&
            <div className='selectBox' id='selectCivBox'>
              <p>Select a Civilization's Unique Units (and if available, buildings):</p>
              <select id='selectCiv' onChange={selectEmpire}>
                <option value='CIVILIZATION_ALL' defaultValue='selected'>Common Units &amp; Buildings</option>
                {arcData.civilizations.map((c, i) => (<option key={`empire-${i}`} value={c.id}>{c.name}</option>))}
              </select>
            </div>
          }
        </div>

        <div id='chart'>
          <Wheel
            angleShift={defaults.angleShift}
            arcBase={defaults.arcBase}
            arcSpace={(+(game[3]) < 4) ? 16 : 18}
            arcWidth={defaults.arcWidth}
            data={arcData}
            empire={empire}
            game={game}
            margin={margin}
            width={width}
            height={height}
          />
        </div>

        <div id='tooltip' className='hidden'>
          <div id='tipHead'>
            <img alt='tooltip' id='tipImg'></img>
            <p id='tipName'></p>
            <button id='tipCloseButton' name='reset'>X</button>
            <p id='tipKind'></p>
            <div className='clear'></div>
          </div>
          <div id='tipTraits'>
            <p id='tipCostLine' className='hidden'>Cost: <span id='tipCost'></span> <span id='tipCostType'></span></p>
          </div>
          <div id='tipReqs'>
            <p className='tipSubTitle'>Requirements</p>
            <div className='desc'>
              <p id='tipNoLine' className='hidden'>Available at game start</p>
              <p id='tipMandLine' className='hidden'>You must have: <span id='tipMand'></span></p>
              <p id='tipPlusLine' className='hidden'>plus</p>
              <p id='tipOptLine' className='hidden'>You need one of: <span id='tipOpt'></span></p>
            </div>
          </div>
          <div id='tipLeads' className='hidden'>
            <p className='tipSubTitle'>Leads to</p>
            <div className='desc'>
              <p id='tipMldLine' className='hidden'>Must have for: <span id='tipMld'></span></p>
              <p id='tipOldLine' className='hidden'>Optional for: <span id='tipOld'></span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CivTechs;
