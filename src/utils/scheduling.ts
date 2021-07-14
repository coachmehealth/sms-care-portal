import { ObjectId } from 'mongodb';
import { Message, IMessage } from '../models/message.model';
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  TWILIO_FROM_NUMBER_GENERAL,
} from './config';
import { Patient } from '../models/patient.model';

const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// time in seconds between each run of scheduler
const schedulingInterval = 5;

const getPatientIdFromNumber = (number: any) => {
  return Patient.findOne({ phoneNumber: number })
    .select('_id')
    .then((patientId) => {
      if (!patientId) console.log(`'No patient found for ${number}!'`);
      return patientId;
    })
    .catch((err) => {
      return err.message;
    });
};

export const getTwilioNumber = (isCoachingMessage: boolean) => {
  if (isCoachingMessage) {
    return TWILIO_FROM_NUMBER_GENERAL;
  }
  return TWILIO_FROM_NUMBER;
};

// sends message, marks it as sent
const sendMessage = async (msg: IMessage) => {
  const twilioNumber = getTwilioNumber(msg.isCoachingMessage);
  twilio.messages.create({
    body: msg.message,
    from: twilioNumber,
    to: msg.phoneNumber,
  });

  await Message.findOneAndUpdate(
    { _id: msg.id },
    {
      sent: true,
    },
  );

  // updates patient's sentmessages
  getPatientIdFromNumber(msg.phoneNumber).then((id) => {
    const patientId = new ObjectId(id._id);
    Patient.findByIdAndUpdate(patientId, {
      $inc: { messagesSent: 1 },
    }).catch((err) => console.log(err));
  });
};

// selects all messages which should be sent within the next __ seconds, and schedules them to be sent
const scheduleMessages = async (interval: number) => {
  const intervalStart = new Date();
  const intervalEnd = new Date(intervalStart.getTime());
  intervalEnd.setSeconds(intervalEnd.getSeconds() + interval);
  const messages = await Message.find({
    date: {
      $lt: intervalEnd,
    },
    sent: false,
  });

  messages.forEach((message: any) => {
    sendMessage(message);
  });
};

const initializeScheduler = () => {
  scheduleMessages(schedulingInterval);
  setInterval(
    () => scheduleMessages(schedulingInterval),
    schedulingInterval * 1000,
  );
};

export default initializeScheduler;
