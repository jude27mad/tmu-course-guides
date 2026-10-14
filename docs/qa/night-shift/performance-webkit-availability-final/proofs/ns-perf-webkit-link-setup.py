#!/usr/bin/env python3
"""Verify extracted official package bytes and link task-local WebKit dependencies; no browser launch."""
import argparse
import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile

PREFIX = Path('/tmp/ns-perf-webkit-libs/usr/lib/x86_64-linux-gnu')
DEBS = Path('/tmp/ns-perf-webkit-debs')
BUNDLE = Path('/tmp/ns-perf-ci-browsers/webkit-2370')
PACKAGES = {'libgles2', 'libgraphene-1.0-0', 'libgtk-4-1', 'libharfbuzz-icu0', 'libhyphen0', 'libmanette-0.2-0', 'libhidapi-hidraw0', 'libcairo-script-interpreter2', 'liblzo2-2'}

def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):digest.update(chunk)
    return digest.hexdigest()

def save(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + '\n')

def snapshot(path):
    return {'path': str(path), 'realPath': str(path.resolve(strict=True)), 'sha256': sha(path), 'bytes': path.stat().st_size,
        'linkTarget': os.readlink(path) if path.is_symlink() else None}

def private_new(path):
    path = Path(path).resolve()
    if not path.is_relative_to(Path('/tmp')) or path == Path('/tmp') or path.exists():raise RuntimeError('A new private /tmp evidence file is required')
    return path

