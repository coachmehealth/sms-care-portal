import {
  compareOutcomesByDate,
  returnColorRanges,
  getAverageAndCounts,
  getWeeklyList,
  getMessageTemplate,
} from '../../src/background_jobs/utils';

describe('Message utils', () => {
  it('compareOutcomesByDate() Compares outcomes objects by date', () => {
    const outcomeOld: any = {
      _id: '12093uqdsj01212d',
      patientID: 'alskdjalsdkj2id2d2',
      phoneNumber: '999-999-9999',
      date: new Date(2021, 10, 10, 5),
      response: 'old',
      value: 122,
      alertType: 'green',
    };
    const outcomeNew: any = {
      _id: '12093uqdsj01212d',
      patientID: 'alskdjalsdkj2id2d2',
      phoneNumber: '999-999-9999',
      date: new Date(2021, 12, 12, 2),
      response: 'old',
      value: 90,
      alertType: 'green',
    };
    expect(compareOutcomesByDate(outcomeNew, outcomeOld)).toEqual(1);
  });

  it('returnColorRanges() Returns the proper color ranges', () => {
    expect(returnColorRanges(50)).toEqual('⚪');
    expect(returnColorRanges(100)).toEqual('🟢');
    expect(returnColorRanges(145)).toEqual('🟡');
    expect(returnColorRanges(189)).toEqual('🔴');
  });

  it('getWeeklyList() Returns the proper language', () => {
    expect(getWeeklyList(5, 110, { monday: 4 }, 'spanish')).toContain(
      'Promedio',
    );
    expect(getWeeklyList(5, 110, { monday: 4 }, 'spanish')).toContain('Lun');
    expect(getWeeklyList(5, 110, { monday: 4 }, 'english')).toContain(
      'Average',
    );
    expect(getWeeklyList(5, 110, { monday: 4 }, 'english')).toContain('Mon');
  });

  it('getMessageTemplate() Returns the proper language', () => {
    expect(getMessageTemplate(4, 5, 110, { monday: 110 }, 'spanish')).toContain(
      'días',
    );
    expect(getMessageTemplate(4, 5, 110, { monday: 120 }, 'english')).toContain(
      'days',
    );
  });

  it('getAverageAndCounts() Correctly counts and averages the data', () => {
    const weeklyData = {
      monday: 99,
      tuesday: 180,
      wednesday: 70,
      thursday: 120,
    };
    expect(getAverageAndCounts(weeklyData)).toStrictEqual([117, 4, 2]);
  });
});
