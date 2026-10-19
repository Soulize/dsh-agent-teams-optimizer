/**
 * A narrowly scoped compatibility adapter for the official Agent Teams service.
 *
 * TeamService constructs TeamRoster with maxMembers once. The service has no
 * public setter. TypeScript `private readonly` parameter properties currently
 * compile to ordinary writable JavaScript properties, so the roster's own
 * maxMembers value is the one that must change for spawn() to honor the limit.
 * Never patch spawnTeammate or tool output: either would leave the authoritative
 * roster admission check at its old value.
 */

export const DEFAULT_MAX_MEMBERS = 16;

export function validMemberLimit(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

/**
 * Own a single live TeamService instance. If another plugin changes the same
 * field, stop rather than silently clobbering that plugin's change.
 */
export function createTeamLimitLease(service) {
  if (!service || typeof service.spawnTeammate !== 'function') {
    throw new Error('Official Agent Teams service is unavailable or incompatible');
  }

  const roster = service.roster;
  const descriptor = roster && typeof roster === 'object'
    ? Object.getOwnPropertyDescriptor(roster, 'maxMembers')
    : undefined;
  if (!descriptor || descriptor.writable !== true || !validMemberLimit(roster.maxMembers)) {
    throw new Error('Unsupported Agent Teams internals: writable roster.maxMembers not found');
  }

  const original = roster.maxMembers;
  let lastApplied;
  let released = false;

  return {
    get original() { return original; },
    get current() { return roster.maxMembers; },

    update(next) {
      if (released) throw new Error('Agent Teams limit lease was released');
      if (!validMemberLimit(next)) {
        throw new RangeError('maxMembers must be a positive safe integer');
      }
      if (lastApplied !== undefined && roster.maxMembers !== lastApplied) {
        throw new Error('Another component modified roster.maxMembers; refusing to overwrite it');
      }

      roster.maxMembers = next;
      if (roster.maxMembers !== next) {
        throw new Error('Agent Teams roster rejected the updated maxMembers value');
      }
      lastApplied = next;
      return next;
    },

    release() {
      if (released) return false;
      released = true;
      // Only restore the original if our most recent value is still present.
      if (lastApplied === undefined || roster.maxMembers !== lastApplied) return false;
      roster.maxMembers = original;
      return roster.maxMembers === original;
    },
  };
}
