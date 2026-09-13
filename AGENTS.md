# TH10 Eagler adaptation

This checkout adapts the C++/WASI baseline from `YomotsuHisami/th10` to
`eagler-touhou`. The Launcher owns the UI, cards, toolbar, touch controls,
Package Store and deployment. Do not use historical TH10 executors or evidence.

Read `../AGENTS.md`, `../WORKSPACE.md`, then the relevant primary playbook under
`../docs/agent/playbooks/` before source work. Adaptation entry: `docs/EAGLER_ADAPTATION.md`.

Keep game rules unchanged except the explicitly requested Eagler input adapter.
Reuse other works' protocol and controls. The upstream standalone page is not
the Eagler frontend; `site/th10.html` is only the canvas protocol carrier.
Never add original game DAT/BGM or private saves to Git.
