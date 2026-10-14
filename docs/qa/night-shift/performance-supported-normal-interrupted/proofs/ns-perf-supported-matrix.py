#!/usr/bin/env python3
"""Private supported-environment verifier; ordinary QA CLIs only, never browser wrappers."""
from __future__ import annotations
import argparse
import datetime as dt
import errno
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import time

ROOT = Path('/workspace/tmu-course-guides')
REPORTS = ROOT / 'tools/qa/reports'
CAPTURE = Path('/tmp/ns-perf-environment-source-capture.mjs')
DRIVER = '/tmp/ns-perf-ci-driver/node_modules/playwright'
BROWSERS = '/tmp/ns-perf-ci-browsers'
CHECKS = ('perf', 'routes', 'stability', 'frames', 'deadlines', 'modes', 'layout', 'webkit', 'nojs', 'bfcache', 'failures', 'crosstab', 'clock', 'forward')
BASES = ('/', '/tmu-course-guides/')
SOURCE_HASHES = {
    'tools/qa/checks-resilience.mjs': 'db77a8d9fa49683f6370c87fc1794dbec247bc3c95cf524fee1d5d58d12e0de8',
    'tools/qa/checks.mjs': 'e1cc6550f304cd30d092cfcc34a78548365ce3c9b06e2f9ea6b53f1c1deee9ca',
    'tools/qa/checks-perf.mjs': '56d2ab6a4ee6af66722301ee131952d3c4fb16e0eba016f70a75d1fbd4fc3657',
    'tools/qa/runtime.mjs': 'a8715a046c02b1e095e8600a29f3c2a39b7b93816d0c0a5fae61f95295bd9587',
    'tools/qa/instrument.mjs': 'd377323d6c2e434f7e488a8c40c5b93d983ae724aab741dfa95f4f606e9fb892',
}
ENTRY_HASH = 'd8894931aef10f795774fbc5cd4e3c7f8ccf547569a534a46006e8a362002621'
PRODUCT = '1795468f427084977fac5a0707eef0b14e461c8d2041cb9c6d1e0315de48851f'
PROTECTED = 'c428377743e2e8a1ee386c55882e182d3b8e750ade67b1bd2b65835c210e0481'
SOFTWARE_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
REMOVED_ENV = ('QA_CHROMIUM_PATH', 'QA_PERF_RECORD', 'QA_PERF_BASELINE', 'PLAYWRIGHT_LEGACY_SCREENSHOT')
WEBKIT_LIBRARY_DIR = '/tmp/ns-perf-webkit-libs/usr/lib/x86_64-linux-gnu'

class IntegrityError(RuntimeError):
    pass

class Interrupted(BaseException):
    def __init__(self, number):
        self.number = number
        super().__init__('Orchestrator received ' + signal.Signals(number).name)

def signal_handler(number, _frame):
    raise Interrupted(number)

def utc():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')

def timestamp(value):
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (AttributeError, ValueError) as error:
        raise IntegrityError('Invalid actual timestamp') from error

