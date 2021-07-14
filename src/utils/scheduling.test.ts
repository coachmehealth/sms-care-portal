import { getTwilioNumber } from './scheduling';
import { TWILIO_FROM_NUMBER, TWILIO_FROM_NUMBER_GENERAL } from './config';

jest.mock('twilio');

describe('Scheduling tests', () => {
  it('returns the general twilio number when given a coaching message', async () => {
    expect(getTwilioNumber(true)).toBe(TWILIO_FROM_NUMBER_GENERAL);
  });
  it('returns the tracking twilio number when given a tracking message', async () => {
    expect(getTwilioNumber(false)).toBe(TWILIO_FROM_NUMBER);
  });
});
