import copy
import datetime as dt
import importlib.util
from pathlib import Path
import unittest

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

if __name__ == "__main__": unittest.main()
