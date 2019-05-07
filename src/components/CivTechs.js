import React from 'react';

import arc from '../img/arc.gif';
import arcCircle from '../img/arc_circle.gif';
import arcPin from '../img/arc_pin.gif';
import arcSquare from '../img/arc_square.gif';
import largeIcon from '../img/large_icon.gif';
import smallIcon from '../img/small_icon.gif';
import spoke from '../img/spoke.gif';

import '../css/CivTechs.css';

function CivTechs() {
  return (
    <div className="CivTechs">
      <div id="container">
        <div id="intro">
            <h1 class="title">Civilization Technologies Wheel</h1>
            <div id="leftIntro" class="col">
                <h2>The Challenge of History</h2>
                <p>In the Sid Meier’s Civilization series of games, the objective is to build an empire that will stand the test of time. Advances in knowledge are represented by the technology tree, a diagram that shows the progression of advances and what things they enable for the player. For example, a tank might require the technology industrialism, which requires electricity and assembly line. This tree of relationships spans the whole of human history, from agriculture to space flight.</p>
                <p>However, representing so much history and culture in one tree has made for some very complex, albeit attractive, diagrams. The goal of this project was to make the encoding of information in the technology tree consistent, explicit, and as much as possible, condensed on to one screen. Where the trees in the other Civilization games left relationships unclear and spread out, the Technologies wheel puts it all in one place.</p>
            </div>
            <div id="rightIntro" class="col">
                <h2>How to Read the Wheel</h2>
                <p>The wheel is divided into two components, spokes and arcs:</p>
                <h3>Spokes</h3>
                <ul>
                    <li><img src={spoke} /> <p>There is one spoke for every advance in Civilization</p></li>
                    <li><img src={largeIcon} /> <p>Large icons show what advance the spoke represents</p></li>
                    <li><img src={smallIcon} /> <p>Small icons show what buildings, units, and other things an advance gives you</p></li>
                </ul>
                <h3>Arcs</h3>
                <ul>
                    <li><img src={arc} /> <p>Arcs show relationships between advances</p></li>
                    <li><img src={arcPin} /> <p>Perpendicular lines point to the spoke with the arc's origin advance</p></li>
                    <li><img src={arcSquare} /> <p>Squares on a spoke indicate that the arc's origin is required for this advance</p></li>
                    <li><img src={arcCircle} /> <p>Circles on a spoke indicate that the arc's origin is optional for this advance</p></li>
                </ul>
            </div>
        </div>

        <div id="selectOptions">
            <div class="selectBox">
                <p>Select a Civilization Game:</p>
                <select id="selectGame">
                    <option value="civ1">Civilization</option>
                    <option value="civ2">Civilization II</option>
                    <option value="civ3">Civilization III</option>
                    <option value="civ3ptw">Civilization III: Play the World</option>
                    <option value="civ3con">Civilization III: Conquests</option>
                    <option value="civ4">Civilization IV</option>
                    <option value="civ4war">Civilization IV: Warlords</option>
                    <option value="civ4bts" selected="selected">Civilization IV: Beyond the Sword</option>
                </select>
            </div>
            <div class="selectBox" id="selectCivBox">
                <p>Select a Civilization's Unique Units (and if available, buildings):</p>
                <select id="selectCiv">
                    <option value="CIVILIZATION_ALL" selected="selected">Common Units &amp; Buildings</option>
                </select>
            </div>
        </div>

        <div id="chart"></div>

        <div id="tooltip" class="hidden">
            <div id="tipHead">
                <img id="tipImg"></img>
                <p id="tipName"></p>
                <button id="tipCloseButton" name="reset">X</button>
                <p id="tipKind"></p>
                <div class="clear"></div>
            </div>
            <div id="tipTraits">
                <p id="tipCostLine" class="hidden">Cost: <span id="tipCost"></span> <span id="tipCostType"></span></p>
            </div>
            <div id="tipReqs">
                <p class="tipSubTitle">Requirements</p>
                <div class="desc">
                    <p id="tipNoLine" class="hidden">Available at game start</p>
                    <p id="tipMandLine" class="hidden">You must have: <span id="tipMand"></span></p>
                    <p id="tipPlusLine" class="hidden">plus</p>
                    <p id="tipOptLine" class="hidden">You need one of: <span id="tipOpt"></span></p>
                </div>
            </div>
            <div id="tipLeads" class="hidden">
                <p class="tipSubTitle">Leads to</p>
                <div class="desc">
                    <p id="tipMldLine" class="hidden">Must have for: <span id="tipMld"></span></p>
                    <p id="tipOldLine" class="hidden">Optional for: <span id="tipOld"></span></p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default CivTechs;
