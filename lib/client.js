window.__ModuleLoader__.load({
  id: 'dsh-agent-teams-optimizer',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const DEFAULT_MAX_MEMBERS = 16;
    const CSS = [
      '.dato-wrap{display:flex;flex-direction:column;gap:14px;max-width:650px}',
      '.dato-label{font-size:14px;font-weight:600}',
      '.dato-hint,.dato-summary{font-size:13px;line-height:1.55;color:var(--dsw-alias-fg-muted,#77736d)}',
      '.dato-field{display:flex;flex-direction:column;gap:7px}',
      '.dato-input{width:160px;max-width:100%;padding:9px 12px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-subtle,#cacaca);border-radius:9px;background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;font:inherit}',
      '.dato-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.dato-button{padding:8px 14px;border:1px solid var(--dsw-alias-border-subtle,#cacaca);border-radius:9px;background:transparent;color:inherit;cursor:pointer;font:inherit}',
      '.dato-save{background:var(--dsw-alias-accent,#0071e3);border-color:transparent;color:white}',
      '.dato-button:disabled{opacity:.5;cursor:default}',
      '.dato-ok{font-size:13px;color:#278644}',
      '.dato-error{font-size:13px;color:#cd3b3b}',
    ].join('\n');

    function SettingsForm({ form }) {
      const state = form?.state;
      const stored = Number.isSafeInteger(state?.value?.maxMembers)
        ? state.value.maxMembers : DEFAULT_MAX_MEMBERS;
      const [draft, setDraft] = React.useState(String(stored));
      const [busy, setBusy] = React.useState(false);
      const [notice, setNotice] = React.useState('');
      const [error, setError] = React.useState('');

      React.useEffect(() => {
        setDraft(String(stored));
        setNotice('');
        setError('');
      }, [state?.revision, stored]);

      const requested = Number(draft);
      const valid = draft.trim() !== '' && Number.isSafeInteger(requested) && requested >= 1;
      const editable = Boolean(form) && state?.status === 'ready' && state.writable !== false;
      const changed = valid && requested !== stored;

      const save = async () => {
        if (!editable || !changed || busy) return;
        setBusy(true);
        setNotice('');
        setError('');
        try {
          const ok = await form.mutate([
            { op: 'set', path: ['maxMembers'], value: requested },
          ], state?.revision);
          if (!ok) throw new Error('The profile rejected this settings update.');
          setNotice('Saved to the profile. The Host updates the active Team limit if the official service layout is compatible.');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setBusy(false);
        }
      };

      if (!form || state?.status === 'unavailable') {
        return h('p', { className: 'dato-error' }, 'The profile settings form is unavailable.');
      }

      return h('div', { className: 'dato-wrap' },
        h('div', { className: 'dato-field' },
          h('label', { htmlFor: 'dato-max-members', className: 'dato-label' }, 'Maximum Agent Teams teammates'),
          h('input', {
            id: 'dato-max-members', className: 'dato-input', type: 'number', min: '1', step: '1',
            value: draft, disabled: busy || !editable,
            onChange: (event) => { setDraft(event.target.value); setNotice(''); setError(''); },
          }),
          h('p', { className: 'dato-hint' },
            'Official profile default: 8. Plugin default: 16. The Lead is not counted. ',
            'Created, failed and inactive teammates consume slots permanently within a Team.'),
        ),
        h('div', { className: 'dato-actions' },
          h('button', { type: 'button', className: 'dato-button',
            disabled: busy || !editable || Number(draft) === DEFAULT_MAX_MEMBERS,
            onClick: () => { setDraft(String(DEFAULT_MAX_MEMBERS)); setNotice(''); setError(''); },
          }, 'Reset to 16'),
          h('button', { type: 'button', className: 'dato-button dato-save',
            disabled: busy || !editable || !changed,
            onClick: save,
          }, busy ? 'Saving...' : 'Save'),
        ),
        !valid && draft.trim() !== ''
          ? h('span', { className: 'dato-error' }, 'Enter an integer of at least 1.') : null,
        notice ? h('span', { className: 'dato-ok' }, notice) : null,
        error ? h('span', { className: 'dato-error' }, error) : null,
        h('p', { className: 'dato-hint' },
          'The Host verifies the internal admission limit before changing it. ',
          'If the official implementation changes, the plugin fails closed and logs a warning.'),
      );
    }

    function apply(ctx) {
      ctx.effect(() => {
        const id = 'dsh-agent-teams-optimizer/settings.css';
        if (document.querySelector('style[data-plugin-css="' + id + '"]')) return () => {};
        const tag = document.createElement('style');
        tag.dataset.pluginCss = id;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, 'agent-teams-optimizer: client styles');

      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        key: 'dsh-agent-teams-optimizer#agent-teams-optimizer',
      }, ({ view, form }) => view === 'summary'
        ? h('span', { className: 'dato-summary' }, 'Set the runtime Agent Teams teammate limit')
        : h(SettingsForm, { form })));
    }

    return { inject: ['slots'], apply };
  },
});
