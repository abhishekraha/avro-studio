# Project Guardrails & Workflow Rules

## Git Branching & Push Guardrail

1. **NEVER push directly to `master` or `main`**:
   - Pushing directly to `master` or `main` branch is strictly prohibited.
2. **Feature Branch Requirement**:
   - All changes must be developed or committed on a feature branch following the naming convention:
     - `feature/*` (e.g., `feature/arrow-styling-and-reset`)
   - Changes must be pushed to remote under the feature branch:
     ```bash
     git checkout -b feature/<descriptive-name>
     git push -u origin feature/<descriptive-name>
     ```
3. **Merging to Master & Pull Requests**:
   - Merging into `master` or `main` must only be done via Pull Request / Pull Request review, never by direct force push or direct push from local.
   - **PR Summaries**: When opening a Pull Request, always provide a clear, comprehensive summary of changes (features added, visual updates, fixes, documentation changes, and testing performed).
