/* CYBERTRACE AI Kali Tutor panel.
   Adds a tutor next to both terminals (the full-screen workstation and the Lab section).
   Talks only to /api/tutor on your own server; the API key never reaches the browser. */
(function () {
  'use strict';

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Safe mini-markdown: everything is escaped first, then code fences, `inline`, **bold**.
  function renderMarkdown(text) {
    return String(text).split(/(```[\s\S]*?```)/g).map(part => {
      const block = part.match(/^```(?:[\w-]*)\n?([\s\S]*?)```$/);
      if (block) {
        const code = block[1].trim();
        const first = code.split('\n')[0];
        return '<pre class="tutor-code"><code>' + esc(code) + '</code>' +
          '<button type="button" class="tutor-try" data-try="' + esc(first) + '">Try it</button></pre>';
      }
      return esc(part)
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
    }).join('');
  }

  const WELCOME = "Hi! I'm your **Kali tutor**. Ask me about any command or tool (nmap, grep, chmod, gobuster...), " +
    "or tap **Explain my last command**. I'll never run anything for you: you type it, you learn it.";

  function createTutor(options) {
    const { host, variant, getContext, getInput } = options;
    const history = [];
    let busy = false;

    host.classList.add('tutor-panel', 'tutor-' + variant);
    host.innerHTML =
      '<div class="tutor-head"><div><small>AI KALI TUTOR</small><b>Learn as you type</b></div>' +
      '<span class="tutor-badge" data-badge>READY</span>' +
      '<button type="button" class="tutor-close" data-close aria-label="Close tutor"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="tutor-log" role="log" aria-live="polite"></div>' +
      '<div class="tutor-chips">' +
      '<button type="button" data-chip="Explain my last command and its output.">Explain my last command</button>' +
      '<button type="button" data-chip="What should I do next in this mission?">What next?</button>' +
      '<button type="button" data-chip="Quiz me on what I just practiced.">Quiz me</button>' +
      '<button type="button" data-chip="Explain the most useful nmap flags.">nmap flags</button></div>' +
      '<form class="tutor-form"><input type="text" maxlength="500" autocomplete="off" placeholder="Ask the tutor..." aria-label="Ask the tutor">' +
      '<button type="submit" aria-label="Send"><i class="bi bi-send"></i></button></form>';

    const log = host.querySelector('.tutor-log');
    const badge = host.querySelector('[data-badge]');
    const form = host.querySelector('.tutor-form');
    const input = form.querySelector('input');

    function addMessage(role, html, extraClass) {
      const el = document.createElement('div');
      el.className = 'tutor-msg tutor-' + role + (extraClass ? ' ' + extraClass : '');
      el.innerHTML = html;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    addMessage('assistant', renderMarkdown(WELCOME));

    async function ask(message) {
      message = String(message || '').trim();
      if (!message || busy) return;
      busy = true;
      form.classList.add('busy');
      addMessage('user', esc(message));
      const pending = addMessage('assistant', '<span class="tutor-dots"><i></i><i></i><i></i></span>', 'pending');
      try {
        const response = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history: history.slice(-8), context: getContext() })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'The tutor is unavailable right now.');
        pending.classList.remove('pending');
        pending.innerHTML = renderMarkdown(data.reply);
        history.push({ role: 'user', content: message }, { role: 'assistant', content: data.reply });
        badge.textContent = data.source === 'ai' ? 'AI' : 'OFFLINE';
        badge.classList.toggle('ai', data.source === 'ai');
        if (data.needsLogin) addMessage('system', 'Log in to unlock the full AI tutor. You are using the built-in offline tutor.');
        else if (data.source === 'offline' && !data.aiAvailable) addMessage('system', 'Offline tutor mode: set ANTHROPIC_API_KEY on the server to enable the AI tutor.');
      } catch (error) {
        pending.classList.remove('pending');
        pending.classList.add('tutor-error');
        pending.textContent = error.message || 'Something went wrong. Try again.';
      } finally {
        busy = false;
        form.classList.remove('busy');
        log.scrollTop = log.scrollHeight;
      }
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      const value = input.value;
      input.value = '';
      ask(value);
    });

    host.addEventListener('click', e => {
      const chip = e.target.closest('[data-chip]');
      if (chip) return ask(chip.dataset.chip);
      const tryBtn = e.target.closest('[data-try]');
      if (tryBtn) {
        const target = getInput();
        if (target) { target.value = tryBtn.dataset.try; target.focus(); }
        return;
      }
      if (e.target.closest('[data-close]')) host.classList.remove('open');
    });

    return { ask, open() { host.classList.add('open'); input.focus(); } };
  }

  /* ---------- context readers: only read what is on screen ---------- */
  function textList(selector, root) {
    return Array.from((root || document).querySelectorAll(selector)).map(n => n.textContent.trim()).filter(Boolean);
  }
  function terminalContext(screenId, lineSelector, commandSelector, mission, objectives, mode) {
    const screen = document.getElementById(screenId);
    const recent = screen ? textList(commandSelector, screen).map(c => c.replace(/^[^$#]*[$#]\s*/, '')).slice(-6) : [];
    const outputLines = screen ? textList(lineSelector + ':not(.command)', screen).slice(-12) : [];
    return { mode, mission, objectives, recentCommands: recent, lastOutput: outputLines.join('\n').slice(-900) };
  }

  /* ---------- workstation (full-screen terminal) ---------- */
  const workstation = document.getElementById('ctWorkstation');
  let workTutor = null;
  if (workstation) {
    const host = document.createElement('aside');
    host.className = 'workstation-tutor open';
    workstation.appendChild(host);
    workTutor = createTutor({
      host,
      variant: 'work',
      getInput: () => document.getElementById('workTerminalCommand'),
      getContext: () => terminalContext(
        'workTerminal', '.work-line', '.work-line.command',
        (document.getElementById('workMissionTitle') || {}).textContent || '',
        textList('#workMissionObjectives li'), 'workstation')
    });
    const head = workstation.querySelector('.workstation-terminal-head div');
    if (head) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.id = 'toggleWorkTutor';
      toggle.textContent = 'AI TUTOR';
      toggle.addEventListener('click', () => host.classList.toggle('open'));
      head.prepend(toggle);
    }
  }

  /* ---------- lab section terminal ---------- */
  const labLayout = document.querySelector('#lab .terminal-layout');
  let labTutor = null;
  if (labLayout) {
    const host = document.createElement('section');
    host.className = 'lab-tutor open';
    labLayout.insertAdjacentElement('afterend', host);
    labTutor = createTutor({
      host,
      variant: 'lab',
      getInput: () => document.getElementById('terminalCommand'),
      getContext: () => terminalContext(
        'terminalScreen', '.terminal-line', '.terminal-line.command',
        (document.getElementById('missionTitle') || {}).textContent || '',
        [(document.getElementById('objectiveText') || {}).textContent || ''], 'lab')
    });
  }

  // Used by the terminal command:  tutor <question>
  window.CTTutor = {
    ask(question) {
      const active = workstation && workstation.classList.contains('open') ? workTutor : (labTutor || workTutor);
      if (!active) return;
      active.open();
      active.ask(question);
    }
  };
})();
