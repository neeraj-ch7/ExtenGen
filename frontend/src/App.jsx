import "./index.css";

const links = [
  ["How it works", "#how"],
  ["Tools", "#tools"],
  ["Security", "#security"],
  ["Stack", "#stack"],
];

const problems = [
  ["You repeat yourself", "Developers re-type the same background into every new agent session, wasting time and tokens."],
  ["Answers drift", "Two teammates ask the same question and get different answers. There is no shared source of truth."],
  ["Knowledge scatters", "Issues, PRs and chat threads hold the why, and none of it reaches your agent."],
];

const feed = [
  ["10:12 AM", "Agent session captured", "Ana's agent finished a task. Decision saved: use cursor pagination."],
  ["11:40 AM", "Pull request ingested", "A merged PR is embedded and tagged with its author and repo."],
  ["2:05 PM", "Context recalled", "Ravi asks about invoices. His agent gets the pagination decision automatically."],
  ["2:06 PM", "Access respected", "A memory from a private repo stays hidden from people without access."],
  ["4:30 PM", "Tokens saved", "Ravi skipped the long background paragraph. The agent already knew."],
];

const steps = [
  ["Capture", "The agent sends decisions, explanations and diffs, tagged with org, user, source and time."],
  ["Embed", "Text becomes a vector, so search matches meaning and not only keywords."],
  ["Store", "Text and vector live together in PostgreSQL with pgvector."],
  ["Retrieve", "Cosine search plus access rules returns the top matches you are allowed to see."],
  ["Inject", "Relevant context joins the agent's prompt, so it starts informed."],
];

const tools = [
  ["store_observation", "Saves something worth remembering, such as a decision, an explanation or a code change.",
    `{\n  "text": "Chose cursor pagination for /orders",\n  "source": "agent",\n  "org_id": "acme"\n}`],
  ["recall_context", "Finds the most relevant memories for a new task and returns only what the user may see.",
    `{\n  "query": "add pagination to /invoices",\n  "top_k": 5\n}`],
];

const access = [
  ["Ana asks about billing decisions", true],
  ["Ana asks about Ravi's private repo", false],
  ["Ravi asks about the shared API", true],
  ["Someone from another org asks anything", false],
];

const stack = ["Node.js + TypeScript", "Fastify", "MCP SDK", "PostgreSQL + pgvector", "Supabase Auth + RLS", "OpenAI embeddings", "Redis + BullMQ", "Railway / Vercel"];
const next = ["Slack bot", "Automated PR reviewer", "Call transcripts", "Self-surfacing skills"];

function Nav() {
  return (
    <header className="nav">
      <a className="logo" href="#top">extengen</a>
      <nav>{links.map(([t, h]) => <a key={h} href={h}>{t}</a>)}</nav>
      <div className="nav-cta">
        <a className="pill white" href="#">GitHub</a>
        <a className="pill dark" href="#start">Get started</a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      {/* Swap the blobs for a real video: <video className="bg" src="/hero.mp4" autoPlay muted loop playsInline /> */}
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" /><div className="shade" />
      <div className="hero-in">
        <h1>Your agent forgot.<br />ExtenGen didn't.</h1>
        <p>ExtenGen is a lightweight, self-hostable memory layer that saves what your team decides and feeds it back into every future agent prompt.</p>
        <div className="row">
          <a className="pill white big" href="#start">Get started</a>
          <a className="pill ghost big" href="#how">See how it works</a>
        </div>
      </div>
      <a className="announce" href="#tools">
        <span className="thumb" />
        <span><small>Announcement</small><b>ExtenGen brings shared memory to Claude Code through MCP.</b></span>
        <i aria-hidden="true">↗</i>
      </a>
    </section>
  );
}

const Head = ({ title, text }) => (
  <div className="head"><h2>{title}</h2>{text && <p>{text}</p>}</div>
);

export default function App() {
  return (
    <>
      <Nav />
      <Hero />

      <div className="strip">
        <span>Works with any MCP-compatible agent</span>
        <b>Claude Code</b><b>Cursor</b><b>Codex</b>
      </div>

      <section className="sec">
        <Head title="Every session starts from zero." text="Decisions, context and reasons live in old chats, pull requests and people's heads." />
        <div className="cols3">
          {problems.map(([t, d]) => <div className="blk" key={t}><h3>{t}</h3><p>{d}</p></div>)}
        </div>
      </section>

      <section className="sec" id="how">
        <div className="split">
          <Head title="Memory that works while you don't." text="ExtenGen quietly captures useful context from agent sessions and GitHub, then brings it back when a related task shows up. Example activity from a small team." />
          <ol className="tl">
            {feed.map(([time, t, d]) => <li key={time}><time>{time}</time><strong>{t}</strong><span>{d}</span></li>)}
          </ol>
        </div>
      </section>

      <section className="sec">
        <Head title="Five steps from session to memory." />
        <div className="steps">
          {steps.map(([t, d], i) => (
            <div className={"step" + (i === 4 ? " last" : "")} key={t}>
              <em>{i + 1}</em><h3>{t}</h3><p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec" id="tools">
        <Head title="Two tools. That's the whole interface." text="Add the ExtenGen MCP server and your agent gets both." />
        <div className="cols2">
          {tools.map(([n, d, code]) => (
            <div className="card" key={n}><h3 className="mono">{n}</h3><p>{d}</p><pre>{code}</pre></div>
          ))}
        </div>
      </section>

      <section className="sec" id="security">
        <div className="split center">
          <Head title="Agents only recall what you're allowed to see." text="Access rules sit in the database itself, on every row, so a clever prompt can't get around them. Scoped by organisation and user, with Postgres row-level security through Supabase." />
          <div className="rows">
            {access.map(([t, ok]) => (
              <div key={t}><span>{t}</span><b className={ok ? "ok" : "no"}>{ok ? "Returned" : "Hidden"}</b></div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" id="stack">
        <Head title="Small on purpose." text="Two ingestion sources, one access point, and a stack a student team can run on free tiers." />
        <div className="chips">{stack.map((s) => <span key={s}>{s}</span>)}</div>
        <p className="mut">Planned next</p>
        <div className="chips dashed">{next.map((s) => <span key={s}>{s}</span>)}</div>
      </section>

      <section className="cta-card" id="start">
        <div className="blob b1" /><div className="blob b3" /><div className="shade" />
        <div className="hero-in">
          <h2>Give your agents a memory.</h2>
          <div className="row">
            <a className="pill white big" href="#">View on GitHub</a>
            <a className="pill ghost big" href="#">Read the docs</a>
          </div>
          <pre className="install">claude mcp add extengen -- npx extengen-mcp</pre>
          <small>Placeholder command. Replace it with your real install step.</small>
        </div>
      </section>

      <footer>
        <span>© 2026 ExtenGen · B.Tech CSE project, Shri Ramswaroop Memorial University</span>
        <span>Vinay Dhiman · Sreedharan · Mohammad Anas · Neeraj Chauhan</span>
      </footer>
    </>
  );
}
