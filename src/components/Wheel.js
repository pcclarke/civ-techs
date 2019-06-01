import React from 'react';

import {scaleOrdinal as d3_scaleOrdinal} from 'd3-scale';
import {arc as d3_arc} from 'd3-shape';
import {schemeCategory10 as d3_schemeCategory10} from 'd3-scale-chromatic';

import startSlice from '../img/startSlice.png';

function Wheel(props) {
  const {
    angleShift,
    arcBase,
    arcSpace,
    arcWidth,
    data,
    empire,
    game,
    width,
    height,
    margin,
  } = props;

  console.log(data.displayed);

  const color = d3_scaleOrdinal(d3_schemeCategory10);

  const arc = d3_arc()
    .innerRadius((d) => arcBase + (arcSpace * d.arcRank))
    .outerRadius((d) => (arcBase + arcWidth) + (arcSpace * d.arcRank))
    .startAngle((d) => -1 * d.arcBack)
    .endAngle((d) => d.arcDist);

  const unlockArc = d3_arc()
    .innerRadius((d) => arcBase + 342.5 + (14 * d.rank))
    .outerRadius((d) => (arcBase + 342.6 + arcWidth) + (14 * d.rank))
    .startAngle((d) => -1 * d.arcBack)
    .endAngle((d) => d.arcEnd);

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
                  />
                  <image
                    className='techImg'
                    height={25}
                    width={25}
                    transform={(() => (d.pos > (data.displayed.length / 2)) ?
                      `translate(10, ${(-(width / 2) + 157)}) rotate(90)` :
                      `translate(-10, ${(-(width / 2) + 182)}) rotate(270)`)()}
                    xlinkHref={`/${game}/${d.cat}/${d.id}.png`}
                  />
                  {d.unlocks.map((u, j) => (
                    <g key={`unlock-${j}`}>
                      {u.lreq &&
                        <g className={`unlock opaque ${u.ref.id}${u.pos}`}>
                          <path
                            className='unlockArc'
                            rank={u.rank}
                            fill={color(u.pos)}
                            d={unlockArc(u)}
                          />
                          {u.lreq.map((l, k) => (
                            <g
                              className='unlockSquare'
                              key={`unlock-square-${k}`}
                              transform={`rotate(${l.dist * (360 / data.displayed.length)}) translate(0, ${(-(width/2) + 145 - (14 * l.arcRank))})`}
                            >
                              <rect
                                x={-2.5}
                                y={-0.75}
                                width={5}
                                height={5}
                                fill={color(l.pos)}
                              />
                            </g>
                          ))}
                        </g>
                      }
                      <image
                        className='unlockIcon'
                        height={13}
                        transform={(() => (u.pos > (data.displayed.length / 2)) ?
                          `translate(6, ${(-(width / 2) + (142 - (14 * u.rank)))}) rotate(90)` :
                          `translate(-6, ${(-(width / 2) + (153 - (14 * u.rank)))}) rotate(270)`)()}
                        width={13}
                        xlinkHref={(() => {
                          let link;
                          if ((u.ref.cat === 'units' || u.ref.cat === 'buildings') &&
                              !(game === 'civ1' || game === 'civ2')) {
                              if (u.ref[empire]) {
                                  link = `${game}/${u.ref.cat}/${u.ref[empire].id}.png`;
                              } else {
                                  link = `${game}/${u.ref.cat}/${u.ref.CIVILIZATION_ALL.id}.png`;
                              }
                          } else {
                              link = `${game}/${u.ref.cat}/${u.ref.id}.png`;
                          }

                          return link;
                        })()}
                      />
                    </g>
                  ))}
                </g>
              ))
            }
          </g>

          <g className='reqArcs'>
            {data.displayed.map((d, i) => (
              <g
                className={`${d.id} reqGroup`}
                key={`req-arcs-${i}`}
                transform={`rotate(${d.pos * (360 / data.displayed.length) + angleShift})`}
              >
                <path
                  className='spokeArc'
                  d={arc(d)}
                  fill={color(d.pos)}
                />
                <line
                  className='spokePin'
                  x1={0}
                  y1={-(arcBase + 7 + (arcSpace * d.arcRank))}
                  x2={0}
                  y2={-(arcBase - 5 + (arcSpace * d.arcRank))}
                  strokeWidth={arcWidth}
                  stroke={color(d.pos)}
                />
                {d.lreq.map((r, j) => (
                  <g
                    className='reqSquare'
                    key={`req-square-${j}`}
                    transform={(() => {
                      const ang = r.dist * (360 / data.displayed.length);
                      return `rotate(${ang}) translate(0, ${(-arcBase - 2.5 - (arcSpace * r.arcRank))})`;
                    })()}
                  >
                    <rect
                      x={-2.5}
                      y={-0.75}
                      width={5}
                      height={5}
                      fill={color(r.pos)}
                    />
                  </g>
                ))}
                {d.lopt.map((o, j) => (
                  <g
                    className='optCircle'
                    key={`opt-circle-${j}`}
                    transform={(() => {
                      const ang = o.dist * (360 / data.displayed.length);
                      return `rotate(${ang}) translate(0, ${(-arcBase - 2.5 - (arcSpace * d.arcRank))})`;
                    })()}
                  >
                    <circle
                      cx={0}
                      cy={2}
                      r={2.5}
                      strokeWidth={1}
                      stroke={color(o.pos)}
                      fill='white'
                    />
                  </g>
                ))}
              </g>
            ))}
          </g>

          <image
            x={-75}
            y={-75}
            width={150}
            height={150}
            xlinkHref={`${game}/${game}-center.png`}
          />
        </g>
      </g>
    </svg>
  );
}

export default Wheel;
