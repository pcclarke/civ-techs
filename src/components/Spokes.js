import React, {useState} from 'react';

import {setImageLink} from '../libs/stringTools.js';

import Arc from './Arc';
import Relationship from './Relationship';

function Spokes(props) {
  const {
    angleShift,
    arcBaseRadius,
    arcSpace,
    arcStrokeWidth,
    colour,
    data,
    displayUnlockModal,
    game,
    empire,
    notFaded,
    notUnlockFaded,
    setFade,
    setNotFaded,
    setUnlockFade,
    updateDataFade,
    updateUnlockFade,
    width
  } = props;

  return (
    <g className='spokes'>
      {
        data.displayed.map((d, i) => (
          <g
            className={`${d.id} spoke`}
            key={`spoke-${i}`}
            transform={`rotate(${d.pos * (360 / data.displayed.length) + angleShift})`}
          >
            <line
              className={`spokeLine ${(notFaded.length > 0) ? 'fade' : ''}`}
              x1={0}
              y1={(!d.requires && !d.optional) ? 0 : -(arcBaseRadius + (arcSpace * d.spokeRank))}
              x2={0}
              y2={-(width / 2) + 160 - (d.unlocks.length * 14)}
            />
            <image
              className={`techImg ${setFade(d)}`}
              height={25}
              onClick={() => displayUnlockModal(d, data)}
              onMouseLeave={() => setNotFaded([])}
              onMouseOver={() => updateDataFade(d)}
              transform={(() => (d.pos > (data.displayed.length / 2)) ?
                `translate(10, ${(-(width / 2) + 157)}) rotate(90)` :
                `translate(-10, ${(-(width / 2) + 182)}) rotate(270)`)()}
              width={25}
              href={`${game}/${d.cat}/${d.id}.png`}
            />
            {d.unlocks.map((u, j) => (
              <g key={`unlock-${j}`}>
                {u.lreq &&
                  <g className={`unlock ${(notUnlockFaded === u.ref.id) ? '' : 'opaque'} ${u.ref.id}${u.pos}`}>
                    <Arc
                      baseRadius={442.5}
                      className='unlockArc'
                      colour={colour}
                      data={u}
                      space={14}
                      strokeWidth={arcStrokeWidth}
                    />
                    {u.lreq.map((l, k) => (
                      <Relationship
                        baseRadius={(width/2) - 147.5}
                        colour={colour}
                        data={l}
                        key={`unlock-square-${k}`}
                        shape={'square'}
                        space={14}
                        totalTechnologies={data.displayed.length}
                      />
                    ))}
                  </g>
                }
                <image
                  className={`unlockIcon ${setFade(d)} ${setUnlockFade(u.ref.id)}`}
                  height={13}
                  onClick={() => displayUnlockModal(u.ref, data)}
                  onMouseLeave={() => updateUnlockFade()}
                  onMouseOver={() => updateUnlockFade(u.ref.id)}
                  transform={(() => (u.pos > (data.displayed.length / 2)) ?
                    `translate(6, ${(-(width / 2) + (142 - (14 * u.rank)))}) rotate(90)` :
                    `translate(-6, ${(-(width / 2) + (153 - (14 * u.rank)))}) rotate(270)`)()}
                  width={13}
                  href={(() => setImageLink(u.ref, game, empire))()}
                />
              </g>
            ))}
          </g>
        ))
      }
    </g>
  );
}

export default Spokes;