import express from 'express';
import { Outcome } from '../models/outcome.model';
import { Patient, PatientForPhoneNumber } from '../models/patient.model';
import auth from '../middleware/auth';
import errorHandler from './error';
import { Message } from '../models/message.model';

const { ObjectId } = require('mongoose').Types;

const router = express.Router();

router.post('/add', auth, async (req, res) => {
  // validate phone number
  if (
    !req.body.phoneNumber ||
    req.body.phoneNumber.match(/\d/g) == null ||
    req.body.phoneNumber.match(/\d/g).length !== 10
  ) {
    return res.status(400).json({
      msg: 'Unable to add patient: invalid phone number',
    });
  }

  if (await PatientForPhoneNumber(req.body.phoneNumber)) {
    return res.status(400).json({
      msg: 'Unable to add patient: patient already exists for given phone number',
    });
  }

  if (req.body.firstName === '') {
    return res.status(400).json({
      msg: 'Unable to add patient: must include first name',
    });
  }

  if (req.body.lastName === '') {
    return res.status(400).json({
      msg: 'Unable to add patient: must include last name',
    });
  }

  if (req.body.language === '') {
    return res.status(400).json({
      msg: 'Unable to add patient: must include language',
    });
  }

  if (!req.body.coachId || req.body.coachId === '') {
    return res.status(400).json({
      msg: 'Unable to add patient: select a coach from the dropdown',
    });
  }

  // Time parsing
  const splitTime = req.body.msgTime.split(':');
  if (splitTime.length !== 2) {
    return res.status(400).json({
      msg: 'Unable to add patient: invalid message time',
    });
  }

  const hours = Number(splitTime[0]);
  const mins = Number(splitTime[1]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(mins) ||
    hours < 0 ||
    hours >= 24 ||
    mins >= 60 ||
    mins < 0
  ) {
    return res.status(400).json({
      msg: 'Unable to add patient: invalid message time',
    });
  }

  const newPatient = new Patient({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    language: req.body.language,
    phoneNumber: req.body.phoneNumber,
    reports: [],
    responseCount: 0,
    messagesSent: 0,
    coachID: req.body.coachId,
    coachName: req.body.coachName,
    enabled: req.body.isEnabled,
    prefTime: hours * 60 + mins,
  });
  return newPatient.save().then(() => {
    res.status(200).json({
      success: true,
    });
  });
});

router.put('/increaseResponseCount/:id', auth, (req, res) => {
  if (
    !req.body.phoneNumber ||
    req.body.phoneNumber.match(/\d/g) == null ||
    req.body.phoneNumber.match(/\d/g).length !== 10
  ) {
    return res.status(400).json({
      msg: 'Unable to add patient: invalid phone number',
    });
  }

  if (req.body.firstName === '') {
    return res.status(400).json({
      msg: 'Unable to add patient: must include first name',
    });
  }

  if (req.body.lastName === '') {
    return res.status(400).json({
      msg: 'Unable to add patient: must include last name',
    });
  }

  if (req.body.language === '') {
    return res.status(400).json({
      msg: 'Unable to add patient: must include language',
    });
  }
  const patient = new Patient({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    language: req.body.language,
    phoneNumber: req.body.phoneNumber,
    reports: [],
    responseCount: req.body.responseCount,
    messagesSent: req.body.messagesSent,
  });
  return Patient.updateOne({ _id: req.params.id }, patient).then(() => {
    return res.status(201).json({
      msg: 'Patient response count updated successfully!',
      sucess: true,
    });
  });
});

router.get('/getPatientOutcomes/:patientID', auth, (req, res) => {
  const id = req.params.patientID;
  return Outcome.find({ patientID: new ObjectId(id) })
    .then((outcomeList) => {
      if (!outcomeList) return errorHandler(res, 'No outcomes found!');

      return res
        .status(200)
        .json(outcomeList.sort((a: any, b: any) => b.date - a.date));
    })
    .catch((err) => errorHandler(res, err.message));
});

router.get('/getPatient/:patientID', auth, (req, res) => {
  const id = req.params.patientID;
  return Patient.findById(new ObjectId(id))
    .then((patient) => {
      if (!patient) return errorHandler(res, 'No patient found!');
      return res.status(200).json(patient);
    })
    .catch((err) => errorHandler(res, err.message));
});

router.get('/getPatientMessages/:patientID', auth, async (req, res) => {
  const id = req.params.patientID;
  const messages = await Message.find({
    patientID: new ObjectId(id),
    sent: true,
    isCoachingMessage: true,
  });

  if (!messages) {
    return errorHandler(res, 'No messages found!');
  }
  return res.status(200).json(messages);
});

router.post('/status', auth, (req, res) => {
  const { id } = req.body;
  const { status } = req.body;
  return Patient.findByIdAndUpdate(new ObjectId(id), { enabled: status })
    .then(() => {
      return res.status(200).json('Patiet Status Changed!');
    })
    .catch((err) => errorHandler(res, err.message));
});

export default router;
