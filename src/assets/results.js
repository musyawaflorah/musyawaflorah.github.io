/* Preliminary results dashboard. All numbers come from the saved group-level benchmark output. */
(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('results-data').textContent);
  var PRIMARY = 'Logistic regression';
  var state = { model: PRIMARY, withYachida: true };
  var el = function (id) { return document.getElementById(id); };
  var pct = function (x, digits) { return (x * 100).toFixed(digits === undefined ? 0 : digits) + '%'; };
  var pts = function (x) { return (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var interval = function (a, b, f) { return f(a) + ' to ' + f(b); };

  function table(headers, rows) {
    return '<table><thead><tr>' + headers.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return i === 0 ? '<th scope="row">' + esc(c) + '</th>' : '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  function buttons(host, options, current, onPick) {
    host.innerHTML = '';
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dash-btn';
      b.textContent = o.label;
      b.setAttribute('aria-pressed', String(o.value === current));
      b.addEventListener('click', function () { onPick(o.value); });
      host.appendChild(b);
    });
  }

  function findings() {
    var lr = data.models[PRIMARY], rf = data.models['Random forest'], gb = data.models['Gradient boosting'];
    var stage = function (m, s) { return m.stages.filter(function (x) { return x.stage === s; })[0]; };
    var noY = function (m, s) { return m.stagesNoYachida.filter(function (x) { return x.stage === s; })[0]; };
    var aucs = [lr.meanAuroc, rf.meanAuroc, gb.meanAuroc];
    var items = [
      ['Early-stage detection depended heavily on the study', 'Stage I sensitivity was ' + pct(stage(lr, 'I').sensitivity) + ' with the primary model and ' + pct(stage(gb, 'I').sensitivity) + ' with gradient boosting. Without one large Japanese study, it was ' + pct(noY(lr, 'I').sensitivity) + ' and ' + pct(noY(gb, 'I').sensitivity) + '. Results for stage 0 were low with all three models.'],
      ['Model differences were partly about thresholds', 'At each model\'s own threshold, the pooled excess alert rate was ' + pts(lr.pooled.estimate) + ' points with logistic regression and ' + pts(gb.pooled.estimate) + ' with gradient boosting. Logistic regression also flagged fewer people overall. A later check that matched specificity narrowed the gap, so the data doesn\'t show that one model type is more disease-specific.'],
      ['Alerts varied by condition', 'Liver cirrhosis and atherosclerotic cardiovascular disease stood out in single studies, while most other conditions were close to zero. These results come from single cohorts and need replication.'],
      ['Cross-study performance was modest', 'Mean AUROC on unseen studies ranged from ' + Math.min.apply(null, aucs).toFixed(2) + ' to ' + Math.max.apply(null, aucs).toFixed(2) + ' across the three models.'],
    ];
    el('findings').innerHTML = items.map(function (i) { return '<article class="dash-finding"><h3>' + esc(i[0]) + '</h3><p>' + esc(i[1]) + '</p></article>'; }).join('');
  }

  function tiles(m) {
    var items = [
      [m.meanAuroc.toFixed(2), 'Mean AUROC', 'Across 11 unseen cancer studies'],
      [pct(m.sensitivity), 'Cancer sensitivity', 'At ' + pct(m.specificity) + ' held-out specificity'],
      [pts(m.pooled.estimate) + ' pts', 'Pooled excess alerts', '95% interval ' + interval(m.pooled.low, m.pooled.high, pts)],
      [String(data.n.training_people.toLocaleString('en-US')), 'People in training pool', data.n.training_cancer + ' with cancer, ' + data.n.training_controls + ' controls'],
    ];
    el('tiles').innerHTML = items.map(function (t) { return '<div class="dash-tile"><strong>' + esc(t[0]) + '</strong><span>' + esc(t[1]) + '</span><small>' + esc(t[2]) + '</small></div>'; }).join('');
  }

  var MIN = -0.4, MAX = 0.8;
  var X = function (v) { return ((Math.max(MIN, Math.min(MAX, v)) - MIN) / (MAX - MIN)) * 100; };

  function forestRow(label, sub, r, cls) {
    var solid = r.low > 0 || r.high < 0;
    return '<div class="f-row ' + (cls || '') + '" tabindex="0" aria-label="' + esc(label + ', ' + sub + ': excess alert rate ' + pts(r.est) + ' points, interval ' + interval(r.low, r.high, pts)) + '">' +
      '<div class="f-label"><span>' + esc(label) + '</span><small>' + esc(sub) + '</small></div>' +
      '<div class="f-plot" aria-hidden="true"><i class="f-line" style="left:' + X(r.low) + '%;width:' + (X(r.high) - X(r.low)) + '%"></i><i class="f-dot' + (solid ? ' solid' : '') + '" style="left:' + X(r.est) + '%"></i></div>' +
      '<div class="f-value">' + pts(r.est) + '</div></div>';
  }

  function forest(m) {
    var ticks = [-0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8];
    var axis = '<div class="f-row f-axis" aria-hidden="true"><div class="f-label"></div><div class="f-plot">' + ticks.map(function (t) { return '<span style="left:' + X(t) + '%">' + (t > 0 ? '+' : '') + Math.round(t * 100) + '</span>'; }).join('') + '</div><div class="f-value">Points</div></div>';
    var row = function (p) { return forestRow(p.condition, p.study + ' · ' + p.cases + ' adults, ' + p.controls + ' controls', { est: p.excess, low: p.low, high: p.high }); };
    var groups = [['main', 'Main comparison'], ['pilot', "Crohn's disease pilot (descriptive)"], ['adenoma', 'Adenoma (colorectal cancer precursor)']];
    var html = axis + forestRow('Pooled estimate', 'Main comparison, all studies', { est: m.pooled.estimate, low: m.pooled.low, high: m.pooled.high }, 'f-pooled');
    groups.forEach(function (g) {
      html += '<h3 class="f-group">' + esc(g[1]) + '</h3>' + m.pairs.filter(function (p) { return p.group === g[0]; }).map(row).join('');
    });
    el('forest').innerHTML = '<div class="f-zero-wrap"><i class="f-zero" aria-hidden="true"></i>' + html + '</div>';
    el('forest-table').innerHTML = table(['Condition', 'Study', 'Adults', 'Controls', 'Alert rate', 'Control alert rate', 'Difference (points)', '95% interval'], m.pairs.map(function (p) {
      return [p.condition, p.study, p.cases, p.controls, pct(p.caseRate, 1), pct(p.controlRate, 1), pts(p.excess), interval(p.low, p.high, pts)];
    }));
    el('alerts-lead').textContent = 'With ' + state.model.toLowerCase() + ', the pooled excess alert rate in other conditions was ' + pts(m.pooled.estimate) + ' percentage points (95% interval ' + interval(m.pooled.low, m.pooled.high, pts) + ').' +
      (state.model === PRIMARY ? ' Without the largest cohort, it was ' + pts(data.noMetaCardis.estimate) + ' points (' + interval(data.noMetaCardis.low, data.noMetaCardis.high, pts) + ').' : '');
  }

  function stages(m) {
    var rows = state.withYachida ? m.stages : m.stagesNoYachida;
    el('stages').innerHTML = rows.map(function (s) {
      var name = /^(0|I|II|III|IV)$/.test(s.stage) ? 'Stage ' + s.stage : s.stage === 'III/IV' ? 'Stage III or IV' : s.stage;
      return '<div class="s-row" tabindex="0" aria-label="' + esc(name + ': sensitivity ' + pct(s.sensitivity) + ' in ' + s.people + ' people') + '"><div class="s-label">' + esc(name) + '<small>' + s.people + ' people</small></div>' +
        '<div class="s-track" aria-hidden="true"><i class="s-bar" style="width:' + (s.sensitivity * 100) + '%"></i><i class="s-ci" style="left:' + (s.low * 100) + '%;width:' + ((s.high - s.low) * 100) + '%"></i></div><div class="s-value">' + pct(s.sensitivity) + '</div></div>';
    }).join('');
    el('stage-table').innerHTML = table(['Stage', 'People', 'Sensitivity', '95% interval'], rows.map(function (s) { return [s.stage, s.people, pct(s.sensitivity), interval(s.low, s.high, pct)]; }));
    var i = rows.filter(function (s) { return s.stage === 'I'; })[0];
    var ii = rows.filter(function (s) { return s.stage === 'II'; })[0];
    el('stage-lead').textContent = 'With ' + state.model.toLowerCase() + ', the model flagged ' + pct(i.sensitivity) + ' of people with stage I cancer and ' + pct(ii.sensitivity) + ' with stage II cancer.' + (state.withYachida ? ' One large Japanese study supplies most stage 0 to II patients, so you can also view results without it.' : ' Very few stage 0 patients remain without that study.');
    buttons(el('stage-buttons'), [{ label: 'All studies', value: true }, { label: 'Without largest study', value: false }], state.withYachida, function (v) { state.withYachida = v; stages(data.models[state.model]); });
  }

  function studies(m) {
    el('study-table').innerHTML = table(['Held-out study', 'Country', 'Cancer', 'Controls', 'AUROC', 'Sensitivity', 'Specificity'], m.byStudy.map(function (s) { return [s.study, s.country, s.cancer, s.controls, s.auroc.toFixed(2), pct(s.sensitivity), pct(s.specificity)]; }));
    var lo = m.byStudy[m.byStudy.length - 1], hi = m.byStudy[0];
    el('studies-lead').textContent = 'AUROC for ' + state.model.toLowerCase() + ' ranged from ' + lo.auroc.toFixed(2) + ' in ' + lo.study + ' to ' + hi.auroc.toFixed(2) + ' in ' + hi.study + '. A model can look strong in one population and much weaker in another.';
  }

  function aware() {
    var lr = data.models[PRIMARY], a = data.aware;
    el('aware').innerHTML = '<p class="dash-lead">Not much in this first test. Adding other conditions as training examples barely changed the primary model.</p>' + '<div class="dash-table-wrap">' + table(['Measure', 'Standard model', 'Disease-aware model'], [
      ['Pooled excess alerts (points)', pts(lr.pooled.estimate), pts(a.excess.estimate)],
      ['Mean AUROC', lr.meanAuroc.toFixed(2), a.auroc.toFixed(2)],
      ['Cancer sensitivity', pct(lr.sensitivity), pct(a.sensitivity)],
      ['Held-out specificity', pct(lr.specificity), pct(a.specificity)],
    ]) + '</div><p class="note">Both models use logistic regression. Thresholds and specificity differ slightly, so these results aren\'t a formal test.</p>';
  }

  function species() {
    var list = function (title, rows) {
      return '<div><h3>' + esc(title) + '</h3><ol>' + rows.map(function (s) { return '<li><em>' + esc(s.species) + '</em></li>'; }).join('') + '</ol></div>';
    };
    el('species').innerHTML = list('Pushed scores toward cancer', data.species.higher_in_cancer_model) + list('Pushed scores away from cancer', data.species.lower_in_cancer_model);
  }

  function render() {
    var m = data.models[state.model];
    buttons(el('model-buttons'), Object.keys(data.models).map(function (k) { return { label: k + (k === PRIMARY ? ' (primary)' : ''), value: k }; }), state.model, function (v) { state.model = v; render(); });
    tiles(m); forest(m); stages(m); studies(m);
  }

  function fullModel() {
    var f = data.fullModel;
    var range = function (d) { return pts(d.estimate) + ' (' + interval(d.low, d.high, pts) + ')'; };
    el('full-lead').textContent = 'The second model tried ' + f.candidates + ' setups and chose one using only training studies, inside each held-out fold. It chose ' + f.selected.toLowerCase() + ' as the final model. Its accuracy was no better than the first run\'s best models, but it\'s a fairer estimate because selection never used the study being tested.';
    var items = [
      [f.meanAuroc.toFixed(2), 'Mean AUROC', interval(f.aurocRange[0], f.aurocRange[1], function (x) { return x.toFixed(2); }) + ' across 11 unseen studies'],
      [pct(f.sensitivity), 'Cancer sensitivity', 'At ' + pct(f.specificity) + ' held-out specificity'],
      [pts(f.pooled.estimate) + ' pts', 'Pooled excess alerts', '95% interval ' + interval(f.pooled.low, f.pooled.high, pts) + ', ' + f.comparisons + ' comparisons'],
      [pts(f.ageStandardized.estimate) + ' pts', 'Adjusted for age', '95% interval ' + interval(f.ageStandardized.low, f.ageStandardized.high, pts)],
    ];
    el('full-tiles').innerHTML = items.map(function (t) { return '<div class="dash-tile"><strong>' + esc(t[0]) + '</strong><span>' + esc(t[1]) + '</span><small>' + esc(t[2]) + '</small></div>'; }).join('');
    el('full-note').textContent = 'Without the largest cohort, the pooled excess was ' + range(f.noMetaCardis) + ' points. Calibration slope was ' + f.calibration.slope.toFixed(2) + ' and intercept ' + f.calibration.intercept.toFixed(2) + ', but only for this study mix, which is about half cancer, so scores aren\'t real-world probabilities. With labels shuffled, mean AUROC was ' + f.shuffled.toFixed(2) + ', close to chance.';
    el('compare-table').innerHTML = table(['Model', 'Cancer AUROC', 'Mean held-out specificity', 'Excess alerts at own threshold', 'Excess alerts at matched 90% specificity'], f.comparison.map(function (m) {
      return [m.model, m.auroc.toFixed(2), pct(m.specificity), range(m.trained), range(m.matched)];
    }));
    el('full-species').innerHTML = f.species.map(function (s) { return '<li><em>' + esc(s) + '</em></li>'; }).join('');
  }

  findings(); render(); aware(); species(); fullModel();
  el('checks').textContent = 'As a leakage check, labels were shuffled within each study and the primary model was rerun five times. Mean AUROC ranged from ' + Math.min.apply(null, data.shuffled).toFixed(2) + ' to ' + Math.max.apply(null, data.shuffled).toFixed(2) + ', close to the 0.50 expected by chance.';
})();