def prepare(dependency_manifest, baseline_path, output, prior_setup=None):
    baseline_path, output = private_new(baseline_path), private_new(output)
    evidence = json.loads(Path(dependency_manifest).read_text())
    prior = json.loads(Path(prior_setup).read_text()) if prior_setup else None
    if prior and sha(prior['baseline']['path']) != prior['baseline']['sha256']:raise RuntimeError('Original wrapper baseline changed')
    prior_links = {item['destinationPath']: item for item in prior['links']} if prior else {}
    known = {item['name']: item for item in evidence['packages']}
    expected, packages, seen = {}, [], set()
    for package in sorted(DEBS.glob('*.deb')):
        name = subprocess.check_output(['dpkg-deb', '--field', str(package), 'Package'], text=True).strip()
        if name not in PACKAGES:raise RuntimeError('Unexpected package in approved dependency directory: ' + name)
        if name in seen:raise RuntimeError('Ambiguous package version: ' + name)
        seen.add(name)
        item = snapshot(package)
        item.update(name=package.name, package=name, version=subprocess.check_output(['dpkg-deb', '--field', str(package), 'Version'], text=True).strip())
        if package.name in known and (known[package.name]['sha256'] != item['sha256'] or known[package.name]['bytes'] != item['bytes']):raise RuntimeError('Previously recorded official package bytes changed')
        packages.append(item)
        data = subprocess.check_output(['dpkg-deb', '--fsys-tarfile', str(package)])
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            for member in archive.getmembers():
                relative = member.name.removeprefix('./')
                if not relative.startswith('usr/lib/x86_64-linux-gnu/') or '/' in relative.removeprefix('usr/lib/x86_64-linux-gnu/'):continue
                basename = Path(relative).name
                if member.isfile():
                    contents = archive.extractfile(member).read()
                    if not contents.startswith(b'\x7fELF'):continue
                    expected[basename] = {'sha256': hashlib.sha256(contents).hexdigest(), 'package': package.name, 'symlink': None}
                elif member.issym():expected[basename] = {'package': package.name, 'symlink': member.linkname}
    if seen != PACKAGES:raise RuntimeError('All nine approved packages are required')
    libraries = []
    for name, item in sorted(expected.items()):
        source = PREFIX / name
        if not source.resolve(strict=True).is_relative_to(PREFIX.resolve()):raise RuntimeError('Dependency escapes approved prefix')
        if item['symlink'] is not None:
            if not source.is_symlink() or os.readlink(source) != item['symlink']:raise RuntimeError('Package SONAME alias changed: ' + name)
            target = expected.get(Path(item['symlink']).name)
            if not target or item.get('sha256', target.get('sha256')) != sha(source):raise RuntimeError('Alias content differs from package: ' + name)
        elif source.is_symlink() or sha(source) != item['sha256']:raise RuntimeError('Extracted ELF content differs from official package: ' + name)
        dynamic = subprocess.check_output(['readelf', '-d', str(source)], text=True)
        match = re.search(r'\(SONAME\).*\[([^]]+)\]', dynamic)
        if not match:raise RuntimeError('ELF SONAME missing: ' + name)
        libraries.append({**snapshot(source), 'sourcePath': str(source), 'soname': match.group(1), 'package': item['package']})
    actual = {path.name for path in PREFIX.iterdir() if path.is_file()}
    if actual != set(expected):raise RuntimeError('Unbound top-level extracted dependency files')
    preserved_paths = {BUNDLE / 'pw_run.sh'}
    stock = []
    for flavor in ('gtk', 'wpe'):
        directory = BUNDLE / ('minibrowser-' + flavor)
        preserved_paths.add(directory / 'MiniBrowser')
        preserved_paths.update(path for branch in ('bin', 'lib', 'sys/lib') for path in (directory / branch).iterdir() if path.is_file())
        stock.extend(snapshot(path) for path in (directory / 'sys/lib').iterdir() if path.is_file())
    preserved = [snapshot(path) for path in sorted(preserved_paths)]
    if prior:
        for item in prior['preservedExecutables']:
            if snapshot(Path(item['path'])) != item:raise RuntimeError('Original bundled wrapper, ELF or stock library changed')
        preserved = prior['preservedExecutables']
    baseline = {'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'preservedExecutables': preserved, 'stockSysLibrariesBefore': stock}
    save(baseline_path, baseline)
    links = []
    for flavor in ('gtk', 'wpe'):
        destination_root = BUNDLE / ('minibrowser-' + flavor) / 'sys/lib'
        if not destination_root.resolve(strict=True).is_relative_to(BUNDLE.resolve()):raise RuntimeError('Bundle sys/lib escapes approved root')
        for item in libraries:
            source = Path(item['sourcePath'])
            destination = destination_root / source.name
            if destination.exists() or destination.is_symlink():
                old = prior_links.get(str(destination))
                if not old or snapshot(destination) != {key: old[key] for key in ('path', 'realPath', 'sha256', 'bytes', 'linkTarget')} or os.readlink(destination) != str(source):raise RuntimeError('Refuse overwrite or unproven existing bundle dependency: ' + str(destination))
            else:destination.symlink_to(source)
            linked = snapshot(destination)
            if linked['realPath'] != item['realPath'] or linked['sha256'] != item['sha256']:raise RuntimeError('Linked dependency differs')
            links.append({**linked, 'destinationPath': str(destination), 'sourcePath': str(source), 'soname': item['soname'], 'package': item['package']})
    for item in preserved:
        if snapshot(Path(item['path'])) != item:raise RuntimeError('Bundled wrapper, ELF or stock library changed')
    ldd = []
    for flavor in ('gtk', 'wpe'):
        directory = BUNDLE / ('minibrowser-' + flavor)
        environment = os.environ.copy()
        environment['LD_LIBRARY_PATH'] = str(directory / 'lib') + ':' + str(directory / 'sys/lib')
        argv = ['ldd', str(directory / 'bin/MiniBrowser')]
        result = subprocess.run(argv, env=environment, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
        log = output.with_name(output.stem + '-' + flavor + '-ldd.log')
        log.write_text(result.stdout)
        ldd.append({'argv': argv, 'LD_LIBRARY_PATH': environment['LD_LIBRARY_PATH'], 'actualExitCode': result.returncode, 'log': str(log), 'sha256': sha(log), 'missing': [line.strip() for line in result.stdout.splitlines() if 'not found' in line]})
    verified = all(item['actualExitCode'] == 0 and not item['missing'] for item in ldd)
    manifest = {'schemaVersion': 1, 'status': 'verified' if verified else 'dependency-resolution-failed', 'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'libraryDirectory': str(PREFIX), 'dependencyManifest': {'path': str(Path(dependency_manifest).resolve()), 'sha256': sha(dependency_manifest)},
        'packages': packages, 'libraries': libraries, 'links': links, 'preservedExecutables': preserved,
        'baseline': {'path': str(baseline_path), 'sha256': sha(baseline_path)}, 'stockSysLibrariesBefore': stock, 'ldd': ldd,
        'originalSetup': {'path': str(Path(prior_setup).resolve()), 'sha256': sha(prior_setup), 'baseline': prior['baseline']} if prior else None,
        'script': {'path': str(Path(__file__).resolve()), 'sha256': sha(__file__)},
        'scope': 'Only task-local official ELF/SONAME symlinks were added in bundled WebKit sys/lib. All wrapper, binary, engine and pre-existing library bytes remain unchanged. ldd is read-only; no browser was launched.',
        'wrapperLDOverrideNote': 'Unchanged MiniBrowser wrappers replace LD_LIBRARY_PATH with lib:sys/lib. The WebKit Node-only prefix enables ordinary Playwright host validation and also reaches that invocation initial Chromium probe.'}
    save(output, manifest)
    print(json.dumps({'path': str(output), 'sha256': sha(output), 'status': manifest['status'], 'links': len(links), 'preservedExecutables': len(preserved), 'ldd': ldd}, indent=2))
    return 0 if verified else 2

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dependency-manifest', required=True)
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--prior-setup')
    args = parser.parse_args()
    raise SystemExit(prepare(args.dependency_manifest, args.baseline, args.output, args.prior_setup))
