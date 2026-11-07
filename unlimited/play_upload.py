"""Upload an Android app bundle to a Google Play track (used by .github/workflows/unlimited-android.yml).

Usage: play_upload.py <bundle.aab> <internal|production>. Reads the service account JSON from PLAY_SERVICE_ACCOUNT_JSON.
"""
from __future__ import annotations

import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

PACKAGE = os.environ.get("UNLIMITED_ANDROID_ID", "technology.unlimitedsolutions.agent")


def main(aab: str, track: str) -> int:
    info = json.loads(os.environ["PLAY_SERVICE_ACCOUNT_JSON"])
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/androidpublisher"])
    api = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)
    edit = api.edits().insert(packageName=PACKAGE, body={}).execute()
    eid = edit["id"]
    bundle = api.edits().bundles().upload(
        packageName=PACKAGE, editId=eid,
        media_body=MediaFileUpload(aab, mimetype="application/octet-stream", resumable=True)).execute()
    code = bundle["versionCode"]
    api.edits().tracks().update(packageName=PACKAGE, editId=eid, track=track, body={
        "track": track, "releases": [{"versionCodes": [str(code)], "status": "completed"}]}).execute()
    api.edits().commit(packageName=PACKAGE, editId=eid).execute()
    print(f"uploaded version {code} to {track}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
