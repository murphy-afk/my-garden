# Agent Rules

Binding rules for anyone or anything working on this repository. They apply to code, documentation, commit messages, comments, tests and UI copy.

## Writing

- **No emojis anywhere.** Not in source, not in UI strings, not in markdown, not in commit messages. If a visual indicator is needed, use an icon from the icon library.
- **No emdashes.** Do not use the em dash character. Do not use the en dash as a substitute for punctuation either. Split the sentence or use a comma, colon or parentheses.
- **No line that consists only of `>` or `/>`.** Close JSX tags on the line before. Write `<Component />` on one line, or open and close on the same line. Never leave a dangling closing bracket on its own line.

There is no formatter in this project, so this rule rests on how JSX is written by hand. Keep a tag short enough to fit on one line. When a tag genuinely has to span lines, attach the closing bracket to the last attribute line, for example `session={session} />`, instead of dropping it onto a line of its own. If a tag is too long to do that, shorten it by extracting the expression into a variable or a small helper function.

Good:

```tsx
<img src={src} alt={alt} />
```

```tsx
<Section>
  <Header />
</Section>
```

Bad, and all three forms are rejected:

- An opening tag on one line with a closing tag alone on the next line.
- A self closing tag indented on its own line under a parent.
- A bare `</>` on its own line.

Rewrite any of those as a single line, or keep the parent open and close the child on the line where it opens.

## Git

- **Never commit without explicit permission.** No commits, no pushes, no rebases, no force pushes unless the user has clearly said so in the current conversation. Asking once does not grant permission for later commits.
- **Commit messages describe the change, not the plan.** Say what was done, for example "add garden area layout" or "track seed saving after harvest". Never prefix a message with a session number such as `S03:`, and do not refer to roadmap sessions anywhere in a message.
- Do not delete or rewrite files the user created without asking first.

## Scope

- Keep each session small and finish it in a working state before moving on.
- Follow the session boundaries in `ROADMAP.md`. Do not start the next session's work inside the current one unless asked.
- State assumptions out loud instead of guessing when a requirement is ambiguous.

## Icons

- Icons come from lucide-react. Never substitute a unicode symbol, a text arrow or an emoji for an icon.
- An icon that carries meaning needs an accessible label, either `aria-label` or a visible text label.

## Code

- TypeScript strict mode on both `client` and `server`.
- No `any` unless there is a written reason next to it.
- All API input is validated on the server before it touches the database.
- All database writes go through the transaction helper.
- Errors reach the standard JSON error shape. Do not swallow exceptions.
- No secrets in the repository. Configuration comes from environment variables, and `.env.example` documents every variable.

## UI

- **No CSS framework.** Styling is plain CSS. Do not add Tailwind, Bootstrap, Styled Components or any utility CSS library to the project.
- Design tokens live as CSS custom properties in one place. Colors, spacing, type sizes, radii and shadows come from those variables, not from literal values repeated through stylesheets.
- One stylesheet per area of the app. Do not let a single global stylesheet grow without bound.
- Every form control has a label.
- Every list, form and chart has a loading state, an empty state and an error state.
- Keyboard navigation works on every interactive element.
