import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import { ObjectId } from 'mongodb';
import auth from '../../middleware/auth';
import { PatientForPhoneNumber } from '../../models/patient.model';
import { parseInboundPatientMessage } from '../../domain/message_parsing';
import { responseForParsedMessage } from '../../domain/glucose_reading_responses';
import { Outcome } from '../../models/outcome.model';
import { Message } from '../../models/message.model';
import errorHandler from '../error';

const router = express.Router();
router.use(bodyParser.urlencoded({ extended: true }));

const { MessagingResponse } = twilio.twiml;

const UNRECOGNIZED_PATIENT_RESPONSE =
  'We do not recognize this number. Please contact CoachMe support.';

export const manageIncomingMessages = async (
  req: any,
  res: any,
  incoming: 'Glucose' | 'General',
) => {
  const twiml = new MessagingResponse();

  const inboundMessage = req.body.Body || 'Invalid Text (image)';
  const fromPhoneNumber = req.body.From.slice(2);
  const date = new Date();

  const patient = await PatientForPhoneNumber(fromPhoneNumber);
  if (!patient) {
    const twilioResponse = twiml.message(UNRECOGNIZED_PATIENT_RESPONSE);

    res.writeHead(204, { 'Content-Type': 'text/xml' });
    res.end(twilioResponse.toString());
    return;
  }
  try {
    const incomingMessage = new Message({
      sent: true,
      phoneNumber: req.body.From,
      patientID: patient._id,
      message: inboundMessage,
      sender: 'PATIENT',
      date,
      isCoachingMessage: incoming === 'General',
    });

    await incomingMessage.save();

    if (incoming === 'General') {
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(incomingMessage.sent.toString());
    }
  } catch (e) {
    if (typeof e === 'string') {
      errorHandler(res, e);
    } else if (e instanceof Error) {
      errorHandler(res, e.message);
    }
  }
  if (incoming === 'Glucose') {
    const parsedResponse = parseInboundPatientMessage(inboundMessage);

    try {
      if (parsedResponse.glucoseReading) {
        const outcome = new Outcome({
          phoneNumber: fromPhoneNumber,
          patientID: patient._id,
          response: inboundMessage,
          value: parsedResponse.glucoseReading.score,
          alertType: parsedResponse.glucoseReading.classification,
          date,
        });

        await outcome.save();
      }
    } catch (e) {
      if (typeof e === 'string') {
        errorHandler(res, e);
      } else if (e instanceof Error) {
        errorHandler(res, e.message);
      }
    }

    const responseMessage = await responseForParsedMessage(
      parsedResponse,
      patient.language,
    );
    try {
      const outgoingMessage = new Message({
        sent: false,
        phoneNumber: fromPhoneNumber,
        patientID: patient._id, // lost on this
        message: responseMessage,
        sender: 'BOT',
        date,
      });

      await outgoingMessage.save();
    } catch (e) {
      if (typeof e === 'string') {
        errorHandler(res, e);
      } else if (e instanceof Error) {
        errorHandler(res, e.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.message(responseMessage).toString());
  }
};

export const sendMessage = async (req: any, res: any) => {
  try {
    const recept = req.body.to;
    const patientID = new ObjectId(req.body.patientID);
    const date = new Date();
    const content = req.body.message;
    const outgoingMessage = new Message({
      sent: false,
      phoneNumber: recept,
      patientID,
      message: content,
      sender: 'COACH',
      date,
      isCoachingMessage: true,
    });

    await outgoingMessage.save();
    res.status(200).send({
      success: true,
      msg: outgoingMessage,
    });
  } catch (e) {
    if (typeof e === 'string') {
      errorHandler(res, e);
    } else if (e instanceof Error) {
      errorHandler(res, e.message);
    }
  }
};

router.post('/sendMessage', auth, async (req, res) => sendMessage(req, res));

router.post('/reply', async (req, res) =>
  manageIncomingMessages(req, res, 'Glucose'),
);

router.post('/receive', async (req, res) =>
  manageIncomingMessages(req, res, 'General'),
);

export default router;
