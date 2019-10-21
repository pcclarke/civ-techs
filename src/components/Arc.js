import React from 'react';

import {arc as d3_arc} from 'd3-shape';

const strokeWidth = 1.5;

function Arc(props) {
  const {
    baseRadius,
    className,
    colour,
    data,
    space,
  } = props;

  const arc = d3_arc()
    .innerRadius((d) => baseRadius + (space * d.rank))
    .outerRadius((d) => (baseRadius + strokeWidth) + (space * d.rank))
    .startAngle((d) => -1 * d.arcBack)
    .endAngle((d) => d.arcDist);

  return (
    <path
      className={className}
      d={arc(data)}
      fill={colour(data.pos)}
    />
  );
}

export default Arc;