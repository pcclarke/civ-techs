import React, {useState} from 'react';

import {arc as d3_arc} from 'd3-shape';

const arcBaseRadius = 100;
const arcStrokeWidth = 1.5;

function Arc(props) {
  const {
    arcSpace,
    classed,
    colour,
    data
  } = props;

  const arc = d3_arc()
    .innerRadius((d) => arcBaseRadius + (arcSpace * d.arcRank))
    .outerRadius((d) => (arcBaseRadius + arcStrokeWidth) + (arcSpace * d.arcRank))
    .startAngle((d) => -1 * d.arcBack)
    .endAngle((d) => d.arcDist);

  return (
    <path
      className={classed}
      d={arc(data)}
      fill={colour(data.pos)}
    />
  );
}

export default Arc;