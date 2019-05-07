import React from 'react';
import ReactDOM from 'react-dom';
import CivTechs from '../components/CivTechs';

it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<CivTechs />, div);
  ReactDOM.unmountComponentAtNode(div);
});
