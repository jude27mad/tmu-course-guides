import copy
import errno
import importlib.util
import json
import os
import signal
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('matrix', '/tmp/ns-perf-supported-matrix.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def source_fixture():
    return {'recordedAt': '2026-10-14T10:00:00.000Z',
        'sources': [{'path': path, 'sha256': digest} for path, digest in m.SOURCE_HASHES.items()],
        'entryPoint': {'path': 'tools/qa/run.mjs', 'sha256': m.ENTRY_HASH},
        'productFingerprint': m.PRODUCT, 'protectedFingerprint': m.PROTECTED,
        'driverIdentity': {name: {'version': '1.64.0', 'packageSHA256': 'a' * 64, 'entrySHA256': 'b' * 64} for name in ('playwright', 'core')},
        'loader': {'modulePath': m.DRIVER, 'source': 'PLAYWRIGHT_PATH'},
        'executableSource': 'Playwright bundled Chromium',
        'browserIdentity': {'binaryPath': m.BROWSERS + '/chromium-1255/chrome-linux64/chrome', 'binarySHA256': 'c' * 64,
            'browserManifest': {'sha256': 'd' * 64, 'chromium': {'browserVersion': '157.0.fixture'}}},
        'environment': {'PLAYWRIGHT_PATH': m.DRIVER, 'PLAYWRIGHT_BROWSERS_PATH': m.BROWSERS, 'QA_GPU': '0', 'QA_NAV_DIAGNOSTICS': '1', **{key: None for key in m.REMOVED_ENV}},
        'launchOptions': {'executablePath': m.BROWSERS + '/chromium-1255/chrome-linux64/chrome', 'args': m.SOFTWARE_ARGS},
        'node': 'v24.fixture', 'platform': 'linux', 'architecture': 'x64'}

def raw_fixture(directory, check='crosstab', base='/', failed=False, skipped=False):
    started, completed = '2026-10-14T10:00:00.100Z', '2026-10-14T10:00:00.900Z'
    assertions = [] if skipped else [{'name': 'original native target', 'pass': not failed, 'actual': {'unchanged': [False, None, 'text']}, 'expected': True}]
    gaps = [{'feature': 'WebKit', 'reason': 'Executable does not exist'}] if skipped else []
    failures = int(failed)
    status = 'failed' if failed else 'skipped' if skipped else 'passed'
    environment = {'playwrightPath': m.DRIVER, 'playwrightSource': 'PLAYWRIGHT_PATH', 'chromiumPath': source_fixture()['launchOptions']['executablePath'],
        'chromiumSource': 'Playwright bundled Chromium', 'launchArgs': m.SOFTWARE_ARGS, 'requestedMode': 'SwiftShader',
        'deployments': [{'base': base, 'origin': 'http://127.0.0.1:41234', 'chromiumVersion': '157.0.fixture', 'webgl': {'available': True, 'renderer': 'ANGLE SwiftShader fixture'}, 'requestedMode': 'SwiftShader', 'actualMode': 'SwiftShader'}]}
    case = {'base': base, 'status': status, 'assertions': assertions, 'skipped': gaps, 'failures': failures,
            'observations': {'runnerErrors': [], 'cases': [{'telemetry': [{'type': 'requestfailed', 'message': 'native event', 'expected': True}]}]}}
    raw = {'check': check, 'startedAt': started, 'completedAt': completed, 'environment': environment,
           'status': status, 'failures': failures, 'cases': [case], 'runErrors': []}
    summary = {'startedAt': started, 'completedAt': completed, 'environment': environment,
        'selection': {'checks': [check], 'bases': [base], 'gpu': False, 'help': False},
        'status': 'failed' if failed else 'passed', 'exitCode': failures, 'failures': failures, 'errors': [],
        'checks': [{'name': check, 'status': status, 'failures': failures, 'cases': [case]}]}
    directory.mkdir()
    m.save(directory / 'summary.json', summary)
    m.save(directory / (check + '.json'), raw)
    child = {'pid': 1234, 'actualExitCode': failures, 'spawnRequestedAt': '2026-10-14T10:00:00.001Z', 'waitObservedAt': '2026-10-14T10:00:01.000Z'}
    return child, summary, raw

class Guards(unittest.TestCase):
    def test_exact_28_check_base_plan_and_removed_environment(self):
        plan = m.planned_cases()
        self.assertEqual(len(plan), 28)
        self.assertEqual(len(set(plan)), 28)
        self.assertEqual(plan, [(check, base) for check in m.CHECKS for base in m.BASES])
        with patch.dict(os.environ, {name: 'forbidden' for name in m.REMOVED_ENV}):
            env = m.environment()
        self.assertTrue(all(name not in env for name in m.REMOVED_ENV))
        self.assertEqual(env['PLAYWRIGHT_PATH'], m.DRIVER)
        self.assertEqual(env['NS_QA_REQUIRE_VERSION'], '1.64.0')

    def test_source_driver_binary_and_continuity_guards(self):
        source = source_fixture()
        m.validate_source(source)
        variants = []
        for field, bad in [('productFingerprint', 'wrong'), ('protectedFingerprint', 'wrong'), ('executableSource', 'system Chromium fallback')]:
            value = copy.deepcopy(source);value[field] = bad;variants.append(value)
        value = copy.deepcopy(source);value['sources'][0]['sha256'] = 'wrong';variants.append(value)
        value = copy.deepcopy(source);value['driverIdentity']['core']['version'] = '1.57.0';variants.append(value)
        value = copy.deepcopy(source);value['browserIdentity']['binarySHA256'] = 'missing';variants.append(value)
        value = copy.deepcopy(source);value['environment']['QA_CHROMIUM_PATH'] = '/usr/bin/chromium';variants.append(value)
        for value in variants:
            with self.assertRaises(m.IntegrityError):m.validate_source(value)
        value = copy.deepcopy(source);value['driverIdentity']['core']['packageSHA256'] = 'f' * 64
        with self.assertRaises(m.IntegrityError):m.validate_source(value, source)

    def test_actual_failure_and_unavailable_payloads_remain_honest(self):
        for failed, unavailable, expected in [(False, False, 'passed'), (True, False, 'failed'), (False, True, 'declared-unavailable')]:
            with tempfile.TemporaryDirectory() as temporary:
                folder = Path(temporary) / '2026-10-14T10-00-00-100Z-1234'
                child, summary, raw = raw_fixture(folder, failed=failed, skipped=unavailable)
                bound_summary, bound_raw, classification = m.bind_raw(folder, 'crosstab', '/', child, source_fixture())
                self.assertEqual(bound_summary, summary);self.assertEqual(bound_raw, raw);self.assertEqual(classification, expected)
                before = (folder / 'crosstab.json').read_bytes()
                evidence = m.exact_copy(folder / 'crosstab.json', Path(temporary) / 'exact.json')
                self.assertEqual((Path(temporary) / 'exact.json').read_bytes(), before)
                self.assertEqual(evidence['sha256'], m.sha(folder / 'crosstab.json'))

    def test_wrong_actual_exit_selection_pid_time_or_version_rejects(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary) / '2026-10-14T10-00-00-100Z-1234'
            child, summary, raw = raw_fixture(folder)
            for changed in [{**child, 'actualExitCode': 1}, {**child, 'pid': 9999}, {**child, 'spawnRequestedAt': '2026-10-14T10:00:00.200Z'}]:
                with self.assertRaises(m.IntegrityError):m.bind_raw(folder, 'crosstab', '/', changed, source_fixture())
            summary['selection']['bases'] = ['/tmu-course-guides/'];m.save(folder / 'summary.json', summary)
            with self.assertRaises(m.IntegrityError):m.bind_raw(folder, 'crosstab', '/', child, source_fixture())
            summary['selection']['bases'] = ['/'];summary['environment']['deployments'][0]['chromiumVersion'] = '154.system';raw['environment'] = summary['environment']
            m.save(folder / 'summary.json', summary);m.save(folder / 'crosstab.json', raw)
            with self.assertRaises(m.IntegrityError):m.bind_raw(folder, 'crosstab', '/', child, source_fixture())

    def test_owned_ports_require_refusal_and_no_browser_runtime(self):
        result = m.closure([41234], 1234, process_rows=[], connector=lambda port: errno.ECONNREFUSED)
        self.assertTrue(result['ownedPreviewPorts'][0]['refused'])
        for code in [0, errno.ETIMEDOUT]:
            with self.assertRaises(m.IntegrityError):m.closure([41234], process_rows=[], connector=lambda port: code)
        for argv in [['/tmp/browser/chrome'], ['/bin/node', 'tools/qa/run.mjs', 'crosstab'], ['/bin/node', 'tools/preview-server.mjs', '--port', '41234']]:
            rows = [{'pid': 5678, 'parent': 1, 'argv': argv, 'cwd': str(m.ROOT)}]
            with self.assertRaises(m.IntegrityError):m.closure(process_rows=rows)

    def test_unique_new_own_raw_directory_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            reports = Path(temporary)
            old = reports / 'old-1234';old.mkdir()
            new = reports / 'new-1234';new.mkdir()
            self.assertEqual(m.find_raw(reports, {'old-1234'}, 1234), new)
            with self.assertRaises(m.IntegrityError):m.find_raw(reports, {'old-1234', 'new-1234'}, 1234)
            (reports / 'second-1234').mkdir()
            with self.assertRaises(m.IntegrityError):m.find_raw(reports, {'old-1234'}, 1234)

    def test_actual_renderer_availability_and_mode_are_required(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary) / '2026-10-14T10-00-00-100Z-1234'
            child, summary, raw = raw_fixture(folder)
            for field, value in [('available', False), ('renderer', 'physical GPU fixture')]:
                changed_summary, changed_raw = copy.deepcopy(summary), copy.deepcopy(raw)
                changed_summary['environment']['deployments'][0]['webgl'][field] = value
                changed_raw['environment'] = changed_summary['environment']
                m.save(folder / 'summary.json', changed_summary);m.save(folder / 'crosstab.json', changed_raw)
                with self.assertRaises(m.IntegrityError):m.bind_raw(folder, 'crosstab', '/', child, source_fixture())
            summary['environment']['deployments'][0]['actualMode'] = 'GPU';raw['environment'] = summary['environment']
            m.save(folder / 'summary.json', summary);m.save(folder / 'crosstab.json', raw)
            with self.assertRaises(m.IntegrityError):m.bind_raw(folder, 'crosstab', '/', child, source_fixture())

    def test_webkit_only_environment_and_immutable_setup_binding(self):
        env = {'NS_QA_WEBKIT_SETUP_PATH': '/tmp/setup.json', 'NS_QA_WEBKIT_DEPENDENCIES': 'stale', 'LD_LIBRARY_PATH': '/existing'}
        ordinary, webkit = m.case_environment(env, 'perf'), m.case_environment(env, 'webkit')
        self.assertEqual(ordinary['LD_LIBRARY_PATH'], '/existing');self.assertNotIn('NS_QA_WEBKIT_DEPENDENCIES', ordinary)
        self.assertEqual(webkit['LD_LIBRARY_PATH'], m.WEBKIT_LIBRARY_DIR + ':/existing')
        self.assertEqual(webkit['NS_QA_WEBKIT_DEPENDENCIES'], '/tmp/setup.json')
        master = source_fixture();master['environment']['LD_LIBRARY_PATH'] = '/existing'
        value = copy.deepcopy(master);value['environment'].update(LD_LIBRARY_PATH=webkit['LD_LIBRARY_PATH'], NS_QA_WEBKIT_DEPENDENCIES='/tmp/setup.json')
        value['webkitSetup'] = {'path': '/tmp/setup.json', 'sha256': 'e' * 64}
        m.validate_source(value, master, 'webkit', {'path': '/tmp/setup.json', 'sha256': 'e' * 64})
        with self.assertRaises(m.IntegrityError):m.validate_source(value, master, 'perf')
        with self.assertRaises(m.IntegrityError):m.validate_source(value, master, 'webkit', {'path': '/tmp/setup.json', 'sha256': 'f' * 64})
        with tempfile.TemporaryDirectory() as temporary:
            setup = Path(temporary) / 'setup.json';setup.write_text('{}')
            bound = {'NS_QA_WEBKIT_SETUP_PATH': str(setup), 'NS_QA_WEBKIT_SETUP_SHA': m.sha(setup)}
            m.validate_setup_hash(bound);setup.write_text('{"changed":true}')
            with self.assertRaises(m.IntegrityError):m.validate_setup_hash(bound)

    def test_output_rejects_workspace_and_symlink_escape(self):
        with self.assertRaises(m.IntegrityError):m.run_matrix(m.ROOT / 'private-matrix-forbidden', {}, '/mock/node', 'a' * 64)
        with tempfile.TemporaryDirectory() as temporary:
            link = Path(temporary) / 'escape';link.symlink_to(m.ROOT, target_is_directory=True)
            with self.assertRaises(m.IntegrityError):m.run_matrix(link / 'private-matrix-forbidden', {}, '/mock/node', 'a' * 64)

    def test_capture_helper_hash_checked_before_and_after_every_use(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'source.json'
            with patch.object(m, 'sha', return_value='wrong'), patch.object(m.subprocess, 'run') as child:
                with self.assertRaises(m.IntegrityError):m.capture(output, {'NS_QA_CAPTURE_SHA': 'a' * 64}, '/mock/node')
                child.assert_not_called()
            with patch.object(m, 'sha', side_effect=['a' * 64, 'b' * 64]), patch.object(m.subprocess, 'run') as child:
                child.return_value.returncode = 0
                with self.assertRaises(m.IntegrityError):m.capture(output, {'NS_QA_CAPTURE_SHA': 'a' * 64}, '/mock/node')
                self.assertEqual(child.call_count, 1)

    def test_sigterm_retains_actual_child_exit_log_and_raw_without_binding(self):
        with self.assertRaises(m.Interrupted) as signal_error:m.signal_handler(signal.SIGTERM, None)
        self.assertEqual(signal_error.exception.number, signal.SIGTERM)
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary);reports = output / 'reports';reports.mkdir()
            setup = output / 'setup.json';setup.write_text('{}')
            env = {'NS_QA_WEBKIT_SETUP_PATH': str(setup), 'NS_QA_WEBKIT_SETUP_SHA': m.sha(setup)}
            class Child:
                pid = 1234
                code = None
                def poll(self):return self.code
                def send_signal(self, number):self.received = number;self.code = -number
                def wait(self):
                    folder = reports / '2026-10-14T10-00-00-100Z-1234'
                    if not folder.exists():raw_fixture(folder)
                    return self.code
            child = Child()
            def capturer(path, env, node, prior=None):
                fixture = source_fixture();m.save(path, fixture);return fixture
            with patch.object(m, 'REPORTS', reports), patch.object(m, 'capture', side_effect=capturer), patch.object(m, 'closure', return_value={}), patch.object(m, 'processes', side_effect=m.Interrupted(signal.SIGTERM)), patch.object(m.subprocess, 'Popen', return_value=child), patch.object(m, 'bind_raw') as bind:
                with self.assertRaises(m.Interrupted):m.run_case('crosstab', '/', 1, output, env, '/mock/node', source_fixture())
                bind.assert_not_called()
            record = m.load(output / '01-crosstab-root/record.json')
            self.assertEqual(child.received, signal.SIGTERM);self.assertEqual(record['child']['actualExitCode'], -signal.SIGTERM)
            self.assertIn('waitObservedAt', record['child']);self.assertEqual(record['log']['sha256'], m.sha(record['log']['path']))
            self.assertEqual(set(record['raw']), {'summary.json', 'crosstab.json'})
            self.assertEqual(record['status'], 'integrity-failed')

    def test_matrix_continues_real_assertion_failure_and_stops_source_integrity(self):
        def capturer(path, env, node, prior=None):
            value = source_fixture();m.save(path, value);return value
        calls = []
        active = 0
        def case_runner(check, base, index, output, env, node, master):
            nonlocal active
            self.assertEqual(active, 0);active += 1
            calls.append((check, base));active -= 1
            return {'check': check, 'base': base, 'classification': 'failed' if index == 1 else 'passed', 'child': {'actualExitCode': 1 if index == 1 else 0}}
        with tempfile.TemporaryDirectory() as temporary:
            result = m.run_matrix(Path(temporary) / 'matrix', {}, '/mock/node', m.sha(m.CAPTURE), case_runner, capturer, lambda: {})
        self.assertEqual(calls, m.planned_cases());self.assertEqual(len(result['records']), 28)
        self.assertEqual(result['status'], 'completed-with-assertion-failures');self.assertEqual(result['classifications']['failed'], 1)
        self.assertEqual(result['actualCLIExitCodes'][0], 1)
        calls.clear()
        def failed_runner(check, base, index, output, env, node, master):
            if index == 3:raise m.IntegrityError('source drift')
            return case_runner(check, base, index, output, env, node, master)
        with tempfile.TemporaryDirectory() as temporary:
            result = m.run_matrix(Path(temporary) / 'matrix', {}, '/mock/node', m.sha(m.CAPTURE), failed_runner, capturer, lambda: {})
        self.assertEqual(len(calls), 2);self.assertEqual(len(result['records']), 2)
        self.assertEqual(result['status'], 'stopped-on-integrity-failure');self.assertFalse(result['allSelectedRecordsVerified'])

if __name__ == '__main__':unittest.main()
