import copy
import datetime as dt
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import subprocess
import io
from contextlib import redirect_stdout

spec = importlib.util.spec_from_file_location("ios_signing", Path(__file__).with_name("ios-signing.py"))
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)

class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.env = {"APPLE_TEAM_ID": "VP77TD9A77", "LUXCARE_IOS_BUNDLE_IDENTIFIER": "com.luxcare.mobile", "BUILD_PROFILE": "production"}
        self.profile = {"UUID": "11111111-2222-3333-4444-555555555555", "TeamIdentifier": ["VP77TD9A77"],
            "ApplicationIdentifierPrefix": ["OLDPREFIX1"], "ExpirationDate": dt.datetime(2099, 1, 1),
            "Entitlements": {"application-identifier": "OLDPREFIX1.com.luxcare.mobile", "com.apple.developer.team-identifier": "VP77TD9A77", "get-task-allow": False, "aps-environment": "production"}}

    def test_store_and_legacy_app_prefix(self):
        self.assertEqual(signing.validate_profile(self.profile, self.env), "OLDPREFIX1.com.luxcare.mobile")
        options = signing.export_options(self.env, self.profile["UUID"], "identity")
        self.assertEqual(options["method"], "app-store-connect")
        self.assertFalse(options["manageAppVersionAndBuildNumber"])

    def test_wrong_team_bundle_expiry_or_debug_rejected(self):
        for field, value in [("TeamIdentifier", ["OTHERTEAM1"]), ("ExpirationDate", dt.datetime(2000, 1, 1)),
                             ("ProvisionsAllDevices", True), ("ProvisionedDevices", ["device"])]:
            profile = {**self.profile, field: value}
            with self.assertRaises(ValueError): signing.validate_profile(profile, self.env)
        for field, value in [("get-task-allow", True), ("application-identifier", "OLDPREFIX1.*"), ("aps-environment", "development")]:
            profile = copy.deepcopy(self.profile)
            profile["Entitlements"][field] = value
            with self.assertRaises(ValueError): signing.validate_profile(profile, self.env)

    def test_adhoc_requires_devices_and_cannot_be_store(self):
        env = {**self.env, "BUILD_PROFILE": "preview"}
        with self.assertRaises(ValueError): signing.validate_profile(self.profile, env)
        signing.validate_profile({**self.profile, "ProvisionedDevices": ["test-device"]}, env)
        self.assertEqual(signing.export_options(env, self.profile["UUID"], "id")["method"], "release-testing")

    def test_invalid_base64_rejected(self):
        for value in ["", "not base64!", "@@@"]:
            with self.assertRaises(ValueError): signing.decode(value)
        self.assertEqual(signing.decode("aGVsbG8=\n"), b"hello")

class CommandDiagnosticsTests(unittest.TestCase):
    def test_reports_subcommand_without_secrets_or_raw_stderr(self):
        password = "test-password-never-log"
        failure = subprocess.CalledProcessError(1, ["security", "import"], stderr=("MAC verification failed " + password).encode())
        output = io.StringIO()
        with patch.object(signing.subprocess, "check_output", side_effect=failure), redirect_stdout(output):
            with self.assertRaises(signing.SigningCommandError) as caught:
                signing.run("security", "import", "cert.p12", "-P", password)
        diagnostic = output.getvalue() + str(caught.exception)
        self.assertIn("security import", diagnostic)
        self.assertIn("P12 password verification failed", diagnostic)
        self.assertNotIn(password, diagnostic)

    def test_profile_decode_failure_identifies_profile_secret(self):
        failure = subprocess.CalledProcessError(1, ["security", "cms"], stderr=b"invalid profile")
        diagnostic = signing.command_failure(["security", "cms", "-D"], failure)
        self.assertIn("PROVISIONING_PROFILE_BASE64", diagnostic)

    def test_captures_private_key_output_without_logging_it(self):
        output = io.StringIO()
        with patch.object(signing.subprocess, "check_output", return_value=b"private-key-never-log"), redirect_stdout(output):
            self.assertEqual(signing.run("openssl", "pkey", "-text"), b"private-key-never-log")
        self.assertNotIn("private-key-never-log", output.getvalue())

class P12Tests(unittest.TestCase):
    def test_certificate_only_export_is_rejected_before_import(self):
        with patch.object(signing, "run", return_value=b"Bag Attributes\n"):
            with self.assertRaisesRegex(ValueError, "contains no private key"):
                signing.validate_p12(Path("test.p12"))

    def test_private_key_is_accepted_without_printing_key(self):
        output = io.StringIO()
        with patch.object(signing, "run", return_value=b"-----BEGIN PRIVATE KEY-----\nnever-log-this"), redirect_stdout(output):
            signing.validate_p12(Path("test.p12"))
        self.assertNotIn("never-log-this", output.getvalue())

    def test_legacy_reader_fallback_only_for_unsupported_cipher(self):
        with patch.object(signing, "run", side_effect=[signing.SigningCommandError("unsupported encryption"), b"-----BEGIN PRIVATE KEY-----"]) as run:
            signing.validate_p12(Path("test.p12"))
        self.assertIn("-legacy", run.call_args.args)
        with patch.object(signing, "run", side_effect=signing.SigningCommandError("password verification failed")) as run:
            with self.assertRaises(signing.SigningCommandError): signing.validate_p12(Path("test.p12"))
        self.assertEqual(run.call_count, 1)

if __name__ == "__main__": unittest.main()
