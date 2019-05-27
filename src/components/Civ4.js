import React from 'react';
import {setupData} from '../libs/setupData.js';

import civ4Data from '../data/civ4.json';

function Civ4(props) {
  const {
    dataTypes,
    installment,
    width,
    height,
    margin,
  } = props;

  const orderedData = setupData(civ4Data, installment, dataTypes);

  return (
    <svg
      width={width + margin.left + margin.right}
      height={height + margin.top + margin.bottom}
    >
      <g transform={`translate(${margin.left}, ${margin.top})`}>
      </g>
    </svg>
  );
}

export default Civ4;