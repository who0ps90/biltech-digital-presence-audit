import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectionToken, verifySelection } from '../server/selection.js';
import { DailyBudget, DETAILS_MASK, SEARCH_MASK } from '../server/places.js';

test('selection is limited to signed candidates, requesting client, and expiry', () => {
  const token = selectionToken(['ChIJcandidateABC'], 'client-a', 1000);
  assert.doesNotThrow(() => verifySelection(token, 'ChIJcandidateABC', 'client-a', 2000));
  assert.throws(() => verifySelection(token, 'ChIJdifferentABC', 'client-a', 2000));
  assert.throws(() => verifySelection(token, 'ChIJcandidateABC', 'client-b', 2000));
  assert.throws(() => verifySelection(token, 'ChIJcandidateABC', 'client-a', 301000));
  assert.throws(() => verifySelection(token + 'tampered', 'ChIJcandidateABC', 'client-a', 2000));
  assert.throws(() => verifySelection(null, 'ChIJcandidateABC', 'client-a'));
});
test('daily usage cap counts attempts and resets only on a new UTC day', () => {
  const budget = new DailyBudget(2);
  const today = new Date('2026-10-22T00:00:00Z');
  budget.consume(today); budget.consume(today); assert.throws(() => budget.consume(today), /cap/);
  assert.doesNotThrow(() => budget.consume(new Date('2026-10-23T00:00:00Z')));
  assert.throws(() => new DailyBudget(0).consume(today), /cap/);
});
test('explicit masks retrieve requested fields but never full reviews or wildcard', () => {
  for (const field of ['displayName', 'primaryTypeDisplayName', 'formattedAddress', 'businessStatus', 'nationalPhoneNumber', 'websiteUri', 'regularOpeningHours', 'rating', 'userRatingCount', 'photos', 'googleMapsUri', 'attributions', 'pureServiceAreaBusiness']) assert.ok(DETAILS_MASK.split(',').includes(field));
  assert.equal(DETAILS_MASK.includes('*'), false); assert.equal(DETAILS_MASK.split(',').includes('reviews'), false);
  assert.equal(SEARCH_MASK.includes('rating'), false); assert.equal(SEARCH_MASK.includes('*'), false);
});
