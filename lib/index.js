import z from '@deepseek-ai/schemastery';
import { createTeamLimitLease, DEFAULT_MAX_MEMBERS, validMemberLimit } from './limit.js';

export const name = 'agent-teams-optimizer';

// Volatile fields are stored by DSH Settings in the profile's patch and
// refreshed without remounting this plugin.
export const Config = z.object({
  maxMembers: z.number().step(1).min(1).default(DEFAULT_MAX_MEMBERS).volatile(),
});

function valueOf(maybeVolatile) {
  return maybeVolatile !== null && typeof maybeVolatile === 'object'
    && typeof maybeVolatile.get === 'function'
    ? maybeVolatile.get()
    : maybeVolatile;
}

function configuredLimit(config) {
  const next = valueOf(config?.maxMembers ?? DEFAULT_MAX_MEMBERS);
  if (!validMemberLimit(next)) {
    throw new RangeError('maxMembers must be a positive safe integer');
  }
  return next;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

export function apply(ctx, config = {}) {
  const logger = ctx.logger;

  // Expose the volatile maxMembers field through DSH's ordinary configuration
  // form. Changes land in this plugin's own config namespace.
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });

  // Agent Teams is optional. Bind only while the real service exists; do not
  // create a substitute service or interfere with ordinary Subagent limits.
  ctx.inject(['agentTeams'], (child) => {
    child.effect(() => {
      let lease;
      try {
        lease = createTeamLimitLease(child.agentTeams);
      } catch (error) {
        logger.warn('agent-teams-optimizer: %s; no limit was changed', errorText(error));
        return () => {};
      }

      const synchronize = (reason) => {
        try {
          const before = lease.current;
          const after = lease.update(configuredLimit(config));
          logger.info(
            'agent-teams-optimizer: maxMembers=%d (previous=%d, official baseline=%d, reason=%s)',
            after, before, lease.original, reason,
          );
        } catch (error) {
          logger.warn('agent-teams-optimizer: maxMembers update failed: %s', errorText(error));
        }
      };

      synchronize('service-mounted');
      const disposeChange = ctx.on('loader/volatile-update', (paths) => {
        if (Array.isArray(paths) && paths.some((path) =>
          Array.isArray(path) && path[0] === 'maxMembers')) {
          synchronize('settings');
        }
      });

      return () => {
        disposeChange?.();
        try {
          if (lease.release()) {
            logger.info('agent-teams-optimizer: restored maxMembers=%d', lease.original);
          } else if (lease.current !== lease.original) {
            logger.warn('agent-teams-optimizer: limit changed externally; skipped restore');
          }
        } catch (error) {
          logger.warn('agent-teams-optimizer: restore failed: %s', errorText(error));
        }
      };
    }, 'agent-teams-optimizer: team limit lease');
  });
}

export default { name, Config, apply };
