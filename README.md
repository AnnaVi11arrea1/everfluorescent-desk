# Review desk — a Sanity App SDK app

A triage queue for social posts that an agent drafted and a person has to decide
on. Built with the [Sanity App SDK](https://www.sanity.io/docs/app-sdk), it runs
in the Sanity Dashboard beside the Studio for project `70komvgl`.

**It approves. It does not post.** Approving sets `variant.status` to `approved`,
which is the state the publish worker reads. Nothing here talks to Instagram.

## Why an app and not another Studio pane

The Studio edits one document at a time, and a review queue is the opposite
shape. The thing that needs a decision is **one platform variant**, and a post
holds several — a Halloween post has an Instagram variant and a Facebook variant
with different captions, different assets, and independent verdicts.

So this lists variants across every post, each with the gate's verdict under it
and the buttons that move it. It is live by default: a draft the agent writes
while this is open appears without a reload, because the SDK subscribes rather
than polls.

## The workflow it completes

`variant.status` is a process modelled as data, sitting next to the content it
describes:

```
draft ── agent drafts ──▶ needs_review ── you approve here ──▶ approved ──▶ …
                                       └─ or back to draft ──┘
```

Claude writes posts into this dataset and leaves every variant at
`needs_review`. This app is the human half. Both actors write the same field and
both are judged by the same gate, which is the point — there is no separate
"agent status" and "human status" to fall out of step.

## The gate is not reimplemented

Every caption ceiling, hashtag cap, aspect ratio and asset count this app
enforces comes from `src/vendor/preflight.ts` and `src/vendor/platformSpec.ts`,
**copied verbatim** from the everfluorescent-cms repository. That is the same
code behind the Studio's publish button and the same file its preview pane
renders from, so the three cannot disagree about what a platform accepts.

```bash
npm run vendor          # refresh from the CMS checkout
npm run vendor:check    # exit 1 if what is committed is stale
```

`src/vendor/` is generated. Never edit it — change `lib/platformSpec.ts` in the
CMS and re-run. The only edit the copy makes is dropping the `.ts` from one
import specifier, because the CMS runs under `node --experimental-strip-types`
and this app's tsconfig does not allow that extension.

Why copied rather than imported: the CMS is a separate working copy and is not
under version control, so nothing here can reach it at run time. What is vendored
is the *source*, not a rewrite — there is one implementation of the rules and a
copy of it, which is a far weaker claim to have to defend than two
implementations that happen to agree.

## Running it

```bash
npm install
npm run dev       # → http://localhost:3333
```

The CLI prints a Dashboard URL that loads the local app:
`https://sanity.io/@o8u0l0nzs?dev=http://localhost:3333`. Use a browser other
than Safari during development — Safari's mixed-content handling breaks the
Dashboard's connection to a localhost app. Deployed apps are unaffected.

```bash
npm run typecheck
npm run build
npm run deploy    # → the organization Dashboard
```

## How it is put together

| File | Job |
| --- | --- |
| `src/App.tsx` | `SanityApp` provider, project config, Suspense shell |
| `src/Desk.tsx` | platform accounts (one `useQuery`) and the filter bar |
| `src/PostList.tsx` | `useDocuments` → a handle per post, each in its own Suspense boundary |
| `src/PostCard.tsx` | `useDocumentProjection` to read, `useEditDocument` to write |
| `src/VariantCard.tsx` | presentational — no data hooks, so one fetch per post rather than per variant |
| `src/lib/assets.ts` | asset references → CDN URLs, no fetch required |

Two decisions in there are worth explaining.

**Reads go through a projection; writes go through a functional update.** The
projection selects only some of each variant's fields. Writing that array back
would drop the ones it did not ask for — the assets, most destructively. So
`useEditDocument` is called *without* a path and handed a function: the `current`
it receives is the real document from the store, not anything this component
read, so the array being mapped over is complete and only `status` changes.

**Accounts are fetched once, at the top.** preflight refuses a variant whose
platform has no configured account, and that answer is identical for every post
on the page. This is the one place raw GROQ earns its keep over handles and
projections — it is a query across a document type, not a per-document read.

## Known gaps

- **Not yet opened against the live dataset.** It typechecks and builds, and the
  compiler confirms the hook signatures, but the queue has not been rendered in
  the Dashboard. The projection's field names come from reading the CMS schema, so
  a wrong one would show as a blank field rather than an error.
- **Video duration is never checked.** Sanity stores no duration in asset
  metadata and nothing here decodes a file, so preflight takes its "could not
  read how long this runs" branch and warns instead of blocking. The Studio
  measures it in the browser and will refuse a clip this lets through.
- **No real platform chrome.** The CMS has four hand-built platform mock-up
  components; this shows a thumbnail plus the caption against the correct ceiling
  instead. Rendering the real ones means pulling in `@sanity/ui` and
  styled-components.
- **13 of the limits it enforces are still marked `verified: false`** in the
  CMS's `platformSpec.ts` — the caption and hashtag ceilings, the video
  durations, and all of Facebook. `npm run vendor` lists them. They were advisory
  when only a preview read them; here they block approval.
- **Filtering happens after fetching**, not in the query, and there is no
  pagination past a "Load older posts" button.
- **One project only.** The SDK supports many; this is configured with one.
