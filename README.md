# dsh-agent-teams-optimizer

An independent DeepSeek Harness plugin to configure the **actual Agent Teams teammate admission limit**. It changes the number checked when `spawn_teammate` creates a new, durable teammate; it does not merely ask the model to use more teammates.

In the official Agent Teams profile, `agent-team` is configured with `maxMembers: 8`. The underlying `TeamService` default is 16 when no profile override is provided. This plugin defaults to **16** and allows any positive safe integer.

## Install

First enable the official **Agent Teams** bundle. Then install the optimizer in the same profile:

```sh
dsh plugin --profile web add "github:Soulize/dsh-agent-teams-optimizer#main"
```

Restart DSH after adding the plugin. In Web/Desktop, open **Plugins -> dsh-agent-teams-optimizer -> agent-teams-optimizer -> Configure**, enter the desired **maxMembers**, and save. DSH stores the option in the current profile; changes are applied to the active Team service without needing to restart, provided the current official internal layout is compatible.

For direct profile configuration, set:

```yaml
- id: agent-teams-optimizer
  config:
    maxMembers: 32
```

The plugin's own bundle patch only inserts `agent-teams-optimizer`. It intentionally does **not** overwrite the official Agent Teams config row or any unrelated settings.

## Behavior

- The limit counts **teammates** only; the Lead is not counted.
- It is a cumulative, immutable roster limit, **not** a simultaneous-running limit. Even an inactive or failed member keeps its slot; increasing the limit permits more distinct names. Lowering the limit does not delete historical members.
- It changes the real TeamRoster admission field, so existing and future teams in the current Team service honor the new value.
- Regular Subagent, workflow and nested delegation limits are not changed.
- If Agent Teams is disabled, the optimizer remains idle. It binds automatically when the official `agentTeams` service becomes available.
- Disabling/unmounting this plugin restores the original roster limit **only if no other component has changed the same field**.

## Implementation and compatibility

The official `TeamService` currently captures `maxMembers` in its `TeamRoster` constructor and offers no public runtime setter. Modifying the `agent-team` Cordis profile row is the **supported** method for setting the limit at service startup. This plugin instead provides an editable, live UI by conditionally updating the existing roster's `maxMembers` property. This is **an undocumented internal field**, not a stable DSH API.

The adapter checks that the official service and writable field have the expected shapes before changing anything. If a future DSH release changes those internals, the plugin logs a warning and does not pretend the setting took effect. It does not replace `spawnTeammate`, monkey-patch tool handlers, or mutate the roster's historical records.

For a stable configuration-only alternative, use this profile override (the whole `config` object is replaced by a patch, so include the other fields to retain the official explicit values):

```yaml
- id: agent-team
  config:
    maxMembers: 32
    maxTasks: 256
    maxMessageBytes: 65536
    disposalTimeoutMs: 5000
```

These two approaches should not be used to compete for the same limit at runtime. If both are present, the optimizer treats the effective value seen on service mounting as its restoration baseline.

## Verify

When a compatible Team service mounts, check the DSH Host log for a line such as:

```text
agent-teams-optimizer: maxMembers=32 (previous=8, official baseline=8, reason=service-mounted)
```

Test by creating more than eight distinct teammates in one Team. A ninth successful creation confirms that the **runtime** limit, not merely the prompt, has changed. Actual model behavior is a separate matter: raising the cap does not force the Lead to spawn more agents.

Run the unit tests with `npm test` (uses Node's built-in test runner).

## Requirements

- Official DeepSeek Harness Agent Teams service (`@deepseek-ai/dsh-experimental-agent-team`), not a third-party Teams implementation.
- DeepSeek Harness `>=0.2.0-rc.1`; no maximum DSH version is imposed. Compatibility is verified by the runtime adapter on each mount.
- Node.js `>=22.19.0` for DSH.

License: MIT.
