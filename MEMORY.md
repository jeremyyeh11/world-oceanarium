ALWAYS clarify with user if there are uncertainties.

WO Atlas prefs: straight camera; rotate creature for diagonal; fixed diver Z; show largest species size; soft filled backdrop tiles. Mobile Atlas: full-bleed square PC-style panels, natural touch scroll; no rounded/margined cards.

For World Oceanarium release judgement, user values a terse TLDR of main blockers: distinguish technical gates (build/CI/deploy/smoke) from visual/feel approval issues such as new asset review, animation mapping, sun-bask smoothness, and phone pass.

WO workflow: feature dev uses separate worktree/branch from latest `origin/main`; prefer `feat/...` branch names. Use visible `-dev` builds for review; rebase before merge/release. Only explicit `reju`/release approval authorizes clean promotion/merge/delete. Supabase creature DB rows use scientific/species-id slugs; service-role REST can update rows once columns exist, but schema/DDL needs SQL/DB migration access.

WO uses `ROADMAP.md` as source of truth for active TODOs/release blockers/review follow-ups. Add new TODO lists with dev patch/bucket refs; order current work first, then priority, then chronology; mark active items `Current in development`; remove/archive items after clean public release.

World Oceanarium review workflow: Jeremy’s in-chat approval/rejection is an authoritative release-review signal. Accepted items should be marked accepted/archive-candidate in `ROADMAP.md`; the next unaccepted blocker becomes the active dev item.

WO Atlas/copy: characterful but source-safe. Quant fields terse: plain numbers; meter ranges en dash; prose/count ranges “to”; “More than N”; “Up to N years”; “Unknown”; “N/A” if non-applicable. Qual fields concise/value-bearing; omit filler like “no noticeable feature”/“in the wild.”

WO debug UI prefs: flat full-width bottom toolbar; no bevel/glow/rounding/margins. Bone labels: billboard, normal/unbold, front-rendered, selected-name size. Forward debug vectors should start at nose/head even if fish transform rotates around mid-body GLB origin.

