---
name: prod-hotfix
description: Create and deploy a production hotfix from the currently deployed release, with selected commits cherry-picked onto it.
disable-model-invocation: true
---

# Production hotfix

Use this skill only after the user explicitly authorizes creating or deploying a production hotfix. Treat the hotfix as a release operation: preserve the deployed base, make the commit set auditable, and stop at every deployment gate until the user authorizes crossing it.

## Inputs

Collect or confirm:

- target: `prod` for the production hotfix workflow
- hotfix name: a short lowercase suffix such as `apt-5347-sparse`
- source commit SHAs to cherry-pick
- deployment scope: create the hotfix only, or also trigger production deployment

Use full SHAs when possible. Exclude merge commits; cherry-pick the substantive commits in dependency/chronological order, oldest first.

## Workflow

### 1. Resolve and pin the production base

1. Query the latest successful GitLab `prod` deployment and record its `ref` and `sha`.
2. Query the latest GitLab Release object as well. The production hotfix script uses the latest Release object, not the deployments endpoint, as its base.
3. Reconcile the two results. They should identify the same successfully deployed release. If they differ, stop and report the mismatch.
4. Confirm every requested source SHA exists in the project and inspect its subject before triggering anything.

Completion criterion: the base release tag, base SHA, and ordered source commit list are recorded and user-confirmed.

### 2. Preview the hotfix

Trigger the project pipeline on `main` with these variables:

```text
HOTFIX_NAME=<suffix>
COMMIT_SHAS=<sha1>,<sha2>,...
TARGET=prod
DRY_RUN=true
HOTFIX_GITLAB_TOKEN=<personal token with api scope>
```

Use project `44904904`. The pipeline is the `Create Hotfix Release` job from `.ci/scripts/create_hotfix.py`.

Inspect the dry-run output. It must show:

- branch `<base-release>-<hotfix-name>`
- the intended commits in the intended order
- a newly generated date-based release tag
- the tag pipeline URL

Completion criterion: the dry run matches the intended base, branch, commits, and target.

### 3. Create the hotfix

Trigger the same pipeline with `DRY_RUN=false`. The CI script will:

1. Create the hotfix branch from the latest production Release tag.
2. Cherry-pick each requested SHA in the supplied order.
3. Create the next `release-YYYY-MM-DD[-N]` annotated tag.
4. Start the tag pipeline.

Poll the `Create Hotfix Release` job to a terminal state. On failure, fetch its trace and stop; do not retry blindly because branch/tag creation is not necessarily atomic.

Completion criterion: the job succeeds and its output names the branch and release tag.

### 4. Validate the resulting refs before deployment

Fetch the branch and tag metadata. Verify:

- the branch starts at the intended deployed base
- the branch contains one new cherry-picked commit for each requested source commit
- the cherry-picked commits appear in the requested order
- the release tag points to the final hotfix commit
- no unexpected commits are present

Link both the original source commits and the new cherry-picked commits. Cherry-picking preserves the patch and author metadata but creates new commit SHAs and a new committer timestamp.

Completion criterion: the final tag's ancestry and commit subjects match the approved hotfix set exactly.

### 5. Prepare and share the Slack handoff

Before deployment, prepare the message for the team's Slack hotfix announcement. Do not post it to Slack; return it to the user for copy/paste. Use exactly this compact format:

```text
- Pipeline: <tag-pipeline-url>
- Commits: https://gitlab.com/h3upperbounds/data/data-team/-/compare/<base-release>...<hotfix-branch>?from_project_id=44904904
```

Use the actual tag pipeline URL and the actual base release and hotfix branch names. The compare link must compare the deployed base release to the hotfix branch, not `main` to the hotfix branch.

Completion criterion: the Slack message contains working Pipeline and Commits links and is returned to the user ready to paste.

### 6. Deploy only through the manual gate

Open the generated tag pipeline and review the jobs. Production deployment is not automatic merely because the tag exists. The tag pipeline contains a manual `Trigger Prod Deploy` gate; that gate covers the production markets, including Prod-US.

If the user authorized deployment, trigger `Trigger Prod Deploy`. Otherwise, stop after sharing the branch, commit, and pipeline links.

Completion criterion: either the pipeline is handed to the user at the manual gate, or the authorized production deployment reaches a terminal successful state.

### 7. Verify production

After deployment:

1. Confirm the relevant Prod-US deploy jobs succeeded.
2. Query the GitLab deployments API for the latest successful `prod` deployment.
3. Confirm its `ref` is the new release tag and its `sha` is the hotfix tag commit.
4. Confirm the GitLab Release object appears only after the production release jobs succeed.
5. Report the release tag, final SHA, pipeline URL, deployment time, and any failed or pending jobs.

Completion criterion: the deployments API identifies the new hotfix tag as the latest successful production deployment.

## Repository-specific facts

- Project: `h3upperbounds/data/data-team`, GitLab project ID `44904904`.
- Prod-US is represented by GitLab environment `prod`.
- `.ci/scripts/create_hotfix.py` is the authoritative automated hotfix implementation.
- `./dt create-hotfix <name> [--tag <tag>]` only checks out the release tag and creates a local branch; it does not cherry-pick commits, create the release tag, or start deployment.
- `.ci/configs/hotfix.yml` runs the creation script when the pipeline is triggered with `HOTFIX_NAME`.
- `.ci/configs/trigger_deploy.yml` makes `Trigger Prod Deploy` manual for release tags.
- Do not create a GitLab Release object manually. The release job creates it only after the production deployment succeeds.

## Failure handling

- If the active deployment changed after base resolution, stop and re-resolve before creating anything.
- If a cherry-pick conflicts or the hotfix job fails, stop and inspect the branch/tag state before retrying.
- If the branch/tag does not contain exactly the requested commits, do not click `Trigger Prod Deploy`.
- If the browser is unavailable, provide direct GitLab URLs instead of claiming tabs were opened.
