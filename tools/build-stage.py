#!/usr/bin/env python3
"""Build kit/stage.html, the stage-size reference, from kit/master.html.

The stage file is the master at data-size="stage" with every template recomposed for a room:
the same markup and components, stage-length copy, and the capacity each template holds at
stage (a 9-row plan holds 6 at stage; the skill splits the rest onto a continuation slide).

The shell (CSS, sprite, viewer, editor) is copied from the master byte for byte, so the stage
rules live in one place: the html[data-size="stage"] block of master.html.

Every edit below names the exact text it replaces. If the master changes under an edit, the
build stops and says which one; fix the edit, never the check.

    python3 tools/build-stage.py            # writes skills/rembrandt/kit/stage.html
    python3 tools/build-stage.py --check    # fails if stage.html is stale; run before every release
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, 'skills', 'rembrandt', 'kit')
M = open(os.path.join(KIT, 'master.html')).read()

failures = []

def section(html, name):
    m = re.search(r'<section class="slide[^"]*" data-name="' + re.escape(name) + r'".*?</section>', html, re.S)
    if not m:
        failures.append(f'{name}: template not found in master')
        return None
    return m

def edit(name, *pairs):
    """Replace text inside one template. Each pair is (old, new); old must occur in that template."""
    global M
    m = section(M, name)
    if not m: return
    s = m.group(0)
    for old, new in pairs:
        if old not in s:
            failures.append(f'{name}: expected text not found: {old[:70]!r}')
            continue
        s = s.replace(old, new)
    M = M[:m.start()] + s + M[m.end():]

def transform(name, fn):
    """Apply a function to one template's markup, for structural changes."""
    global M
    m = section(M, name)
    if not m: return
    try:
        s = fn(m.group(0))
    except AssertionError as e:
        failures.append(f'{name}: {e}')
        return
    M = M[:m.start()] + s + M[m.end():]

def drop_last(pattern, keep):
    """Keep the first `keep` matches of a row pattern; the template's stage capacity."""
    def fn(s):
        rows = list(re.finditer(pattern, s, re.S))
        assert len(rows) > keep, f'expected more than {keep} rows, found {len(rows)}'
        for r in reversed(rows[keep:]):
            s = s[:r.start()] + s[r.end():]
        return s
    return fn

# ------------------------------------------------------------------ shell
M = M.replace('<html lang="en" data-size="regular">', '<html lang="en" data-size="stage">', 1)
M = re.sub(r'<title>[^<]*</title>', '<title>Axoniq Master Deck, Stage</title>', M, count=1)
M = M.replace('Master Slide Deck', 'Stage Master Deck')
M = M.replace('MASTER SLIDE DECK', 'STAGE MASTER DECK')

# ------------------------------------------------------------------ covers: two lines of title, two of subtitle
edit('cover/light',
     ('Trust every decision your systems make', 'Trust every decision'),
     ('Axoniq makes complex systems explainable, no rewrite required. Every decision stored exactly as it happened, in order, and complete.',
      'Every decision stored exactly as it happened, in order, and complete.'))
edit('cover/backdrop',
     ('Events are the heartbeat of your organization', 'Events are your heartbeat'),
     ('The system of record that captures and makes sense of your event stream, at speeds generic databases were never designed for.',
      'The system of record for your event stream.'))

# ------------------------------------------------------------------ index: names only, five rows
def no_desc(s):
    n = len(re.findall(r'<div class="idx-desc">.*?</div>', s))
    assert n == 5, f'expected 5 chapter descriptions, found {n}'
    return re.sub(r'<div class="idx-desc">.*?</div>', '', s)
transform('index/spread', no_desc)
edit('index/spread', ('Five chapters, 38 minutes, questions at the end', 'Five chapters, 38 minutes'))

def two_col_catalog(s):
    rows = re.findall(r'<div class="cat-row"[^>]*>.*?</div>', s, re.S)
    assert len(rows) == 12, f'expected 12 catalog rows, found {len(rows)}'
    clean = []
    for r in rows:
        r = re.sub(r' style="border-bottom:0"', '', r)
        spans = re.findall(r'<span class="cat-count">.*?</span>', r)
        assert len(spans) == 2, 'expected two cat-count spans per row'
        clean.append(r.replace(spans[1], ''))
    half = 6
    col = lambda rs: '<div style="display:flex;flex-direction:column;justify-content:flex-end">' + ''.join(
        (x.replace('class="cat-row"', 'class="cat-row" style="border-bottom:0"') if i == len(rs) - 1 else x) for i, x in enumerate(rs)) + '</div>'
    start = s.index(rows[0]); end = s.index(rows[-1]) + len(rows[-1])
    return s[:start] + '<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:48px;align-items:end">' + col(clean[:half]) + col(clean[half:]) + '</div>' + s[end:]
