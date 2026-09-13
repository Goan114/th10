# Original-asset boundary

[简体中文](ASSETS.md) | [English](ASSETS.en.md)

The project's source-code license does not cover original *Touhou 10* data, Simplified Chinese translation data, or other third-party assets. A public source repository should not commit `site/data`; `.gitignore` marks that directory as local content.

## Supplied by lawful owners

Users must prepare runtime data from a copy they lawfully possess and may use under applicable law and the original rights terms. Maintainers do not provide, locate, or relicense these files through the source repository.

A complete local runtime directory needs:

- `site/data/th10.dat`: Japanese game data;
- `site/data/th10c.dat`: optional Simplified Chinese game data;
- `site/data/thbgm/0000.bin` through `1540.bin`: original PCM music split into 262,144-byte chunks.

`site/manifest.json` and `release.json` record exact hashes, total music length, and chunk size. `scripts/verify.mjs` checks this content. A source-only checkout without local assets cannot pass full-distribution verification or run as a complete playable package.

## Public source repository versus complete local package

| Content | Public source repository | Lawful owner's complete local package |
| --- | --- | --- |
| C++, browser host, build scripts, and documentation | Included | Included |
| Built project Wasm | May be included by release policy | Included |
| Original DAT, BGM, and translation data | Excluded | Prepared locally by the owner |
| Replay results and hashes | May be included | Included |
| `.rpy` files without redistribution permission | Excluded | May be verified locally |

The current working directory is a complete local package with assets already prepared. `.gitignore` affects only future Git tracking and does not delete local files. Lawful owners may still use `scripts/package.py` to create their own local complete archive.

Do not upload a complete local archive, `site/data`, or original replay files to a public release, object store, or CDN unless the uploader actually holds the necessary redistribution rights.

