# CONQUER — Working method for changes and deployments

- Start every implementation on a feature/fix branch created from an updated `main`. Make as many incremental commits as needed for development and debugging; do not push work-in-progress directly to `main`.
- Run relevant checks and GitHub Actions CI on the development branch. Fix failures there before proposing a merge. CI checks do **not** require a Vercel deployment.
- When a feature is ready and verified, open a pull request to `main` and merge it (prefer a squash merge to keep the release history legible). Avoid multiple intermediate merges for the same iteration.
- Automatic **Vercel** deployments are reserved for commits reaching `main`. This is set in the root `vercel.json` using `git.deploymentEnabled`. Do not reactivate automatic preview builds without an explicit request.
- For an on-demand visual preview, use Vercel Dashboard > Deployments > Create Deployment from the relevant feature branch or commit SHA. This should be intentional, not triggered by each intermediate commit.
- Existing feature branches created before this convention may not contain `vercel.json`; bring them up to date with `main` before further pushes to ensure the deployment filter is present.
- Keep GitHub Actions testing separate from Vercel build/deployment costs. Do not disable CI to save Vercel build minutes.
- Do not merge incomplete features solely to obtain a preview; request a one-off preview instead.

Goal: many development commits and CI checks, **one automatic production deployment per completed iteration**.
