// build-lofi v4 renderer
// Reads concepts.json, builds the scrolling sketch page from a declarative region tree.

(function () {
  const D = document;

  function el(tag, opts) {
    opts = opts || {};
    const e = D.createElement(tag);
    if (opts.cls) e.className = opts.cls;
    if (opts.tip) e.setAttribute('data-tip', opts.tip);
    if (opts.text != null) e.textContent = opts.text;
    if (opts.html != null) e.innerHTML = opts.html;
    if (opts.style) e.setAttribute('style', opts.style);
    if (opts.children) opts.children.forEach(c => { if (c) e.appendChild(c); });
    return e;
  }

  // Pill: accepts string (default filter) or {kind, text}.
  function pill(p) {
    if (p == null) return null;
    if (typeof p === 'string') return el('span', { cls: 'pill filter', text: p });
    const kind = p.kind || 'filter';
    let cls = 'pill ' + kind;
    // 'filter-active' is rendered as `.pill.filter.active`
    if (kind === 'filter-active') cls = 'pill filter active';
    return el('span', { cls: cls, text: p.text || '' });
  }

  function btn(b) {
    if (typeof b === 'string') return el('span', { cls: 'btn', text: b });
    const cls = ['btn', b.size === 'sm' ? 'sm' : '', b.variant || ''].filter(Boolean).join(' ');
    return el('span', { cls: cls, text: b.text || '' });
  }

  function skel(w, opts) {
    opts = opts || {};
    const parts = ['skel'];
    if (w) parts.push('w-' + w);
    if (opts.tall) parts.push('tall');
    if (opts.dark) parts.push('dark');
    return el('div', { cls: parts.join(' ') });
  }

  function skelLines(widths, opts) {
    return widths.map(w => skel(w, opts));
  }

  function rowInline(items) {
    return el('div', { cls: 'row-inline', children: items.filter(Boolean) });
  }

  function rowInlineBetween(left, right) {
    return el('div', { cls: 'row-inline between', children: [
      el('div', { cls: 'row-inline', children: left.filter(Boolean) }),
      el('div', { cls: 'row-inline', children: right.filter(Boolean) })
    ]});
  }

  // ------------------------------------------------------------
  // Card patterns: declarative templates for repeated card content.
  // Patterns receive an optional opts object and return an array of DOM nodes.
  // Agents can override by passing a custom `pattern: { ... }` object.
  // ------------------------------------------------------------
  const CARD_PATTERNS = {
    'simple': () => [
      rowInlineBetween([pill('LABEL'), skel(50, { tall: true })], [pill('TIMESTAMP'), btn({ text: 'OPEN', size: 'sm' })]),
      skel(95),
      skel(80)
    ],
    'guidance-event': () => [
      rowInlineBetween(
        [pill('FDA'), pill('FINAL'), pill({ kind: 'status-detected', text: 'PROPOSED' })],
        [pill('TIMESTAMP'), btn({ text: 'OPEN', size: 'sm' })]
      ),
      skel(80, { tall: true }),
      skel(95)
    ],
    'submission': () => [
      rowInlineBetween(
        [skel(50, { tall: true }), pill('FDA')],
        [pill('TIMESTAMP'), pill({ kind: 'minor', text: 'FILING DEADLINE' }), btn({ text: 'OPEN', size: 'sm' })]
      ),
      rowInline([
        pill({ kind: 'status-detected', text: 'PROPOSED' }), skel(30),
        pill({ kind: 'status-assigned', text: 'ASSIGNED' }), skel(30),
        pill({ kind: 'status-in-progress', text: 'UNDER REVIEW' }), skel(30),
        pill({ kind: 'status-resolved', text: 'DECIDED' }), skel(30),
        pill({ kind: 'status-closed', text: 'DISMISSED' }), skel(30)
      ])
    ],
    'excerpt': () => [
      rowInlineBetween(
        [pill({ kind: 'minor', text: 'SIGNIFICANCE' }), pill('SECTION TITLE'), pill('PAGE')],
        [pill({ kind: 'status-detected', text: 'NEW REQUIREMENT' })]
      ),
      skel(95, { tall: true }),
      skel(80),
      agentSubBlock('AI SUMMARY', 'high', 1)
    ],
    'assessment': () => [
      rowInlineBetween([pill('DK'), pill('MODULE')], [pill({ kind: 'high', text: 'MATERIAL' })]),
      skel(95),
      skel(65),
      rowInlineBetween([pill({ kind: 'minor', text: 'SUBMITTED' }), pill('TIMESTAMP')], [btn({ text: 'OPEN', size: 'sm' })])
    ],
    'pending-content': () => [
      rowInlineBetween(
        [pill('MODULE'), pill({ kind: 'status-needs-review', text: 'NOT UPLOADED' })],
        [btn({ text: 'REQUEST UPLOAD', size: 'sm' })]
      ),
      skel(80)
    ],
    'queue-row': () => [
      rowInlineBetween(
        [pill('MODULE'), pill({ kind: 'agent', text: 'AI CANDIDATE' }), skel(50, { tall: true })],
        [pill({ kind: 'status-detected', text: 'PROPOSED' }), pill({ kind: 'confidence-high' })]
      ),
      skel(95)
    ],
    'assignment': () => [
      rowInlineBetween(
        [pill({ kind: 'status-assigned', text: 'ASSIGNED' }), pill('MODULE'), skel(50)],
        [pill('TIMESTAMP'), btn({ text: 'OPEN', size: 'sm' })]
      )
    ]
  };

  function agentSubBlock(label, conf, lines) {
    return el('div', { cls: 'agent-block', tip: 'Agent-generated content block.', children: [
      rowInline([pill({ kind: 'agent', text: label }), pill({ kind: 'confidence-' + (conf || 'high') })]),
      ...skelLines(Array(lines || 2).fill(80))
    ]});
  }

  // ------------------------------------------------------------
  // Region renderers
  // ------------------------------------------------------------
  const HANDLERS = {
    topbar(r) {
      const left = (r.left || []).map(p => {
        if (typeof p === 'object' && p.skel) return skel(p.skel, { tall: true });
        return pill(p);
      });
      const right = (r.right || []).map(p => pill(p));
      const rightActions = (r.actions || []).map(b => btn(typeof b === 'string' ? { text: b, size: 'sm' } : { ...b, size: b.size || 'sm' }));
      return el('div', { cls: 'box sm', tip: r.tooltip, children: [
        rowInlineBetween(left, right.concat(rightActions))
      ]});
    },

    breadcrumb(r) {
      const depth = r.depth || 3;
      const kids = [];
      for (let i = 0; i < depth; i++) {
        kids.push(skel(30));
        if (i < depth - 1) kids.push(el('span', { html: '/', style: 'color:#999;font-size:10px;' }));
      }
      return el('div', { cls: 'box sm', tip: r.tooltip, children: [rowInline(kids)] });
    },

    banner(r) {
      const cls = r.variant === 'error' ? 'banner error' : 'banner';
      const headerLeft = [];
      if (r.label) headerLeft.push(pill({ kind: r.labelKind || (r.variant === 'error' ? 'blocking' : 'minor'), text: r.label }));
      (r.pills || []).forEach(p => headerLeft.push(pill(p)));
      if (r.line) headerLeft.push(skel(r.line));
      const headerRight = (r.actions || []).map(a => btn(typeof a === 'string' ? { text: a, size: 'sm' } : { ...a, size: a.size || 'sm' }));
      const kids = [];
      if (headerLeft.length || headerRight.length) kids.push(rowInlineBetween(headerLeft, headerRight));
      (r.children || []).forEach(c => kids.push(render(c)));
      return el('div', { cls: cls, tip: r.tooltip, children: kids });
    },

    'kpi-strip'(r) {
      const tiles = (r.tiles || []).map(t => el('div', {
        cls: t.alert ? 'kpi alert' : 'kpi',
        tip: t.tooltip || r.tooltip,
        children: [
          el('div', { cls: 'kpi-label', text: t.label }),
          el('div', { cls: 'kpi-value', children: [skel(50)] })
        ]
      }));
      return el('div', { cls: 'kpi-row', children: tiles });
    },

    box(r) {
      const parts = ['box'];
      if (r.size) parts.push(r.size);
      if (r.fill) parts.push('fill');
      if (r.muted) parts.push('muted');
      const kids = [];
      if (r.label) kids.push(el('div', { cls: 'box-label', text: r.label }));
      (r.children || []).forEach(c => kids.push(render(c)));
      return el('div', { cls: parts.join(' '), tip: r.tooltip, children: kids });
    },

    'card-list'(r) {
      const patternFn = CARD_PATTERNS[r.pattern] || CARD_PATTERNS.simple;
      const cards = [];
      for (let i = 0; i < (r.count || 3); i++) {
        cards.push(el('div', { cls: 'issue-card', tip: r.cardTooltip || r.tooltip, children: patternFn() }));
      }
      return el('div', { children: cards });
    },

    'side-by-side'(r) {
      const renderHalf = (side) => {
        const widths = side.widths || [95, 80, 65, 95, 50];
        const highlightAt = side.highlightAt != null ? side.highlightAt : 2;
        const highlightColor = side.highlightColor || '#fde4e4';
        const lines = widths.map((w, idx) => {
          if (idx === highlightAt) return el('div', { style: 'background:' + highlightColor + ';height:14px;border-radius:2px;margin-bottom:6px;' });
          return skel(w, { tall: idx === 0 });
        });
        const inner = [el('div', { cls: 'box-label', text: side.label })];
        if (side.pills) inner.push(rowInline(side.pills.map(pill)));
        lines.forEach(l => inner.push(l));
        return el('div', { cls: 'col', children: [el('div', { cls: 'box lg', tip: side.tooltip || r.tooltip, children: inner })] });
      };
      return el('div', { cls: 'row', children: [
        renderHalf(r.left || { label: 'LEFT' }),
        renderHalf(r.right || { label: 'RIGHT', highlightColor: r.left && r.left.highlightColor ? '#d8ebd8' : undefined })
      ]});
    },

    'queue-table'(r) {
      const cols = r.columns || ['EXCERPT', 'SECTION', 'IMPACT', 'CONFIDENCE', 'STATE', 'ACTION'];
      const header = el('div', { cls: 'box sm muted', tip: 'Table header.', children: [
        el('div', { cls: 'table-row', children: cols.map((_, i) => el('div', { cls: 'cell' + (i >= 2 ? ' narrow' : ''), style: i < 2 ? 'flex:2;' : null, children: [skel(65, { dark: true })] })) })
      ]});
      const impactCycle = [
        { kind: 'high', text: 'MATERIAL' },
        { kind: 'medium', text: 'AMBIGUOUS' },
        { kind: 'minor', text: 'LIKELY IRRELEVANT' }
      ];
      const confCycle = [
        { kind: 'confidence-high', text: 'HIGH' },
        { kind: 'confidence-med', text: 'MED' },
        { kind: 'confidence-low', text: 'LOW' }
      ];
      const rows = [];
      const rowCount = r.rowCount || 6;
      for (let i = 0; i < rowCount; i++) {
        const stateP = (i === rowCount - 2) ? { kind: 'status-needs-review', text: 'PENDING CONTENT' } : { kind: 'status-detected', text: 'PROPOSED' };
        rows.push(el('div', { cls: 'table-row', children: [
          el('div', { cls: 'cell', style: 'flex:2;', children: [rowInline([pill('MODULE'), pill({ kind: 'agent', text: 'AI CANDIDATE' }), skel(65)])] }),
          el('div', { cls: 'cell', style: 'flex:2;', children: [rowInline([pill('MODULE'), skel(65)])] }),
          el('div', { cls: 'cell narrow', children: [pill(impactCycle[i % impactCycle.length])] }),
          el('div', { cls: 'cell narrow', children: [pill(confCycle[i % confCycle.length])] }),
          el('div', { cls: 'cell narrow', children: [pill(stateP)] }),
          el('div', { cls: 'cell narrow', children: [rowInline([btn({ text: 'CONFIRM', size: 'sm' }), btn({ text: 'DISMISS', size: 'sm' })])] })
        ]}));
      }
      const inner = [];
      if (r.label) inner.push(el('div', { cls: 'box-label', text: r.label }));
      inner.push(header);
      rows.forEach(rr => inner.push(rr));
      if (r.bulkBar) {
        inner.push(el('div', { cls: 'box fill', tip: r.bulkBarTooltip || 'Bulk action bar.', children: [
          rowInlineBetween(
            [pill({ kind: 'minor', text: 'SELECTED' }), skel(30), pill({ kind: 'minor', text: 'OF TOTAL' }), skel(30)],
            [btn({ text: 'DISMISS SELECTED', size: 'sm' }), btn({ text: 'CONFIRM SELECTED', size: 'sm', variant: 'primary' })]
          )
        ]}));
      }
      return el('div', { cls: 'box xl', tip: r.tooltip, children: inner });
    },

    'form-rows'(r) {
      const kids = [];
      if (r.label) kids.push(el('div', { cls: 'box-label', text: r.label }));
      (r.rows || []).forEach(row => {
        const items = [];
        if (row.label) items.push(skel(30));
        (row.controls || []).forEach(c => {
          if (typeof c === 'string') items.push(pill(c));
          else if (c.skel) items.push(skel(c.skel));
          else if (c.btn) items.push(btn({ text: c.btn, size: c.size, variant: c.variant }));
          else if (c.pill) items.push(pill(c.pill));
        });
        kids.push(rowInline(items));
      });
      if (r.submit) {
        kids.push(rowInlineBetween(
          [pill({ kind: 'minor', text: r.submit.hint || 'SUBMIT' })],
          [
            btn({ text: 'SAVE DRAFT' }),
            btn({ text: r.submit.text || 'SUBMIT', variant: r.submit.disabled ? 'disabled' : 'primary' })
          ]
        ));
      }
      return el('div', { cls: 'box lg', tip: r.tooltip, children: kids });
    },

    'agent-block'(r) {
      const headerPills = [pill({ kind: 'agent', text: r.label || 'AI' })];
      if (r.confidence) headerPills.push(pill({ kind: 'confidence-' + r.confidence }));
      (r.pills || []).forEach(p => headerPills.push(pill(p)));
      const kids = [];
      const actions = (r.actions || []).map(a => btn(typeof a === 'string' ? { text: a, size: 'sm' } : { ...a, size: a.size || 'sm' }));
      if (actions.length) kids.push(rowInlineBetween(headerPills, actions));
      else kids.push(rowInline(headerPills));
      const widths = [95, 95, 80, 65, 95, 80, 50];
      const n = r.lineCount || 4;
      for (let i = 0; i < n; i++) kids.push(skel(widths[i % widths.length]));
      if (r.footerPills) kids.push(rowInline(r.footerPills.map(pill)));
      return el('div', { cls: 'agent-block', tip: r.tooltip, children: kids });
    },

    timeline(r) {
      const statuses = r.statuses || ['status-detected', 'status-needs-review', 'status-assigned', 'status-in-progress', 'status-resolved', 'status-closed'];
      const labels = r.labels || ['PROPOSED', 'CONFIRMED', 'ASSIGNED', 'UNDER REVIEW', 'ASSESSED', 'DISMISSED'];
      const kids = [];
      if (r.label) kids.push(el('div', { cls: 'box-label', text: r.label }));
      const rowCount = r.rowCount || 6;
      for (let i = 0; i < rowCount; i++) {
        const idx = i % statuses.length;
        kids.push(rowInline([
          el('span', { style: 'display:inline-block;width:8px;height:8px;border-radius:999px;background:#1a1a1a;flex-shrink:0;' }),
          pill({ kind: statuses[idx], text: labels[idx] }),
          skel(50),
          pill('TIMESTAMP')
        ]));
      }
      return el('div', { cls: 'box lg' + (r.muted ? ' muted' : ''), tip: r.tooltip, children: kids });
    },

    'two-col'(r) {
      return el('div', { cls: 'row', children: [
        el('div', { cls: 'col wide', children: (r.wide || []).map(render) }),
        el('div', { cls: 'col narrow', children: (r.narrow || []).map(render) })
      ]});
    },

    'filter-strip'(r) {
      const left = (r.filters || []).map((f, idx) => {
        if (typeof f === 'string') return pill({ kind: idx === 0 ? 'filter-active' : 'filter', text: f });
        return pill(f);
      });
      const right = (r.actions || []).map(a => typeof a === 'string' ? pill(a) : pill(a));
      return el('div', { cls: 'box sm fill', tip: r.tooltip, children: [rowInlineBetween(left, right)] });
    },

    'tab-row'(r) {
      const tabs = (r.tabs || []).map((t, i) => el('div', { cls: 'tab-item' + (i === 0 ? ' active' : ''), text: t }));
      return el('div', { cls: 'tab-row', children: tabs });
    }
  };

  function render(region) {
    if (!region || typeof region !== 'object') return D.createTextNode('');
    const h = HANDLERS[region.type];
    if (!h) {
      console.warn('Unknown region type:', region.type);
      return el('div', { cls: 'box', text: '[unknown region: ' + region.type + ']' });
    }
    return h(region);
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  fetch('concepts.json')
    .then(r => r.json())
    .then(data => {
      const title = (data.product || 'Feature') + ': feature sketches';
      D.title = title;
      const h1 = D.getElementById('page-h1');
      const sub = D.getElementById('page-subtitle');
      const root = D.getElementById('concepts');
      if (h1) h1.textContent = title;
      if (sub) sub.textContent = data.subtitle || ('Independent feature sketches for ' + (data.primary_persona || 'the primary persona') + '. Buffet, not a flow; pick the ones worth pushing into hi-fi.');
      root.innerHTML = '';
      (data.concepts || []).forEach((c, idx) => {
        const section = el('section', { cls: 'step', children: [
          el('div', { cls: 'step-meta', children: [
            el('div', { cls: 'step-num', text: 'Concept ' + (idx + 1) }),
            el('h2', { cls: 'step-title', text: c.title || c.id }),
            el('p', { cls: 'step-blurb', text: c.blurb || '' })
          ]}),
          el('div', { cls: 'frame', children: (c.lofi || []).map(render) })
        ]});
        root.appendChild(section);
      });
    })
    .catch(err => {
      const root = D.getElementById('concepts');
      root.innerHTML = '<pre style="color:#6b0a0a;background:#fde4e4;padding:16px;">Error loading concepts.json: ' + err + '</pre>';
    });
})();