def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def save(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')
    temporary.replace(path)

def load(path):
    return json.loads(Path(path).read_text(), parse_constant=lambda value: (_ for _ in ()).throw(IntegrityError('Nonfinite JSON: ' + value)))

def environment():
    env = os.environ.copy()
    for name in REMOVED_ENV:
        env.pop(name, None)
    env.update(PLAYWRIGHT_PATH=DRIVER, PLAYWRIGHT_BROWSERS_PATH=BROWSERS, QA_GPU='0', QA_NAV_DIAGNOSTICS='1',
               NS_QA_REQUIRE_VERSION='1.64.0', NS_QA_REQUIRE_BUNDLED='1')
    return env

def case_environment(env, check):
    result = dict(env)
    result.pop('NS_QA_WEBKIT_DEPENDENCIES', None)
    if check == 'webkit':
        prior = env.get('LD_LIBRARY_PATH')
        result['LD_LIBRARY_PATH'] = WEBKIT_LIBRARY_DIR + (':' + prior if prior else '')
        result['NS_QA_WEBKIT_DEPENDENCIES'] = env['NS_QA_WEBKIT_SETUP_PATH']
    return result

def validate_setup_hash(env):
    if env.get('NS_QA_WEBKIT_SETUP_PATH') and sha(env['NS_QA_WEBKIT_SETUP_PATH']) != env['NS_QA_WEBKIT_SETUP_SHA']:
        raise IntegrityError('Approved WebKit setup manifest changed')

def planned_cases():
    return [(check, base) for check in CHECKS for base in BASES]

def validate_source(record, master=None, check=None, setup=None):
    entries = record.get('sources', [])
    if len(entries) != 5 or {entry['path']: entry['sha256'] for entry in entries} != SOURCE_HASHES:
        raise IntegrityError('Current five QA sources changed')
    if record.get('entryPoint', {}).get('sha256') != ENTRY_HASH or record.get('productFingerprint') != PRODUCT or record.get('protectedFingerprint') != PROTECTED:
        raise IntegrityError('Entry point, product or protected source changed')
    driver = record.get('driverIdentity', {})
    for name in ('playwright', 'core'):
        item = driver.get(name, {})
        if item.get('version') != '1.64.0' or not all(isinstance(item.get(field), str) and len(item[field]) == 64 for field in ('packageSHA256', 'entrySHA256')):
            raise IntegrityError('Exact driver/core identity missing')
    if record.get('loader') != {'modulePath': DRIVER, 'source': 'PLAYWRIGHT_PATH'} or record.get('executableSource') != 'Playwright bundled Chromium':
        raise IntegrityError('Driver or executable fallback is forbidden')
    identity = record.get('browserIdentity', {})
    if not str(identity.get('binaryPath', '')).startswith(BROWSERS + '/') or len(identity.get('binarySHA256', '')) != 64:
        raise IntegrityError('Actual bundled binary identity missing')
    manifest = identity.get('browserManifest', {})
    if len(manifest.get('sha256', '')) != 64 or not manifest.get('chromium', {}).get('browserVersion'):
        raise IntegrityError('Declared bundled Chromium version missing')
    env = record.get('environment', {})
    if any(env.get(name) is not None for name in REMOVED_ENV) or env.get('PLAYWRIGHT_PATH') != DRIVER or env.get('PLAYWRIGHT_BROWSERS_PATH') != BROWSERS or env.get('QA_GPU') != '0' or env.get('QA_NAV_DIAGNOSTICS') != '1':
        raise IntegrityError('Unexpected launch environment')
    if record.get('launchOptions', {}).get('args') != SOFTWARE_ARGS:
        raise IntegrityError('Ordinary SwiftShader arguments changed')
    if check == 'webkit':
        original_ld = master.get('environment', {}).get('LD_LIBRARY_PATH') if master else None
        expected_ld = WEBKIT_LIBRARY_DIR + (':' + original_ld if original_ld else '')
        binding = record.get('webkitSetup', {})
        if not setup or env.get('LD_LIBRARY_PATH') != expected_ld or binding.get('path') != setup['path'] or binding.get('sha256') != setup['sha256'] or env.get('NS_QA_WEBKIT_DEPENDENCIES') != setup['path']:
            raise IntegrityError('Actual WebKit-only library/dependency binding missing')
    elif record.get('webkitSetup') is not None or env.get('NS_QA_WEBKIT_DEPENDENCIES') is not None:
        raise IntegrityError('WebKit dependencies must not alter other invocations')
    if master:
        for key in ('sources', 'entryPoint', 'productFingerprint', 'protectedFingerprint', 'driverIdentity', 'browserIdentity', 'loader', 'launchOptions', 'executableSource', 'environment', 'node', 'platform', 'architecture'):
            actual, expected = record.get(key), master.get(key)
            if key == 'environment' and check == 'webkit':
                actual, expected = dict(actual), dict(expected)
                for field in ('LD_LIBRARY_PATH', 'NS_QA_WEBKIT_DEPENDENCIES'):
                    actual.pop(field, None);expected.pop(field, None)
            if actual != expected:
                raise IntegrityError('Source or environment continuity failed: ' + key)

def capture(path, env, node, prior=None):
    expected_sha = env.get('NS_QA_CAPTURE_SHA')
    if not expected_sha or sha(CAPTURE) != expected_sha:
        raise IntegrityError('Capture helper changed before use')
    args = [node, str(CAPTURE), str(path)] + ([str(prior)] if prior else [])
    with Path(str(path) + '.log').open('wb') as log:
        child = subprocess.run(args, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, check=False)
    if sha(CAPTURE) != expected_sha:
        raise IntegrityError('Capture helper changed during use')
    if child.returncode != 0:
        raise IntegrityError('Read-only source capture failed: ' + str(path))
    return load(path)

def processes():
    result = []
    for directory in Path('/proc').iterdir():
        if not directory.name.isdigit():
            continue
        try:
            argv = [value.decode(errors='replace') for value in (directory / 'cmdline').read_bytes().split(b'\0') if value]
            status = (directory / 'status').read_text()
            if not argv or '\nState:\tZ' in status:
                continue
            parent = int(next(line.split(':', 1)[1].strip() for line in status.splitlines() if line.startswith('PPid:')))
            cwd = str((directory / 'cwd').resolve())
        except (OSError, ValueError, StopIteration):
            continue
        result.append({'pid': int(directory.name), 'parent': parent, 'argv': argv, 'cwd': cwd})
    return result

def role(process):
    executable = Path(process['argv'][0]).name
    if executable in ('chrome', 'chromium', 'headless_shell', 'chrome-headless-shell'):
        return 'chromium'
    if executable in ('MiniBrowser', 'WebKitWebProcess', 'WebKitNetworkProcess', 'WebKitGPUProcess', 'WPEWebProcess', 'WPENetworkProcess'):
        return 'webkit'
    scripts = [Path(argument).name for argument in process['argv'][1:] if argument.endswith('.mjs')]
    if 'run.mjs' in scripts and process['cwd'] == str(ROOT):
        return 'qa-runtime'
    if 'preview-server.mjs' in scripts and process['cwd'] == str(ROOT):
        return 'preview'
    return None

def closure(ports=(), child_pid=None, process_rows=None, connector=None):
    rows = processes() if process_rows is None else process_rows
    relevant = [{**row, 'role': role(row)} for row in rows if role(row) is not None or row['pid'] == child_pid]
    port_results = []
    for port in sorted(set(ports)):
        if connector:
            code = connector(port)
        else:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
                connection.settimeout(0.4)
                code = connection.connect_ex(('127.0.0.1', port))
        port_results.append({'port': port, 'connectEx': code, 'expected': errno.ECONNREFUSED, 'refused': code == errno.ECONNREFUSED})
    record = {'recordedAt': utc(), 'childPID': child_pid, 'liveBrowserOrQARuntimeProcesses': relevant, 'ownedPreviewPorts': port_results}
    if relevant or any(not port['refused'] for port in port_results):
        raise IntegrityError('Browser/runtime or owned preview port remains active: ' + json.dumps(record))
    return record

def owned_processes(child_pid, rows):
    owned = {child_pid}
    while True:
        extended = owned | {row['pid'] for row in rows if row['parent'] in owned}
        if extended == owned:
            break
        owned = extended
    return [{**row, 'role': role(row)} for row in rows if row['pid'] in owned and role(row) is not None]

def preview_ports(rows):
    ports = set()
    for row in rows:
        if row.get('role') != 'preview':
            continue
        args = row['argv']
        for index, argument in enumerate(args):
            if argument == '--port' and index + 1 < len(args):
                ports.add(int(args[index + 1]))
    return ports

def find_raw(report_root, previous, pid):
    candidates = [path for path in report_root.iterdir() if path.is_dir() and path.name not in previous and path.name.endswith('-' + str(pid))]
    if len(candidates) != 1:
        raise IntegrityError('Own unique raw directory missing or ambiguous: ' + repr(candidates))
    return candidates[0]

def bind_raw(directory, check, base, child, before):
    summary = load(directory / 'summary.json')
    raw = load(directory / (check + '.json'))
    if summary.get('selection') != {'checks': [check], 'bases': [base], 'gpu': False, 'help': False}:
        raise IntegrityError('Raw selection does not match actual ordinary child argv')
    if directory.name != summary['startedAt'].replace(':', '-').replace('.', '-') + '-' + str(child['pid']):
        raise IntegrityError('Raw timestamp/PID directory mismatch')
    if not timestamp(before['recordedAt']) <= timestamp(child['spawnRequestedAt']) <= timestamp(summary['startedAt']) <= timestamp(summary['completedAt']) <= timestamp(child['waitObservedAt']):
        raise IntegrityError('Source/child/raw timestamps are not ordered')
    if raw.get('check') != check or raw.get('startedAt') != summary['startedAt'] or raw.get('completedAt') != summary['completedAt'] or raw.get('environment') != summary.get('environment'):
        raise IntegrityError('Raw check and summary binding differ')
    checks = summary.get('checks', [])
    if len(checks) != 1 or checks[0].get('name') != check or checks[0].get('cases') != raw.get('cases') or checks[0].get('status') != raw.get('status') or checks[0].get('failures') != raw.get('failures') or summary.get('errors') != raw.get('runErrors'):
        raise IntegrityError('Raw check payload does not match summary verbatim')
    if summary.get('exitCode') != child['actualExitCode']:
        raise IntegrityError('Actual subprocess exit differs from recorded summary')
    # Setup/runtime failures remain intact in raw copies and stop additional children.
    if child['actualExitCode'] not in (0, 1) or summary.get('status') not in ('passed', 'failed') or summary.get('errors'):
        raise IntegrityError('Setup/runtime/interruption integrity failure')
    if len(raw.get('cases', [])) != 1 or raw['cases'][0].get('base') != base:
        raise IntegrityError('One complete requested base record is required')
    case = raw['cases'][0]
    failures = sum(assertion.get('pass') is False for assertion in case.get('assertions', []))
    if any(type(assertion.get('pass')) is not bool for assertion in case.get('assertions', [])) or failures != case.get('failures') or failures != summary.get('failures') or failures != raw.get('failures'):
        raise IntegrityError('Raw assertion/failure counts are inconsistent')
    if case.get('observations', {}).get('cleanupErrors'):
        raise IntegrityError('Owning check resource cleanup failed')
    expected_status = 'failed' if failures else 'passed' if case.get('assertions') else 'skipped'
    if case.get('status') != expected_status or raw.get('status') != expected_status or summary['status'] != ('failed' if failures else 'passed') or child['actualExitCode'] != (1 if failures else 0):
        raise IntegrityError('Raw status/actual exit semantics are inconsistent')
    if expected_status == 'skipped' and not case.get('skipped'):
        raise IntegrityError('Unavailable feature requires its actual explicit skip')
    env = summary.get('environment', {})
    if env.get('playwrightPath') != DRIVER or env.get('playwrightSource') != 'PLAYWRIGHT_PATH' or env.get('chromiumPath') != before['launchOptions']['executablePath'] or env.get('chromiumSource') != 'Playwright bundled Chromium' or env.get('launchArgs') != SOFTWARE_ARGS or env.get('requestedMode') != 'SwiftShader':
        raise IntegrityError('Actual child browser/driver/ordinary launch binding failed')
    deployments = env.get('deployments', [])
    declared_version = before['browserIdentity']['browserManifest']['chromium']['browserVersion']
    if len(deployments) != 1 or deployments[0].get('base') != base or deployments[0].get('chromiumVersion') != declared_version:
        raise IntegrityError('Actual bundled version or deployment base differs')
    observed_gl = deployments[0].get('webgl', {})
    if deployments[0].get('requestedMode') != 'SwiftShader' or deployments[0].get('actualMode') != 'SwiftShader' or observed_gl.get('available') is not True or 'swiftshader' not in str(observed_gl.get('renderer', '')).lower():
        raise IntegrityError('Actual supported software renderer differs or is unavailable')
    classification = 'failed' if failures else 'declared-unavailable' if expected_status == 'skipped' else 'passed-with-declared-feature-gaps' if case.get('skipped') else 'passed'
    return summary, raw, classification

def ports_from_raw(summary):
    from urllib.parse import urlsplit
    result = set()
    for deployment in summary.get('environment', {}).get('deployments', []):
        parsed = urlsplit(deployment['origin'])
        if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or not parsed.port:
            raise IntegrityError('Owned local preview origin is malformed')
        result.add(parsed.port)
    return result

def exact_copy(source, destination):
    shutil.copyfile(source, destination)
    original, copied = sha(source), sha(destination)
    if original != copied:
        raise IntegrityError('Raw evidence copy changed bytes')
    return {'originalPath': str(source), 'exactCopy': str(destination), 'sha256': original}

def run_case(check, base, index, output, env, node, master):
    folder = output / (f'{index:02d}-' + check + ('-root' if base == '/' else '-project'))
    folder.mkdir()
    record = {'check': check, 'base': base, 'index': index, 'status': 'running', 'directory': str(folder)}
    child = None
    save(folder / 'record.json', record)
    try:
        record['prelaunchClosure'] = closure()
        before_path = folder / 'source-before.json'
        env = case_environment(env, check)
        setup = {'path': env['NS_QA_WEBKIT_SETUP_PATH'], 'sha256': env['NS_QA_WEBKIT_SETUP_SHA']}
        if sha(setup['path']) != setup['sha256']:
            raise IntegrityError('Approved WebKit setup manifest changed')
        before = capture(before_path, env, node)
        validate_source(before, master, check, setup)
        record['sourceBefore'] = {'path': str(before_path), 'sha256': sha(before_path), 'recordedAt': before['recordedAt']}
        previous = {path.name for path in REPORTS.iterdir() if path.is_dir()}
        command = [node, 'tools/qa/run.mjs', check, '--base', base]
        child_record = {'argv': command, 'cwd': str(ROOT), 'spawnRequestedAt': utc()}
        record['child'] = child_record
        observed, ports = {}, set()
        with (folder / 'cli.log').open('wb') as log:
            child = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
            child_record.update(pid=child.pid, spawnObservedAt=utc())
            save(folder / 'record.json', record)
            while child.poll() is None:
                for row in owned_processes(child.pid, processes()):
                    observed.setdefault(row['pid'], {**row, 'firstObservedAt': utc()})
                ports.update(preview_ports(observed.values()))
                time.sleep(0.5)
            child_record.update(actualExitCode=child.wait(), waitObservedAt=utc())
        record['observedOwnedProcesses'] = list(observed.values())
        record['log'] = {'path': str(folder / 'cli.log'), 'sha256': sha(folder / 'cli.log')}
        # Capture actual return code immediately; a later guard cannot erase a failed CLI.
        save(folder / 'record.json', record)
        directory = find_raw(REPORTS, previous, child.pid)
        record['rawDirectory'] = str(directory)
        record['raw'] = {name: exact_copy(directory / name, folder / ('raw-' + name)) for name in ('summary.json', check + '.json')}
        # Raw exact copies are saved even if binding/setup/source checks fail later.
        save(folder / 'record.json', record)
        summary = load(directory / 'summary.json')
        ports.update(ports_from_raw(summary))
        record['postrunClosure'] = closure(ports, child.pid)
        after_path = folder / 'source-after.json'
        after = capture(after_path, env, node, before_path)
        validate_source(after, master, check, setup)
        validate_setup_hash(env)
        if not timestamp(child_record['waitObservedAt']) <= timestamp(after['recordedAt']):
            raise IntegrityError('Postsource capture precedes actual child close')
        record['sourceAfter'] = {'path': str(after_path), 'sha256': sha(after_path), 'recordedAt': after['recordedAt']}
        summary, raw, classification = bind_raw(directory, check, base, child_record, before)
        record.update(status=classification, classification=classification, actualEnvironment=summary['environment'],
                      rawSummaryStatus=summary['status'], rawCheckStatus=raw['status'], failedAssertions=raw['failures'],
                      startedAt=summary['startedAt'], completedAt=summary['completedAt'],
                      assertions=raw['cases'][0]['assertions'], skipped=raw['cases'][0]['skipped'],
                      observations=raw['cases'][0]['observations'], runErrors=raw['runErrors'])
    except BaseException as error:
        # Interruption has no normal-run timeout. Ask only our own native QA child
        # to use its existing signal cleanup; never terminate another browser.
        if child is not None and child.poll() is None:
            number = error.number if isinstance(error, Interrupted) else signal.SIGINT
            child.send_signal(number)
            stop_deadline = time.monotonic() + 30
            while child.poll() is None and time.monotonic() < stop_deadline:
                time.sleep(0.5)
            record['interruptionCleanup'] = {'signal': signal.Signals(number).name, 'childOnly': True,
                'actualExitCode': child.poll(), 'nativeCleanupCompleted': child.poll() is not None}
        if child is not None and child.poll() is not None:
            record['child'].update(actualExitCode=child.wait(), waitObservedAt=utc())
            if (folder / 'cli.log').exists():record['log'] = {'path': str(folder / 'cli.log'), 'sha256': sha(folder / 'cli.log')}
            try:
                directory = find_raw(REPORTS, previous, child.pid)
                record['rawDirectory'] = str(directory)
                record['raw'] = {name: exact_copy(directory / name, folder / ('raw-' + name)) for name in ('summary.json', check + '.json') if (directory / name).exists()}
                record['postfailureClosure'] = closure(ports | ports_from_raw(load(directory / 'summary.json')), child.pid)
            except BaseException as retention_error:
                record['retentionError'] = {'type': type(retention_error).__name__, 'message': str(retention_error)}
        record.update(status='integrity-failed', integrityError={'type': type(error).__name__, 'message': str(error)})
        save(folder / 'record.json', record)
        raise
    save(folder / 'record.json', record)
    return record

def run_matrix(output, env, node, capture_sha, case_runner=run_case, capturer=capture, closer=closure):
    output = output.resolve()
    if output == Path('/tmp') or not output.is_relative_to(Path('/tmp').resolve()):
        raise IntegrityError('Private evidence output must be a new directory under /tmp')
    env = dict(env)
    env['NS_QA_CAPTURE_SHA'] = capture_sha
    output.mkdir(parents=True, exist_ok=False)
    matrix = {'schemaVersion': 1, 'status': 'running', 'recordedAt': utc(), 'directory': str(output),
              'scope': 'Independent supported-environment verification; original 1.57 paired performance and failed full runs remain unchanged.',
              'checks': list(CHECKS), 'bases': list(BASES), 'expectedRecords': 28, 'records': [], 'errors': [],
              'orchestrator': {'path': str(Path(__file__).resolve()), 'sha256': sha(__file__)},
              'captureHelper': {'path': str(CAPTURE), 'sha256': capture_sha},
              'nativeCLI': 'node tools/qa/run.mjs CHECK --base BASE; each check/base is a separate fresh subprocess, serial; no retries, wrappers, changed flags, assertions or limits.'}
    save(output / 'matrix.json', matrix)
    try:
        if sha(CAPTURE) != capture_sha:
            raise IntegrityError('Capture helper changed after peer review')
        if env.get('NS_QA_WEBKIT_SETUP_PATH'):
            if sha(env['NS_QA_WEBKIT_SETUP_PATH']) != env['NS_QA_WEBKIT_SETUP_SHA']:
                raise IntegrityError('Approved setup manifest hash differs')
            matrix['webkitSetup'] = {'path': env['NS_QA_WEBKIT_SETUP_PATH'], 'sha256': env['NS_QA_WEBKIT_SETUP_SHA'],
                'libraryScope': 'Only webkit Node children use the approved LD prefix; their ordinary initial Chromium probes also inherit it. Other Chromium/perf invocations retain their original LD environment.'}
        matrix['initialClosure'] = closer()
        master_path = output / 'matrix-source-before.json'
        master = capturer(master_path, env, node)
        validate_source(master)
        matrix['sourceBefore'] = {'path': str(master_path), 'sha256': sha(master_path)}
        for index, (check, base) in enumerate(planned_cases(), 1):
            # No next child is launched until this complete ordinary invocation and its guards finish.
            if sha(CAPTURE) != capture_sha:
                raise IntegrityError('Capture helper changed before invocation')
            record = case_runner(check, base, index, output, env, node, master)
            if sha(CAPTURE) != capture_sha:
                raise IntegrityError('Capture helper changed during invocation')
            validate_setup_hash(env)
            matrix['records'].append(record)
            save(output / 'matrix.json', matrix)
        if [(record['check'], record['base']) for record in matrix['records']] != planned_cases():
            raise IntegrityError('Exactly one record per check/base is required')
        matrix['finalClosure'] = closer()
        after_path = output / 'matrix-source-after.json'
        after = capturer(after_path, env, node, master_path)
        validate_source(after, master)
        validate_setup_hash(env)
        matrix['sourceAfter'] = {'path': str(after_path), 'sha256': sha(after_path)}
        classifications = {name: sum(record['classification'] == name for record in matrix['records']) for name in ('passed', 'passed-with-declared-feature-gaps', 'declared-unavailable', 'failed')}
        matrix.update(status='completed-with-assertion-failures' if classifications['failed'] else 'completed', classifications=classifications,
                      actualCLIExitCodes=[record['child']['actualExitCode'] for record in matrix['records']],
                      allSelectedRecordsVerified=True,
                      selectedRecordVerificationScope='Only native raw selection, assertion verdicts, actual CLI exits, source/driver/browser identity and resource closure were verified. This field does not apply a generic event policy, replace old 1.57 evidence, waive failures, or establish overall task acceptance.')
    except BaseException as error:
        matrix.update(status='stopped-on-integrity-failure', allSelectedRecordsVerified=False)
        matrix['errors'].append({'type': type(error).__name__, 'message': str(error)})
        # Keep any current case record and exact raw files, even when it could not enter validated records.
        matrix['retainedCaseRecords'] = [str(path) for path in sorted(output.glob('*/record.json'))]
    finally:
        matrix['completedAt'] = utc()
        save(output / 'matrix.json', matrix)
    return matrix

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--capture-sha', required=True)
    parser.add_argument('--webkit-setup', required=True)
    parser.add_argument('--webkit-setup-sha', required=True)
    args = parser.parse_args()
    node = shutil.which('node')
    if not node:
        raise IntegrityError('Node executable missing')
    env = environment()
    env.update(NS_QA_WEBKIT_SETUP_PATH=str(Path(args.webkit_setup).resolve()), NS_QA_WEBKIT_SETUP_SHA=args.webkit_setup_sha)
    previous_handlers = {number: signal.getsignal(number) for number in (signal.SIGINT, signal.SIGTERM)}
    try:
        for number in previous_handlers:signal.signal(number, signal_handler)
        matrix = run_matrix(Path(args.output), env, node, args.capture_sha)
    finally:
        for number, handler in previous_handlers.items():signal.signal(number, handler)
    print(json.dumps({'path': str(Path(args.output) / 'matrix.json'), 'sha256': sha(Path(args.output) / 'matrix.json'),
                      'status': matrix['status'], 'records': len(matrix['records']), 'classifications': matrix.get('classifications'), 'errors': matrix['errors']}, indent=2))
    return 2 if matrix['errors'] else 1 if matrix.get('classifications', {}).get('failed') else 0

if __name__ == '__main__':
    raise SystemExit(main())
