"""Repackage this standalone repository without private or temporary files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import json

root = Path(__file__).resolve().parent.parent
excluded = {'.git', '.codex', '.agents', 'node_modules', '__pycache__', 'artifacts', 'dist'}
def included(path):
    rel = path.relative_to(root)
    if any(part in excluded for part in rel.parts):
        return False
    if rel.parts[:2] == ('source', 'tools'):
        return False
    name = path.name.lower()
    return not (name.startswith('.env') or name in {'cloudflared-token.txt', 'processes.json'}
                or name.endswith(('.zip', '.sha256', '.pyc', '.tmp', '.pem', '.key', '.orig')))

parser = argparse.ArgumentParser(description='Verify or refresh checksums and optionally build the standalone repository archive.')
mode = parser.add_mutually_exclusive_group()
mode.add_argument('--checksums-only', action='store_true', help='refresh SHA256SUMS.json without creating a ZIP')
mode.add_argument('--verify-checksums', action='store_true', help='verify files against SHA256SUMS.json without changing anything')
args = parser.parse_args()

files = sorted(p for p in root.rglob('*') if p.is_file() and included(p) and p.name != 'SHA256SUMS.json')
inventory = root / 'SHA256SUMS.json'
checksums = {p.relative_to(root).as_posix(): hashlib.file_digest(p.open('rb'), 'sha256').hexdigest() for p in files}
if args.verify_checksums:
    expected = json.loads(inventory.read_text(encoding='utf-8'))
    missing = sorted(set(expected) - set(checksums))
    unexpected = sorted(set(checksums) - set(expected))
    changed = sorted(name for name in set(expected) & set(checksums) if expected[name] != checksums[name])
    if missing or unexpected or changed:
        print(json.dumps({'verified': False, 'missing': missing, 'unexpected': unexpected, 'changed': changed}, ensure_ascii=False, indent=2))
        raise SystemExit(1)
    print(json.dumps({'verified': True, 'inventory': str(inventory), 'files': len(files)}, ensure_ascii=False))
    raise SystemExit(0)
inventory.write_text(json.dumps(checksums, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
files.append(inventory)
if args.checksums_only:
    print(json.dumps({'inventory': str(inventory), 'entries': len(checksums)}, ensure_ascii=False))
    raise SystemExit(0)
target = root.parent / 'th10_cpp_2.0.0_full_source.zip'
with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(files):
        archive.write(path, 'th10_cpp/' + path.relative_to(root).as_posix())
digest = hashlib.file_digest(target.open('rb'), 'sha256').hexdigest()
(target.parent / (target.name + '.sha256')).write_text(digest + '  ' + target.name + '\n', encoding='ascii')
print(json.dumps({'file': str(target), 'bytes': target.stat().st_size, 'files': len(files), 'sha256': digest}, ensure_ascii=False))
