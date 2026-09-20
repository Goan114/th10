# TH10 Presentation Lab adapter

This directory contains only TH10 runtime and observation semantics. The
controller, normalized analyzer, report format and eventual UI/server are
owned by the pinned `third_party/eagler-common` revision.

Current implementation milestone: isolated diagnostic build/package profile,
non-destructive freeze/resume, complete fixed-tick driver, original reference
frames and normalized ANM submission records. The owner registry, draw-only
state-purity evidence, untextured custom geometry and automatic Replay
navigation are explicitly incomplete and must not be reported as a finished
title adaptation.

The common workbench and TH10 loopback server are wired, but require a fresh
diagnostic build/package before launch.  `start-lab.ps1 -Build` performs that
isolated build; it never opens a browser window.
