import React from 'react';

import Arc from './Arc';
import Relationship from './Relationship';

function LeadsTo(props) {
  const {
    angleShift,
    arcBaseRadius,
    arcSpace,
    arcStrokeWidth,
    colour,
    data,
    fade,
    totalTechnologies
  } = props;

  return (
    <g
      className={`${data.id}${fade}`}
      transform={`rotate(${data.pos * (360 / totalTechnologies) + angleShift})`}
    >
      <Arc
        baseRadius={100}
        className={'spokeArc'}
        colour={colour}
        data={data}
        space={arcSpace}
        strokeWidth={arcStrokeWidth}
      />
      <line
        className='spokePin'
        x1={0}
        y1={-(arcBaseRadius + 7 + (arcSpace * data.rank))}
        x2={0}
        y2={-(arcBaseRadius - 5 + (arcSpace * data.rank))}
        strokeWidth={arcStrokeWidth}
        stroke={colour(data.pos)}
      />
      {data.lreq.map((r, j) => (
        <Relationship
          baseRadius={arcBaseRadius}
          colour={colour}
          data={r}
          key={`req-square-${j}`}
          shape={'square'}
          space={arcSpace}
          totalTechnologies={totalTechnologies}
        />
      ))}
      {data.lopt.map((o, j) => (
        <Relationship
          baseRadius={arcBaseRadius}
          colour={colour}
          data={o}
          key={`opt-circle-${j}`}
          shape={'circle'}
          space={arcSpace}
          totalTechnologies={totalTechnologies}
        />
      ))}
    </g>
  );
}

export default LeadsTo;