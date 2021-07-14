import request from 'supertest';
import express from 'express';
import {
  connectDatabase,
  closeDatabase,
  clearDatabase,
  getTestToken,
  createPatient,
} from '../../test/db';
import { Patient } from '../models/patient.model';
import { Message } from '../models/message.model';
import patientRouter from './patient.api';

const patientApp = express();

patientApp.use(express.urlencoded({ extended: false }));
patientApp.use('/', patientRouter);

if (process.env.NODE_ENV === 'development') {
  const tokenObject = { token: [] };
  beforeAll(async (done: any) => {
    await connectDatabase();
    await getTestToken(tokenObject, done);
  });
  beforeEach(async () => clearDatabase());
  afterAll(() => closeDatabase());

  describe('Patient api routes work as intended', () => {
    it('/getPatientMessages/:patientID gets messages with isCoachingMessage ', async () => {
      await createPatient('1114446668');
      const patient = await Patient.findOne();
      const newMessage = new Message({
        phoneNumber: patient?.phoneNumber,
        patientID: patient?._id,
        sender: 'COACH',
        message: 'Example smg',
        date: new Date(),
        sent: true,
        isCoachingMessage: true,
      });
      await newMessage.save();
      const newMessageNotShow = new Message({
        phoneNumber: patient?.phoneNumber,
        patientID: patient?._id,
        sender: 'COACH',
        message: 'Example smg',
        date: new Date(),
        sent: false,
        isCoachingMessage: true,
      });
      await newMessageNotShow.save();
      const newMessageNotShow2 = new Message({
        phoneNumber: patient?.phoneNumber,
        patientID: patient?._id,
        sender: 'COACH',
        message: 'Example smg',
        date: new Date(),
        sent: true,
        isCoachingMessage: false,
      });
      await newMessageNotShow2.save();
      const res = await request(patientApp)
        .get(`/getPatientMessages/${patient?._id}`)
        .set('Authorization', `Bearer ${tokenObject.token[0]}`);

      expect(res.statusCode).toBe(200);
      const messages = res.body;
      expect(messages.length).toBe(1);
      expect(messages[0]?.sender).toBe('COACH');
      expect(messages[0]?.isCoachingMessage).toBe(true);
    });
  });
} else {
  it('is not development', () => {
    expect(1).toBeTruthy();
  });
}
