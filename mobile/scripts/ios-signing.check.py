import copy
import datetime as dt
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import subprocess
import io
import base64
import hashlib
import os
import plistlib
import tempfile
import shutil
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

    def test_mismatched_profile_is_rejected_before_keychain_creation(self):
        pem = b"-----BEGIN CERTIFICATE-----\n" + base64.b64encode(b"certificate-one") + b"\n-----END CERTIFICATE-----"
        with patch.object(signing, "run", side_effect=[b"-----BEGIN PRIVATE KEY-----", pem]):
            with self.assertRaisesRegex(ValueError, "Certificate/profile mismatch"):
                signing.validate_p12(Path("test.p12"), {"DeveloperCertificates": [b"certificate-two"]})

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

class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.certificate = b"test-public-certificate"
        self.fingerprint = hashlib.sha1(self.certificate).hexdigest().upper()
        self.pem = b"-----BEGIN CERTIFICATE-----\n" + base64.b64encode(self.certificate) + b"\n-----END CERTIFICATE-----"
        self.profile = {"DeveloperCertificates": [self.certificate]}

    def test_exact_profile_certificate_is_selected(self):
        with patch.object(signing, "run", side_effect=[self.pem, self.fingerprint.encode()]):
            self.assertEqual(signing.select_identity(Path("keychain"), self.profile), self.fingerprint)

    def test_mismatched_profile_is_distinguished_from_trust_failure(self):
        with patch.object(signing, "run", return_value=self.pem):
            with self.assertRaisesRegex(ValueError, "Certificate/profile mismatch"):
                signing.select_identity(Path("keychain"), {"DeveloperCertificates": [b"different"]})
        with patch.object(signing, "run", side_effect=[self.pem, b"0 valid identities found", b"CSSMERR_TP_NOT_TRUSTED"]):
            with self.assertRaisesRegex(ValueError, "CSSMERR_TP_NOT_TRUSTED"):
                signing.select_identity(Path("keychain"), self.profile)

    def test_install_and_cleanup_keep_private_material_out_of_exported_environment(self):
        fixture = ProfileTests()
        fixture.setUp()
        profile = {**fixture.profile, "DeveloperCertificates": [self.certificate]}
        calls = []
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "luxcare-ios-signing"
            github_env = root / "github-env"
            env = {**fixture.env, "IOS_DISTRIBUTION_P12_BASE64": base64.b64encode(b"fake-p12").decode(),
                   "IOS_DISTRIBUTION_P12_PASSWORD": "private-password-never-export", "UPLOAD_TESTFLIGHT": "false",
                   "IOS_PROVISIONING_PROFILE_BASE64": base64.b64encode(b"fake-cms").decode(), "GITHUB_ENV": str(github_env), "RUNNER_TEMP": str(root)}
            def native(*args):
                calls.append(args)
                if args[:2] == ("openssl", "pkcs12"): return self.pem if "-nokeys" in args else b"-----BEGIN PRIVATE KEY-----"
                if args[:2] == ("security", "cms"): return plistlib.dumps(profile)
                if args[:2] == ("security", "list-keychains"): return b'"login.keychain-db"'
                if args[:2] == ("security", "create-keychain"): Path(args[-1]).touch()
                if args[:2] == ("security", "find-certificate"): return self.pem
                if args[:2] == ("security", "find-identity"): return self.fingerprint.encode()
                return b""
            with patch.dict(os.environ, env, clear=True), patch.object(Path, "home", return_value=root), patch.object(signing, "run", side_effect=native):
                signing.install(folder)
                exported = github_env.read_text()
                self.assertIn("IOS_PROFILE_UUID=", exported)
                self.assertNotIn(env["IOS_DISTRIBUTION_P12_PASSWORD"], exported)
                self.assertFalse((folder / "distribution.p12").exists())
                imported = next(args for args in calls if args[:2] == ("security", "import"))
                self.assertNotIn("-t", imported)
                signing.cleanup(folder)
                self.assertFalse(folder.exists())
                self.assertFalse(list(root.rglob("*.mobileprovision")))

class CredentialSelectionTests(unittest.TestCase):
    def test_certificate_and_password_stay_in_same_family(self):
        legacy = {"APPLE_CERTIFICATE_BASE64": "old-cert", "APPLE_CERTIFICATE_PASSWORD": "old-password"}
        self.assertEqual(signing.resolve_p12(legacy), ("old-cert", "old-password"))
        self.assertEqual(signing.resolve_p12({**legacy, "IOS_DISTRIBUTION_P12_BASE64": "new-cert", "IOS_DISTRIBUTION_P12_PASSWORD": ""}), ("new-cert", ""))

    def test_private_files_are_cleaned_even_when_keychain_restore_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "luxcare-ios-signing"
            folder.mkdir()
            (folder / "AuthKey.p8").write_text("test-private-material")
            (folder / "original-keychains.json").write_text('["login.keychain-db"]')
            (folder / "build.keychain-db").touch()
            with patch.dict(os.environ, {"RUNNER_TEMP": str(root)}), patch.object(signing, "run", side_effect=[signing.SigningCommandError("test restore failure"), b""]) as run:
                with self.assertRaisesRegex(signing.SigningCommandError, "Temporary files removed"):
                    signing.cleanup(folder)
                self.assertEqual(run.call_count, 2)
            self.assertFalse(folder.exists())

@unittest.skipUnless(os.environ.get("TEST_OPENSSL") or shutil.which("openssl"), "OpenSSL executable unavailable")
class RealP12Tests(unittest.TestCase):
    def test_real_p12_password_private_key_and_profile_pairing(self):
        binary = os.environ.get("TEST_OPENSSL") or shutil.which("openssl")
        def openssl(*args):
            return subprocess.check_output([binary, *args], stderr=subprocess.PIPE)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key, cert, p12 = root / "test.key", root / "test.pem", root / "test.p12"
            openssl("req", "-new", "-x509", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=Temporary Signing Test", "-days", "1", "-keyout", str(key), "-out", str(cert))
            with patch.dict(os.environ, {"IOS_DISTRIBUTION_P12_PASSWORD": "ephemeral-test-password"}):
                openssl("pkcs12", "-export", "-inkey", str(key), "-in", str(cert), "-out", str(p12), "-passout", "env:IOS_DISTRIBUTION_P12_PASSWORD")
                der = openssl("x509", "-in", str(cert), "-outform", "DER")
                def native(*args):
                    try:
                        return openssl(*args[1:])
                    except subprocess.CalledProcessError as error:
                        raise signing.SigningCommandError(signing.command_failure(args, error)) from None
                with patch.object(signing, "run", side_effect=native):
                    signing.validate_p12(p12, {"DeveloperCertificates": [der]})
                    with self.assertRaisesRegex(ValueError, "Certificate/profile mismatch"):
                        signing.validate_p12(p12, {"DeveloperCertificates": [b"different-cert"]})
                    with patch.dict(os.environ, {"IOS_DISTRIBUTION_P12_PASSWORD": "wrong-test-password"}):
                        with self.assertRaises(signing.SigningCommandError): signing.validate_p12(p12)

if __name__ == "__main__": unittest.main()
