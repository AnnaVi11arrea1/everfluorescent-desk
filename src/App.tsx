import {type SanityConfig} from '@sanity/sdk'
import {SanityApp} from '@sanity/sdk-react'
import {Suspense} from 'react'
import {Desk} from './Desk'
import './App.css'
import './desk.css'

/**
 * The review desk.
 *
 * Claude drafts posts into this project and leaves every variant at
 * `needs_review`. This app is where a person moves them forward — approve, or
 * hand back — so the agent and the human write the same `variant.status` field
 * and pass through the same gate.
 *
 * Why an app rather than another Studio pane: the Studio edits one document at a
 * time, and a review queue is the opposite shape. The thing needing a decision
 * is one PLATFORM VARIANT, and a post holds several of them. This lists variants
 * across every post, each carrying the verdict from the same preflight code the
 * Studio's publish button runs, and writes the decision straight back. Live by
 * default, so a draft the agent writes while this is open simply appears.
 */
function App() {
  const sanityConfigs: SanityConfig[] = [
    {
      projectId: '70komvgl',
      dataset: 'production',
    },
  ]

  return (
    <div className="app-container">
      <SanityApp
        config={sanityConfigs}
        fallback={<Loading label="Connecting to the content lake" />}
      >
        <Suspense fallback={<Loading label="Reading the queue" />}>
          <Desk />
        </Suspense>
      </SanityApp>
    </div>
  )
}

export function Loading({label}: {label: string}) {
  return (
    <div className="desk-loading">
      <span className="desk-spinner" aria-hidden="true" />
      {label}…
    </div>
  )
}

export default App
