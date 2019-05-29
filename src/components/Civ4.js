import React from 'react';

function Civ4(props) {
  const {
    width,
    height,
    margin,
  } = props;

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