#!/usr/bin/env python3
"""Export the committed handoff plus complete Git history, without machine state."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path, help='ZIP destination outside the repository')
args = parser.parse_args()
output = args.output.expanduser().resolve()
if root == output or root in output.parents:
    parser.error('Choose a destination outside the repository.')
if output.exists():
    parser.error('Destination already exists; choose a new name.')
if subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=root).strip():
    parser.error('Commit tracked changes first so the ZIP and history agree.')
paths = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
paths = [p for p in paths if p]
for p in paths:
    if any(part in {'.git', 'node_modules', 'dist', '__MACOSX', '.DS_Store'} or part.startswith('.env') or part.startswith('._') for part in Path(p).parts):
        parser.error('Unexpected machine/secret file tracked: ' + p)
manifest = []
output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='truemark-handoff-') as temporary:
    bundle = Path(temporary) / 'all-versions.bundle'
    subprocess.run(['git', 'bundle', 'create', str(bundle), '--all'], cwd=root, check=True)
    subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=root, check=True, capture_output=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for p in paths:
            content = (root / p).read_bytes()
            archive.writestr('TrueMark/' + p, content)
            manifest.append({'path': 'TrueMark/' + p, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
        archive.write(bundle, 'TrueMark/all-versions.bundle')
        archive.writestr('TrueMark/PACKAGE-MANIFEST.json', json.dumps(manifest, indent=2) + '\n')
        archive.writestr('TrueMark/RESTORE-HISTORY.txt', 'Read START_HERE.md first. Source files are usable as-is.\nTo restore all Git versions in a separate directory:\ngit clone --branch codex/handoff-full all-versions.bundle ../TrueMark-with-history\nThe bundle includes private client source material. Do not upload it publicly without authorization.\n')
with zipfile.ZipFile(output) as archive:
    bad = archive.testzip()
    if bad:
        raise RuntimeError('ZIP verification failed: ' + bad)
print(json.dumps({'archive': str(output), 'files': len(paths), 'bytes': output.stat().st_size, 'verified': True}, indent=2))
