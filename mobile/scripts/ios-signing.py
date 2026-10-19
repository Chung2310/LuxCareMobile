"""Temporary Apple signing material for the GitHub-hosted macOS runner."""
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
import sys


class SigningCommandError(RuntimeError):
    pass


def command_failure(args, error):
    stage = " ".join(args[:2])
    diagnostic = (error.stderr or b"").decode("utf-8", errors="replace").lower()
    # Only fixed messages are logged, never raw output, passwords or key material.
    hints = {
        "security cms": "PROVISIONING_PROFILE_BASE64 must decode to the original Apple-signed .mobileprovision file.",
        "security import": "Check the P12/password pair; the P12 must contain a private key and use encryption macOS can import.",
        "security set-key-partition-list": "No imported private key was available or the temporary keychain could not be unlocked.",
        "security find-identity": "The temporary keychain has no usable code signing identity.",
    }
    detail = hints.get(stage, "Check the runner keychain and Apple signing configuration.")
    if "mac verification failed" in diagnostic or "invalid password" in diagnostic or "mac verify error" in diagnostic:
        detail = "P12 password verification failed. Verify the certificate/password pair in GitHub Secrets."
    elif "unknown format" in diagnostic or "unable to decode" in diagnostic:
        detail = "The decoded signing file is not in the format expected by this command."
    elif "unsupported" in diagnostic and stage == "openssl pkcs12":
        detail = "The P12 uses unsupported encryption; export an Apple-compatible P12 from Keychain Access."
    return f"{stage} failed (exit {error.returncode}). {detail}"


