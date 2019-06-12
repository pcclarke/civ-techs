import React, {useState} from 'react';

import {
  getLeadsTo,
  getTechById,
  getTechPrereqs
} from '../libs/dataTools.js';

import {scaleOrdinal as d3_scaleOrdinal} from 'd3-scale';
import {arc as d3_arc} from 'd3-shape';
import {schemeCategory10 as d3_schemeCategory10} from 'd3-scale-chromatic';

import RequirementsModal from './RequirementsModal.js';

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

  const [notFaded, setNotFaded] = useState([]);
  const [tempArcs, setTempArcs] = useState([]);
  const [notUnlockFaded, setNotUnlockFaded] = useState(null);
  const [displayModal, setDisplayModal] = React.useState(false);
  const [modalInfo, setModalInfo] = React.useState({});

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

  const updateDataFade = (d) => {
    let minRank = 50;
    let updateNotFaded = getTechPrereqs(d, data);

    let updateTempArcs = updateNotFaded.map((n) => {
      let tempDist;
      let tempBack;
      if (d.pos > n.pos) {
        tempDist = (d.pos - n.pos) * ((2 * Math.PI) / data.displayed.length);
        tempBack = 0;
      } else if (d.pos < n.pos) {
        tempDist = 0;
        tempBack = (d.pos - n.pos) * ((2 * Math.PI) / data.displayed.length);
      } else if (d.pos === n.pos) {
        tempDist = n.arcDist;
        tempBack = n.arcBack;
      }

      let lopt = [];
      if (n.id === d.id) {
        lopt = d.lopt;
      } else {
        n.lopt.forEach((o) => {
          if (o.id === d.id) {
            lopt.push(o);
          }
        });
      }

      let lreq = [];
      if (n.id === d.id) {
        lreq = d.lreq;
      } else {
        n.lreq.forEach((r) => {
          if (r.id === d.id) {
            lreq.push(r);
          }
        });
      }

      let spokeRank = 50;

      if (d.pos === n.pos) {
        spokeRank = minRank;
      } else {
        lopt.forEach((o) => {
          if (o.arcRank < spokeRank) {
            spokeRank = o.arcRank;
          }
        });
        lreq.forEach((r) => {
          if (r.arcRank < spokeRank) {
            spokeRank = r.arcRank;
          }
        });
      }
      if (spokeRank < minRank) {
        minRank = spokeRank;
      }

      return {
        arcBack: tempBack,
        arcDist: tempDist,
        arcRank: n.arcRank,
        id: n.id,
        lopt: lopt,
        lreq: lreq,
        pos: n.pos,
        spokeRank: spokeRank,
        unlocks: n.unlocks,
      };
    });
    updateNotFaded = updateNotFaded.concat(d);
    updateNotFaded = updateNotFaded.concat(getLeadsTo(d, data.displayed));

    updateTempArcs.push(d);
    getLeadsTo(d, data.displayed).forEach((l) => {
      updateTempArcs.push({
        arcBack: 0,
        arcDist: 0,
        arcRank: 0,
        id: l.id,
        lopt: [],
        lreq: [],
        pos: l.pos,
        spokeRank: d.arcRank,
        unlocks: l.unlocks,
      });
    });

    setNotFaded(updateNotFaded);
    setTempArcs(updateTempArcs);
  };

  const setFade = (d) => {
    if (notFaded.length > 0) {
      const notFadedIds = notFaded.map((n) => n.id);

      if (notFadedIds.indexOf(d.id) < 0) {
        return 'fade';
      }
    }

    return '';
  }

  const updateUnlockFade = (u) => {
    if (u) {
      setNotUnlockFaded(u);
    } else {
      setNotUnlockFaded(null);
    }
  }

  const setUnlockFade = (u) => {
    if (notUnlockFaded) {
      return (u === notUnlockFaded) ? '' : 'fade';
    }
  }

  function displayUnlockModal(unlock, data) {
    console.log(data);
    let requirements = [];
    unlock.ref.requires.forEach((u) => {
      requirements.push(getTechById(u, data).name);
    });

    console.log(requirements);
    console.log(unlock);

    if (unlock.ref.name) {
      setModalInfo({
        requirements: requirements.join(', '),
        title: unlock.ref.name,

      });
    } else {
      setModalInfo({
        requirements: requirements.join(', '),
        title: unlock.ref[empire].name,
      });
    }

    setDisplayModal(true);
    console.log(modalInfo);
  }

  return (
    <div>
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
            {(notFaded.length > 0 && tempArcs.length > 0) &&
              <g className='tempArcs'>
                {tempArcs.map((t, i) => (
                  <g
                    className='temp-spokes'
                    key={`temp-spokes-${i}`}
                    transform={`rotate(${t.pos * (360 / data.displayed.length) + angleShift})`}
                  >
                    <line
                      className='spokeLine'
                      x1={0}
                      y1={-(arcBase + (arcSpace * t.spokeRank))}
                      x2={0}
                      y2={-(width / 2) + 160 - (t.unlocks.length * 14)}
                    />
                  </g>
                ))}
                {tempArcs.filter((t) => t.lopt.length > 0 || t.lreq.length > 0).map((t, i) => (
                  <g
                    className='tempGroup'
                    key={`temp-arcs-${i}`}
                    transform={`rotate(${t.pos * (360 / data.displayed.length) + angleShift})`}
                  >
                    <path
                      className='tempArc'
                      d={arc(t)}
                      fill={color(t.pos)}
                    />
                    <line
                      className='tempSpokePin'
                      x1={0}
                      y1={-(arcBase + 7 + (arcSpace * t.arcRank))}
                      x2={0}
                      y2={-(arcBase - 5 + (arcSpace * t.arcRank))}
                      strokeWidth={arcWidth}
                      stroke={color(t.pos)}
                    />
                   {t.lreq.map((r, j) => (
                      <g
                        className='tempReqSquare'
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
                    {t.lopt.map((o, j) => (
                      <g
                        className='optCircle'
                        key={`opt-circle-${j}`}
                        transform={(() => {
                          const ang = o.dist * (360 / data.displayed.length);
                          return `rotate(${ang}) translate(0, ${(-arcBase - 2.5 - (arcSpace * o.arcRank))})`;
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
            }

            <g className='spokeAll'>
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
                      y1={(!d.requires && !d.optional) ? 0 : -(arcBase + (arcSpace * d.spokeRank))}
                      x2={0}
                      y2={-(width / 2) + 160 - (d.unlocks.length * 14)}
                    />
                    <image
                      className={`techImg ${setFade(d)}`}
                      height={25}
                      onMouseLeave={() => setNotFaded([])}
                      onMouseOver={() => updateDataFade(d)}
                      transform={(() => (d.pos > (data.displayed.length / 2)) ?
                        `translate(10, ${(-(width / 2) + 157)}) rotate(90)` :
                        `translate(-10, ${(-(width / 2) + 182)}) rotate(270)`)()}
                      width={25}
                      xlinkHref={`/${game}/${d.cat}/${d.id}.png`}
                    />
                    {d.unlocks.map((u, j) => (
                      <g key={`unlock-${j}`}>
                        {u.lreq &&
                          <g className={`unlock ${(notUnlockFaded === u.ref.id) ? '' : 'opaque'} ${u.ref.id}${u.pos}`}>
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
                          className={`unlockIcon ${setFade(d)} ${setUnlockFade(u.ref.id)}`}
                          height={13}
                          onClick={() => displayUnlockModal(u, data)}
                          onMouseLeave={() => updateUnlockFade()}
                          onMouseOver={() => updateUnlockFade(u.ref.id)}
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
                  className={`${d.id} reqGroup ${(notFaded.length > 0) ? 'fade' : ''}`}
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
                        if (d.id === 'TECH_FISHING') {
                        }
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
                        return `rotate(${ang}) translate(0, ${(-arcBase - 2.5 - (arcSpace * o.arcRank))})`;
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

      <RequirementsModal
        close={() => setDisplayModal(false)}
        display={displayModal}
        requirements={modalInfo.requirements}
        title={modalInfo.title}
      />
    </div>
  );
}

export default Wheel;
