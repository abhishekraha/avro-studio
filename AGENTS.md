# Workspace Rules

## Git & Release Guardrails
- **NEVER push directly to `master` or `main`**: Direct pushes to `master`/`main` are strictly forbidden.
- Always create and switch to a `feature/*` branch (e.g. `feature/my-feature-name`).
- Always push feature branches to remote (`git push -u origin feature/...`), never `master`.
- Merging to `master` is only performed via Pull Request.
