import React, {useState} from 'react';

import {makeStyles} from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Modal from '@material-ui/core/Modal';

function rand() {
  return Math.round(Math.random() * 20) - 10;
}

function getModalStyle() {
  const top = 50 + rand();
  const left = 50 + rand();

  return {
    top: `${top}%`,
    left: `${left}%`,
    transform: `translate(-${top}%, -${left}%)`,
  };
}

const useStyles = makeStyles((theme) => ({
  paper: {
    position: 'absolute',
    width: 400,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing(4),
    outline: 'none',
  },
}));

function RequirementsModal(props) {
  const {
    close,
    display,
    imagePath,
    leadsRequirements,
    leadsOptionals,
    optionals,
    requirements,
    title,
  } = props;

  const [modalStyle] = useState(getModalStyle);

  const classes = useStyles();

  return (
    <Modal
      aria-labelledby='simple-modal-title'
      aria-describedby='simple-modal-description'
      open={display}
      onClose={close}
    >
      <div style={modalStyle} className={classes.paper}>
        <img alt={`${title}`} src={`/${imagePath}`} />
        <Typography variant='h5' id='modal-title'>
          {title}
        </Typography>
        {requirements &&
          <div>
            <Typography variant='h6' id='modal-heading'>
              Requirements
            </Typography>
            <Typography variant='subtitle1' id='details-modal-requirements'>
              You must have: {requirements}
            </Typography>
          </div>
        }
        {optionals &&
          <div>
            <p id='tipPlusLine'>plus</p>
            <Typography variant='subtitle1' id='details-modal-optionals'>
              You need one of: {optionals}
            </Typography>
          </div>
        }
        {(leadsRequirements || leadsOptionals) &&
          <Typography variant='h6' id='modal-heading'>
            Leads to
          </Typography>
        }
        {leadsRequirements &&
          <Typography variant='subtitle1' id='details-modal-leads-requires'>
            Must have for: {leadsRequirements}
          </Typography>
        }
        {leadsOptionals &&
          <Typography variant='subtitle1' id='details-modal-leads-optionals'>
            Optional for: {leadsOptionals}
          </Typography>
        }
      </div>
    </Modal>
  );
}

export default RequirementsModal;