transform('index/catalog', two_col_catalog)
edit('index/catalog', ('Every layout in this file, with the slide to copy from. Duplicate, replace the copy, ship the deck.', 'Every layout, with the slide to copy from.'))

# ------------------------------------------------------------------ cards: one short line per card
edit('cards/3-up',
     ('Three properties a relational store cannot give you, however well you tune it.', 'Three things a relational store cannot give you.'),
     ('Events reach every consumer the moment they commit. No polling overhead, no batch lag, no missed updates between systems.', 'Events reach every consumer the moment they commit.'),
     ('Context-aware clustering gives each business domain its own boundary. Trouble in one context never cascades into the next.', 'Each domain has its own boundary. Trouble never spreads.'),
     ('Append-only segment files keep writes fast at any history size. Performance does not degrade as you grow.', 'Append-only segments keep writes fast at any size.'))
edit('cards/2-up',
     ('Regulated environments do not just need logs, they need forensic evidence. Events are written once, in order, and never updated in place. The audit trail is the system of record.',
      'Events are written once, in order, and never updated. The audit trail is the system of record.'),
     ('When AI decides, you answer. Complete, ordered history gives every agent decision a source of truth that you can replay, inspect and explain later.',
      'Every agent decision gets a source of truth you can replay and explain.'))
edit('cards/4-up',
     ('Open source Java framework for event sourcing, CQRS and DDD. Free under Apache 2.0 for 15 years.', 'Event sourcing, CQRS and DDD for Java.'),
     ('The leading dedicated event store and messaging runtime. Ordered history at production scale.', 'The dedicated event store and router.'),
     ('Operate clusters, contexts and processors from one control plane, self-hosted or in our cloud.', 'One control plane for every cluster.'),
     ('Query and analyze system history. Ask what happened and why, and get answers with evidence.', 'Ask what happened, and why.'))
edit('cards/6-grid',
     ('Scale business domains independently, each with its own failure boundary.', 'Each domain fails alone.'),
     ('Consistency forms per operation, not per schema. No aggregate lock-in.', 'Formed per operation.'),
     ('Consumers work segments simultaneously with ordering guarantees intact.', 'Parallel, order intact.'),
     ('Segmented binary storage with no update and no delete in the write API.', 'No update, no delete.'),
     ('Bridge topics both ways while the event store stays the source of truth.', 'Topics both ways.'),
     ('Agentic tooling that reads your event model and writes along with you.', 'Reads your event model.'),
     ('<h3>Dynamic consistency boundaries</h3>', '<h3>Dynamic boundaries</h3>'))

# ------------------------------------------------------------------ images: lede to stage length
edit('image/three-quarter', ('Insights reads the event stream directly. Trace any decision to the exact events behind it, then replay history into entirely new views.',
                             'Trace any decision to the exact events behind it.'))
edit('image/half-bleed', ('Keep Kafka for transport and your warehouse for analytics. Axon Server holds the ordered source of truth they both read from.',
                          'Kafka moves events. Axon Server keeps the record.'))
edit('image/bottom', ('Self-hosted on your metal, inside your VPC, or fully managed in Axoniq Cloud. Same binaries, same guarantees, same audit story everywhere.',
                   'Your metal, your VPC, or Axoniq Cloud. Same guarantees.'))

# ------------------------------------------------------------------ numbers: 4-up goes 2 by 2 (CSS); shorter reading lines
edit('numbers/4-up',
     ('Of Axon Framework, free and open source under Apache 2.0.', 'Of Axon Framework, open source.'),
     ('On GitHub, with a contributor community to match.', 'On GitHub.'),
     ('Business events logged by customers in regulated industries.', 'Events logged by customers.'),
     ('Latency on the live reference dashboard.', 'Read latency, live.'))
edit('numbers/6-grid',
     ('Measured against tuned generic databases on identical hardware.', 'Against tuned generic databases.'),
     ('Against tuned generic databases on identical hardware.', 'Same hardware.'),
     ('The gap widens as history grows past a billion events.', 'Past a billion events.'),
     ('Append-only segments beat page-based storage on footprint.', 'Than page storage.'),
     ('Across a 12-node cluster in steady state.', '12 nodes, steady state.'),
     ('Rebuilt from history in a single replay.', 'In a single replay.'),
     ('Per cluster, with automatic leader election.', 'Automatic failover.'),
     ('<span class="m">Rows in one read model</span>', '<span class="m">Rows rebuilt</span>'))

