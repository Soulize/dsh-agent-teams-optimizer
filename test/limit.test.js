import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamLimitLease, validMemberLimit } from '../lib/limit.js';

function serviceWithLimit(maxMembers = 8) {
  const roster = { maxMembers };
  const members = [];
  const service = {
    roster,
    spawnTeammate(_agent, request) {
      if (members.length >= roster.maxMembers) {
        throw new Error(`Team member limit ${roster.maxMembers} reached`);
      }
      members.push(request.name);
    },
  };
  return { service, members };
}

test('validates positive safe integer limits without arbitrary ceiling', () => {
  for (const n of [1, 8, 16, 32, 128, Number.MAX_SAFE_INTEGER]) {
    assert.equal(validMemberLimit(n), true);
  }
  for (const n of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validMemberLimit(n), false);
  }
});

test('changes the actual roster admission limit and restores it', () => {
  const { service, members } = serviceWithLimit();
  const lease = createTeamLimitLease(service);
  for (let i = 0; i < 8; i++) service.spawnTeammate(null, { name: `worker-${i}` });
  assert.throws(() => service.spawnTeammate(null, { name: 'worker-8' }), /limit 8 reached/);

  assert.equal(lease.update(12), 12);
  for (let i = 8; i < 12; i++) service.spawnTeammate(null, { name: `worker-${i}` });
  assert.equal(members.length, 12);
  assert.throws(() => service.spawnTeammate(null, { name: 'worker-12' }), /limit 12 reached/);
  assert.equal(lease.release(), true);
  assert.equal(service.roster.maxMembers, 8);
  assert.equal(lease.release(), false);
  assert.throws(() => lease.update(20), /released/);
});

test('lowering a limit does not delete historical team members', () => {
  const { service, members } = serviceWithLimit();
  const lease = createTeamLimitLease(service);
  for (let i = 0; i < 5; i++) service.spawnTeammate(null, { name: `member-${i}` });
  lease.update(3);
  assert.equal(members.length, 5);
  assert.throws(() => service.spawnTeammate(null, { name: 'new-member' }), /limit 3 reached/);
  lease.release();
});

test('external writes are never silently overwritten', () => {
  const { service } = serviceWithLimit();
  const lease = createTeamLimitLease(service);
  lease.update(20);
  service.roster.maxMembers = 24;
  assert.throws(() => lease.update(32), /Another component/);
  assert.equal(lease.release(), false);
  assert.equal(service.roster.maxMembers, 24);
});

test('incompatible service layouts fail closed', () => {
  assert.throws(() => createTeamLimitLease({}), /unavailable or incompatible/);
  assert.throws(() => createTeamLimitLease({ spawnTeammate() {}, roster: {} }), /Unsupported/);
  assert.throws(() => createTeamLimitLease({
    spawnTeammate() {}, roster: Object.defineProperty({}, 'maxMembers', { value: 8, writable: false }),
  }), /Unsupported/);
});
