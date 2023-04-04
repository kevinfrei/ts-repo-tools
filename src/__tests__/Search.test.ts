import { MakeSearchable } from '../index';

test('Make a simple search thing', () => {
  const srch = MakeSearchable(['ab', 'cd', 'abcd', 'a', 'ef'], (arg) => arg);
  expect(srch).toBeDefined();
  const results = new Set(srch('cd', true));
  expect(results.has('cd')).toBeTruthy();
  expect(results.has('abcd')).toBeTruthy();
  expect(results.size).toEqual(2);
  const results2 = new Set(srch('ab'));
  expect(results2.has('ab')).toBeTruthy();
  expect(results2.size).toEqual(1);
  const results3 = new Set(srch('g'));
  expect(results3.size).toEqual(0);
});