# ------------------------------------------------------------------ tables
edit('table/comparison',
     ('Defined by structure. Every event belongs to at most one aggregate.', 'One aggregate per event.'),
     ('Expressed through tags. One stored event takes part in every boundary its tags allow.', 'Tags decide, per event.'),
     ('Fixed per schema, decided when the model is designed.', 'Fixed at design time.'),
     ('Formed per operation, at the moment the operation runs.', 'Formed when it runs.'),
     ('Coordinated through processes and sagas.', 'Sagas and processes.'),
     ('Atomic across domain concepts, without processes and sagas.', 'Atomic, no sagas.'),
     ('A data migration, with history rewritten to fit.', 'A migration of history.'),
     ('Boundaries move by changing tag queries. History stays put.', 'Change a tag query.'),
     ('<th>Dynamic consistency boundaries</th>', '<th>Dynamic boundaries</th>'))
transform('table/dense', drop_last(r'<tr><td class="mono">.*?</tr>', 6))
edit('table/dense', ('<th style="text-align:right">Events / day</th>', '<th style="text-align:right">Events/day</th>'))
transform('table/definitions', drop_last(r'<div class="def-row".*?</div></div>', 3))
edit('table/definitions',
     ('Persist every change as an immutable event instead of overwriting state. Current state is derived by replaying history, so the record is complete by construction and any past state can be reconstructed on demand.',
      'Every change kept as an immutable event. State is derived by replay.'),
     ('Command Query Responsibility Segregation. Writes go through commands that append events, reads come from projections built for each question. Both sides scale and evolve independently.',
      'Commands append events; reads come from projections.'),
     ('An architectural model that defines the scope of transactional consistency per operation, at the moment it runs, rather than binding it to a fixed aggregate. Introduced by Sara Pellegrini and Milan Savic in 2024.',
      'Consistency scoped per operation, not per aggregate.'))

# ------------------------------------------------------------------ plan: stage capacity
transform('plan/detailed', drop_last(r'<div class="plan-row".*?</div>\s*<span class="chip chip--cat">.*?</span>\s*</div>', 4))
transform('plan/compact', drop_last(r'<div class="plan-row".*?</span><span class="meta" style="color:var\(--n500\)">[^<]*</span>\s*</div>', 6))
transform('plan/compact', lambda s: s.replace('grid-template-columns:160px 1fr 220px 70px 80px', 'grid-template-columns:210px 1fr 260px 80px 100px').replace('padding:15.5px 0', 'padding:14px 0'))

# ------------------------------------------------------------------ roadmap
transform('roadmap/quarters', lambda s: s.replace('190px + (100% - 190px)', '250px + (100% - 250px)'))
edit('roadmap/quarters', ('<h4>Insights natural language</h4>', '<h4>Insights queries</h4>'), ('<h4>AF5 migration tooling</h4>', '<h4>AF5 migration</h4>'))
def timeline(s):
    s = s.replace('width:320px', 'width:400px')
    for a, b in [('Two days of event-driven architecture, DCB deep dives and customer stories.', 'Two days of DCB and stories.'),
                 ('Tiered storage preview and measurably faster cold starts.', 'Tiered storage preview.'),
                 ('DCB ergonomics, plus the new test fixtures.', 'DCB ergonomics.'),
                 ('Natural-language queries over event history.', 'Ask your history.'),
                 ('Every cluster, one screen.', 'Every cluster, one screen.')]:
        assert a in s, f'expected text not found: {a[:50]}'
        s = s.replace(a, b)
    return s
transform('roadmap/timeline', timeline)

# ------------------------------------------------------------------ team, diagram, extras
edit('team/trio', ('height:470px;margin-bottom:28px', 'height:330px;margin-bottom:24px'))
transform('team/trio', lambda s: s.replace('height:412px;margin-bottom:28px', 'height:290px;margin-bottom:24px'))
edit('team/trio',
     ('Owns the Server roadmap and the on-call rotation that keeps it honest.', 'Owns the Server roadmap.'),
     ('Wrote the replication layer. Thinks in append-only.', 'Wrote the replication layer.'),
     ('Drives Axon Framework 5 and its DCB ergonomics.', 'Drives Axon Framework 5.'))
edit('team/solo', ('Lina leads solution architecture for regulated customers in EMEA. Before Axoniq she ran core banking platforms, which is why she asks about your audit trail first.',
                   'Leads solution architecture for regulated customers in EMEA.'))
edit('diagram/architecture', ('Commands in, events out. DCB native.', 'Commands in, events out.'), ('Every agent decision logged as an event.', 'Every decision logged.'))
edit('quote/full', ('Regulated environments do not just need logs, they need forensic evidence. With Axon Server, the audit trail is the system of record.',
                    'With Axon Server, the audit trail is the system of record.'))
