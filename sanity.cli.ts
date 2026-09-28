import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  app: {
    organizationId: 'o8u0l0nzs',
    entry: './src/App.tsx',
    // Named here rather than passed as --title, so every redeploy targets the
    // same app instead of needing the flag remembered. Once deployed, the CLI
    // writes back a deployment.appId and this becomes belt and braces.
    title: 'Review desk',
  },
  // Written back by the first `sanity deploy`. Without it, every deploy creates
  // ANOTHER application rather than updating this one.
  deployment: {
    appId: 'zdaen7jtg76lgmdoy1dn71h4',
  },
})
