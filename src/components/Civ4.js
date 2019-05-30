import React from 'react';

import startSlice from '../img/startSlice.png';

function Civ4(props) {
  const {
    angleShift,
    arcBase,
    arcSpace,
    data,
    game,
    width,
    height,
    margin,
  } = props;

  console.log(data.displayed);

  return (
    <svg
      width={width + margin.left + margin.right}
      height={height + margin.top + margin.bottom}
    >
      <g
        className='civTechs'
        transform={`translate(${margin.left}, ${margin.top})`}
      >
        <g
          className='wheel'
          transform={`translate(${width / 2}, ${height / 2})`}
        >
          <image
            id='startSlice'
            x={0}
            y={-(height/2)}
            width={167}
            height={height/2}
            xlinkHref={startSlice}
          />
            <g className='spokeAll'>
            {
              data.displayed.map((d, i) => (
                <g
                  className={`${d.id} spoke`}
                  key={`spoke-${i}`}
                  transform={`rotate(${d.pos * (360 / data.displayed.length) + angleShift})`}
                >
                  <line
                    className='spokeLine'
                    x1={0}
                    y1={(!d.requires && !d.optional) ? 0 : -(arcBase + (arcSpace * d.spokeRank))}
                    x2={0}
                    y2={-(width / 2) + 160 - (d.unlocks.length * 14)}
                  >
                  </line>
                  <image
                    className='techImg'
                    transform={(() => (d.pos > (data.displayed.length / 2)) ?
                      `translate(10, ${(-(width / 2) + 157)}) rotate(90)` :
                      `translate(-10, ${(-(width / 2) + 182)}) rotate(270)`)()}
                    height={25}
                    width={25}
                    xlinkHref={`/${game}/img/${d.cat}/${d.id}.png`}
                  />
                </g>
              ))
            }
          </g>
        </g>
      </g>
    </svg>
  );
}

export default Civ4;