edit('versus/split', ('Retained state exists so a workflow can resume.', 'State kept so a workflow can resume.'),
     ('Questions are limited to what happened to survive.', 'You can only ask what survived.'),
     ('Every decision traceable end to end, forever.', 'Every decision traceable, forever.'))
edit('logos/wall', ('From open source to enterprise, Axoniq powers mission-critical software across global organizations.', 'Mission-critical software, worldwide.'))
edit('closing/cta', ('Download Axon Server and log your first event in minutes, or book a session with our engineering team.', 'Log your first event in minutes.'))

def diagram(s):
    for a, b in [('top:520px;width:440px;height:210px', 'top:480px;width:440px;height:210px'),
                 ('top:0;width:560px;height:730px', 'top:0;width:560px;height:690px'),
                 ('top:570px;width:440px;height:160px', 'top:530px;width:440px;height:160px'),
                 ('y1="560" x2="596" y2="560"', 'y1="520" x2="596" y2="520"'), ('y="544">APPEND', 'y="504">APPEND'),
                 ('y1="605" x2="1348" y2="605"', 'y1="565" x2="1348" y2="565"'), ('y="589">MANAGE', 'y="549">MANAGE')]:
        assert a in s, f'expected text not found: {a}'
        s = s.replace(a, b)
    return s.replace('<div class="dg grow">', '<div class="dg grow" style="min-height:690px">')
transform('diagram/architecture', diagram)

# ------------------------------------------------------------------ spec: the stage scale, one line per style
SPEC = """  <div class="body"><div class="cols">
      <div style="grid-column:1/7;display:flex;flex-direction:column">
        <h1 class="title">Stage styles</h1>
        <div style="margin-top:auto"></div>
        <div class="ts-row"><div class="display-sm">Display sm</div><span class="ts-spec">.display-sm &middot; 136</span></div>
        <div class="ts-row"><div class="title">Title</div><span class="ts-spec">.title &middot; 92</span></div>
        <div class="ts-row"><div class="title-sm">Heading two</div><span class="ts-spec">.title-sm &middot; 64</span></div>
        <div class="ts-row"><div class="title-sm--c">H2 compact</div><span class="ts-spec">.title-sm--c &middot; 52</span></div>
        <div class="ts-row"><span class="num">3.6M</span><span class="ts-spec">.num &middot; 160, .num-sm 100, .num-xl 340</span></div>
      </div>
      <div style="grid-column:7/13;display:flex;flex-direction:column;justify-content:flex-end">
        <div class="ts-row"><span class="numeral">04</span><span class="ts-spec">.numeral &middot; 136</span></div>
        <div class="ts-row"><p class="lede">Lede line</p><span class="ts-spec">.lede &middot; 42</span></div>
        <div class="ts-row"><p class="sub">Subtitle</p><span class="ts-spec">.sub &middot; 42</span></div>
        <div class="ts-row"><p class="body1">Body text</p><span class="ts-spec">.body1 &middot; 36</span></div>
        <div class="ts-row"><p class="body1s">Body strong</p><span class="ts-spec">.body1s &middot; 36</span></div>
        <div class="ts-row"><p class="img-cap">Caption</p><span class="ts-spec">.img-cap &middot; 28</span></div>
        <div class="ts-row"><span class="code">axon-server</span><span class="ts-spec">.code &middot; 30</span></div>
        <div class="ts-row"><span class="label">Label</span><span class="ts-spec">.label &middot; 22</span></div>
        <div class="ts-row"><span class="meta">Meta</span><span class="ts-spec">.meta &middot; 20</span></div>
        <div class="ts-row"><span class="foot" style="position:static">Footnote</span><span class="ts-spec">.foot &middot; 18</span></div>
      </div>
    </div></div>
"""
def spec(s):
    i = s.index('<div class="body">')
    return s[:i] + SPEC.lstrip() + '</section>'
transform('spec/type', spec)

if failures:
    print('build-stage: FAIL, the master changed under these edits:')
    for f in failures: print('  -', f)
    sys.exit(1)
out = os.path.join(KIT, 'stage.html')
if '--check' in sys.argv:
    current = open(out).read() if os.path.exists(out) else ''
    if current != M:
        print('build-stage: FAIL, kit/stage.html is out of date with kit/master.html. Run: python3 tools/build-stage.py')
        sys.exit(1)
    print('build-stage: kit/stage.html is up to date')
    sys.exit(0)
open(out, 'w').write(M)
print('build-stage: wrote kit/stage.html')