def run(*args):
    # Log command/subcommand only, never argument values or command output.
    print("[signing] " + " ".join(args[:2]), flush=True)
    try:
        return subprocess.check_output(args, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as error:
        raise SigningCommandError(command_failure(args, error)) from None


def decode(value):
    try:
        result = base64.b64decode("".join(value.split()), validate=True)
    except ValueError:
        raise ValueError("Signing secret must contain valid base64") from None
    if not result:
        raise ValueError("Signing secret is empty")
    return result


def validate_profile(profile, env, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    expiration = profile["ExpirationDate"]
    if expiration.tzinfo is None:
        expiration = expiration.replace(tzinfo=dt.timezone.utc)
    if expiration <= now:
        raise ValueError("Provisioning profile has expired")
    entitlements = profile.get("Entitlements", {})
    if profile.get("TeamIdentifier") != [env["APPLE_TEAM_ID"]]:
        raise ValueError("Provisioning profile belongs to another Apple team")
    if entitlements.get("com.apple.developer.team-identifier") != env["APPLE_TEAM_ID"]:
        raise ValueError("Profile entitlement team mismatch")
    prefixes = profile.get("ApplicationIdentifierPrefix", [])
    allowed = [prefix + "." + env["LUXCARE_IOS_BUNDLE_IDENTIFIER"] for prefix in prefixes]
    if entitlements.get("application-identifier") not in allowed:
        raise ValueError("Profile must match the explicit Bundle ID (wildcards are unsupported)")
    if entitlements.get("get-task-allow") or profile.get("ProvisionsAllDevices"):
        raise ValueError("Use an App Store or Ad Hoc distribution profile")
    if entitlements.get("aps-environment") != "production":
        raise ValueError("Enable Push Notifications on the App ID and use a profile with production APNs entitlement")
    devices = profile.get("ProvisionedDevices")
    if env["BUILD_PROFILE"] == "production" and devices is not None:
        raise ValueError("Production requires an App Store Connect profile, not Ad Hoc")
    if env["BUILD_PROFILE"] == "preview" and not devices:
        raise ValueError("Preview requires an Ad Hoc profile with registered iPhones")
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", profile.get("UUID", "")):
        raise ValueError("Invalid provisioning profile UUID")
    return entitlements["application-identifier"]


def export_options(env, uuid, identity):
    return {
        "method": "app-store-connect" if env["BUILD_PROFILE"] == "production" else "release-testing",
        "destination": "export",
        "signingStyle": "manual",
        "teamID": env["APPLE_TEAM_ID"],
        "signingCertificate": identity,
        "provisioningProfiles": {env["LUXCARE_IOS_BUNDLE_IDENTIFIER"]: uuid},
        "manageAppVersionAndBuildNumber": False,
        "stripSwiftSymbols": True,
        "uploadSymbols": True,
    }


def append_env(values):
    with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as out:
        for key, value in values.items():
            if "\n" in str(value) or "\r" in str(value):
                raise ValueError("Multiline environment value rejected")
            out.write(f"{key}={value}\n")


def install(folder):
    env = os.environ
    for key in ["IOS_DISTRIBUTION_P12_BASE64", "IOS_PROVISIONING_PROFILE_BASE64"]:
        if not env.get(key):
            raise ValueError(f"Missing signing secret {key}")
    if "IOS_DISTRIBUTION_P12_PASSWORD" not in env:
        raise ValueError("Missing IOS_DISTRIBUTION_P12_PASSWORD")
    folder.mkdir(mode=0o700)
    p12 = folder / "distribution.p12"
    p12.write_bytes(decode(env["IOS_DISTRIBUTION_P12_BASE64"]))
    profile_path = folder / "profile.mobileprovision"
    profile_path.write_bytes(decode(env["IOS_PROVISIONING_PROFILE_BASE64"]))
    profile = plistlib.loads(run("security", "cms", "-D", "-i", str(profile_path)))
    validate_profile(profile, env)
    (folder / "profile.plist").write_bytes(plistlib.dumps(profile))
    keychain = folder / "build.keychain-db"
    original = shlex.split(run("security", "list-keychains", "-d", "user").decode())
    (folder / "original-keychains.json").write_text(json.dumps(original))
    password = secrets.token_urlsafe(32)
    run("security", "create-keychain", "-p", password, str(keychain))
    run("security", "set-keychain-settings", "-lut", "21600", str(keychain))
    run("security", "unlock-keychain", "-p", password, str(keychain))
    run("security", "import", str(p12), "-P", env["IOS_DISTRIBUTION_P12_PASSWORD"],
        "-t", "cert", "-f", "pkcs12", "-k", str(keychain), "-T", "/usr/bin/codesign", "-T", "/usr/bin/security")
    run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", password, str(keychain))
    run("security", "list-keychains", "-d", "user", "-s", str(keychain), *original)
    identities = run("security", "find-identity", "-v", "-p", "codesigning", str(keychain)).decode()
    available = set(re.findall(r"\b[0-9A-F]{40}\b", identities))
    matching = [hashlib.sha1(cert).hexdigest().upper() for cert in profile.get("DeveloperCertificates", [])
                if hashlib.sha1(cert).hexdigest().upper() in available]
    if not matching:
        raise ValueError("P12 private key/certificate does not match a valid signing identity in this profile")
    identity = matching[0]
    # Current Xcode location, plus the legacy location supported by older toolchains.
    installed = []
    for directory in [Path.home() / "Library/Developer/Xcode/UserData/Provisioning Profiles",
                      Path.home() / "Library/MobileDevice/Provisioning Profiles"]:
        directory.mkdir(parents=True, exist_ok=True)
        destination = directory / (profile["UUID"] + ".mobileprovision")
        if destination.exists():
            raise ValueError("Refusing to replace an existing provisioning profile; use a fresh hosted runner")
        installed.append(str(destination))
        (folder / "installed-profiles.json").write_text(json.dumps(installed))
        shutil.copyfile(profile_path, destination)
    (folder / "ExportOptions.plist").write_bytes(plistlib.dumps(export_options(env, profile["UUID"], identity)))
    values = {"IOS_PROFILE_UUID": profile["UUID"], "IOS_SIGNING_IDENTITY": identity, "IOS_KEYCHAIN_PATH": str(keychain)}
    if env.get("UPLOAD_TESTFLIGHT") == "true":
        key_id = env.get("APP_STORE_CONNECT_API_KEY_ID", "").strip()
        issuer = env.get("APP_STORE_CONNECT_ISSUER_ID", "").strip()
        if not re.fullmatch(r"[A-Z0-9]{10}", key_id) or not re.fullmatch(r"[a-fA-F0-9-]{36}", issuer):
            raise ValueError("Missing or invalid App Store Connect Key ID / Issuer ID")
        raw = env.get("APP_STORE_CONNECT_API_KEY_BASE64", "").strip()
        key = raw.encode() if raw.startswith("-----BEGIN PRIVATE KEY-----") else decode(raw)
        asc = folder / "asc"
        asc.mkdir(mode=0o700)
        key_path = asc / f"AuthKey_{key_id}.p8"
        key_path.write_bytes(key)
        details = run("openssl", "pkey", "-in", str(key_path), "-check", "-text", "-noout")
        if b"prime256v1" not in details:
            raise ValueError("App Store Connect API key must be an EC P-256 private key")
        values.update(ASC_KEY_ID=key_id, ASC_ISSUER_ID=issuer)
    append_env(values)
    p12.unlink()
    print("Temporary signing identity and matching distribution profile installed.")


def verify_app(folder):
    profile = plistlib.loads((folder / "profile.plist").read_bytes())
    expected = validate_profile(profile, os.environ)
    signed = plistlib.loads((folder / "signed-entitlements.plist").read_bytes())
    if (signed.get("application-identifier") != expected or
        signed.get("com.apple.developer.team-identifier") != os.environ["APPLE_TEAM_ID"] or
        signed.get("get-task-allow")):
        raise ValueError("Exported app signing entitlements do not match distribution profile")
    if signed.get("aps-environment") != profile["Entitlements"].get("aps-environment"):
        raise ValueError("Exported push entitlement does not match provisioning profile")
    print("Exported app team, application identifier and push entitlements verified.")


def cleanup(folder):
    if not folder.exists():
        return
    original = folder / "original-keychains.json"
    if original.exists():
        run("security", "list-keychains", "-d", "user", "-s", *json.loads(original.read_text()))
    keychain = folder / "build.keychain-db"
    if keychain.exists():
        run("security", "delete-keychain", str(keychain))
    installed = folder / "installed-profiles.json"
    if installed.exists():
        allowed = [(Path.home() / "Library/Developer/Xcode/UserData/Provisioning Profiles").resolve(),
                   (Path.home() / "Library/MobileDevice/Provisioning Profiles").resolve()]
        for name in json.loads(installed.read_text()):
            profile = Path(name).resolve()
            if profile.parent not in allowed or not re.fullmatch(r"[a-fA-F0-9-]{36}\.mobileprovision", profile.name):
                raise ValueError("Unexpected provisioning profile cleanup path")
            profile.unlink(missing_ok=True)
    # folder is a fixed child of RUNNER_TEMP, never a user-supplied deletion target.
    shutil.rmtree(folder)
    print("Temporary signing credentials removed.")


if __name__ == "__main__":
    os.umask(0o077)
    folder = Path(os.environ["RUNNER_TEMP"]).resolve() / "luxcare-ios-signing"
    try:
        {"install": install, "cleanup": cleanup, "verify-app": verify_app}[sys.argv[1]](folder)
    except (SigningCommandError, ValueError, KeyError) as error:
        sys.exit(str(error))
