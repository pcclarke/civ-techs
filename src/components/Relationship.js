import React from 'react';

function Relationship(props) {
  const {
    baseRadius,
    colour,
    data,
    shape,
    space,
    totalTechnologies
  } = props;

  return (
    <g
      className='relationship'
      transform={(() => {
        const ang = data.dist * (360 / totalTechnologies);
        return `rotate(${ang}) translate(0, ${(-baseRadius - 2.5 - (space * data.rank))})`;
      })()}
    >
      {shape === 'circle' &&
        <circle
          cx={0}
          cy={2}
          r={2.5}
          strokeWidth={1}
          stroke={colour(data.pos)}
          fill='white'
        />
      }
      {shape === 'square' &&
        <rect
          x={-2.5}
          y={-0.75}
          width={5}
          height={5}
          fill={colour(data.pos)}
        />
      }
    </g>
  );
}

export default Relationship;