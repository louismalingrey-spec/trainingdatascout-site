#!/usr/bin/env python3
"""Checks for the warming-domain GitHub Pages redirect kits.

Default run: file invariants and a local browser redirect to the fixed
destination. It does not change DNS or GitHub settings.

  python3 redirect-kits/tests/test_redirects.py
  python3 redirect-kits/tests/test_redirects.py --dns-pre
  python3 redirect-kits/tests/test_redirects.py --dns-post
"""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KITS = Path(__file__).resolve().parents[1]
DESTINATION = "https://trainingdatascout.com/"
DOMAINS = (
    "trainingdatascoutco.com",
    "trainingdatascoutfirm.com",
    "trainingdatascoutgroup.com",
    "trainingdatascoutpartners.com",
)
SCRIPT = 'location.replace("https://trainingdatascout.com/");'
REFRESH = "0; url=https://trainingdatascout.com/"
MAILPOOL_A = {
    "trainingdatascoutco.com": "35.208.109.108",
    "trainingdatascoutfirm.com": "35.208.229.137",
    "trainingdatascoutgroup.com": "35.209.3.54",
    "trainingdatascoutpartners.com": "35.209.224.115",
}
LANDING_FILES = (
    "CNAME",
    "index.html",
    "style.css",
    "dither.js",
    "picto.js",
    "favicon.svg",
    ".nojekyll",
    "CREDITS.md",
)


def load_json(name: str) -> dict:
    return json.loads((KITS / name).read_text())


def dig_short(name: str, record_type: str) -> list[str]:
    result = subprocess.run(
        ["dig", "+time=3", "+tries=2", "+short", name, record_type],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def is_destination(url: str) -> bool:
    parts = urllib.parse.urlsplit(url)
    return (
        parts.scheme == "https"
        and parts.hostname == "trainingdatascout.com"
        and parts.path in ("", "/")
        and parts.query == ""
        and parts.fragment == ""
        and parts.username is None
    )


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class RedirectHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def do_GET(self) -> None:
        path = urllib.parse.urlsplit(self.path).path
        body = self.server.page_body
        code = 200 if path in ("/", "/index.html") else 404
        self.server.events.append((code, self.path))
        payload = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt: str, *args: object) -> None:
        return


def chrome_page_urls(start_url: str, disable_javascript: bool) -> list[str]:
    port = free_port()
    profile = tempfile.mkdtemp(prefix="redirect-chrome-")
    command = [
        "google-chrome",
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        f"--user-data-dir={profile}",
        f"--remote-debugging-port={port}",
        start_url,
    ]
    if disable_javascript:
        command.insert(-1, "--blink-settings=scriptEnabled=false")
    error_log = tempfile.NamedTemporaryFile(prefix="redirect-chrome-", suffix=".log", delete=False)
    error_log.close()
    stderr_handle = open(error_log.name, "w")
    process = subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=stderr_handle,
        start_new_session=True,
    )
    last: list[str] = []
    try:
        deadline = time.time() + 30
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=1) as response:
                    targets = json.load(response)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ConnectionError):
                time.sleep(0.2)
                continue
            last = [item.get("url", "") for item in targets if item.get("type") == "page"]
            if any(is_destination(url) for url in last):
                return last
            if any(url.startswith("https://example.invalid/") for url in last):
                return last
            time.sleep(0.2)
        detail = Path(error_log.name).read_text(errors="replace")[-1000:]
        raise AssertionError(f"browser did not navigate, last urls: {last}, chrome: {detail}")
    finally:
        stderr_handle.close()
        Path(error_log.name).unlink(missing_ok=True)
        try:
            os.killpg(process.pid, 15)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, 9)
        shutil.rmtree(profile, ignore_errors=True)


def assert_redirect_html(html: str) -> None:
    from html.parser import HTMLParser

    class Collector(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.metas: list[dict[str, str]] = []
            self.links: list[dict[str, str]] = []
            self.anchors: list[dict[str, str]] = []
            self.scripts: list[str] = []
            self.external: list[str] = []
            self._script = False
            self._buf: list[str] = []

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            values = {key: value or "" for key, value in attrs}
            if tag in {"iframe", "img", "object", "embed", "video", "audio", "form"}:
                raise AssertionError(f"unexpected element {tag}")
            if tag == "meta":
                self.metas.append(values)
            elif tag == "link":
                self.links.append(values)
            elif tag == "a":
                self.anchors.append(values)
            elif tag == "script":
                if values.get("src"):
                    self.external.append(values["src"])
                self._script = True
                self._buf = []

        def handle_endtag(self, tag: str) -> None:
            if tag == "script" and self._script:
                self.scripts.append("".join(self._buf).strip())
                self._script = False

        def handle_data(self, data: str) -> None:
            if self._script:
                self._buf.append(data)

    parser = Collector()
    parser.feed(html)
    refresh = [
        meta for meta in parser.metas
        if meta.get("http-equiv", "").lower() == "refresh"
    ]
    if refresh != [{"http-equiv": "refresh", "content": REFRESH}]:
        raise AssertionError(f"meta refresh mismatch: {refresh}")
    robots = [meta for meta in parser.metas if meta.get("name") == "robots"]
    if robots != [{"name": "robots", "content": "noindex"}]:
        raise AssertionError(robots)
    if parser.links != [{"rel": "canonical", "href": DESTINATION}]:
        raise AssertionError(parser.links)
    if parser.anchors != [{"href": DESTINATION}]:
        raise AssertionError(parser.anchors)
    if parser.scripts != [SCRIPT]:
        raise AssertionError(parser.scripts)
    if parser.external:
        raise AssertionError(parser.external)
    if "Continue to Training Data Scout" not in html:
        raise AssertionError("visible fallback link text missing")
    urls = set()
    for token in ("http://", "https://"):
        start = 0
        while True:
            index = html.find(token, start)
            if index < 0:
                break
            end = index
            while end < len(html) and html[end] not in "\"' <>":
                end += 1
            urls.add(html[index:end])
            start = end
    if urls != {DESTINATION}:
        raise AssertionError(f"unexpected urls: {urls}")
    for banned in ("location.href", "location.assign", "window.open", "fetch(", "XMLHttpRequest", "eval(", "301"):
        if banned in html:
            raise AssertionError(banned)


def address_observation(zone: str) -> dict:
    return {
        "apex_a": dig_short(zone, "A"),
        "apex_aaaa": dig_short(zone, "AAAA"),
        "www_a": dig_short(f"www.{zone}", "A"),
        "www_cname": dig_short(f"www.{zone}", "CNAME"),
    }


def header_map(url: str) -> dict[str, str]:
    result = subprocess.run(
        ["curl", "-sI", "--max-time", "20", url],
        check=False,
        capture_output=True,
        text=True,
    )
    status = location = server = ""
    for line in result.stdout.splitlines():
        if line.startswith("HTTP/"):
            parts = line.split()
            status = parts[1] if len(parts) > 1 else ""
            location = ""
        elif line.lower().startswith("location:"):
            location = line.split(":", 1)[1].strip()
        elif line.lower().startswith("server:"):
            server = line.split(":", 1)[1].strip()
    return {"status": status, "location": location, "server": server}


def certificate_names(host: str) -> list[str]:
    client = subprocess.run(
        ["openssl", "s_client", "-connect", f"{host}:443", "-servername", host],
        input=b"",
        capture_output=True,
        timeout=25,
        check=False,
    )
    certificate = subprocess.run(
        ["openssl", "x509", "-noout", "-ext", "subjectAltName"],
        input=client.stdout,
        capture_output=True,
        timeout=10,
        check=False,
    )
    text = certificate.stdout.decode("utf-8", "replace")
    names = []
    for part in text.replace("\n", " ").split(","):
        part = part.strip()
        if "DNS:" in part:
            names.append(part.split("DNS:", 1)[1].strip())
    return names


def assess_post(zone: str, observed: dict, targets: dict) -> list[str]:
    errors = []
    if set(observed["apex_a"]) != set(targets["apex_a"]):
        errors.append(f"{zone} apex A is {observed['apex_a']}")
    if set(observed["apex_aaaa"]) != set(targets["apex_aaaa"]):
        errors.append(f"{zone} apex AAAA is {observed['apex_aaaa']}")
    if observed["www_a"]:
        errors.append(f"{zone} www still has A records {observed['www_a']}")
    if observed["www_cname"] != [targets["www_cname_fqdn"]]:
        errors.append(f"{zone} www CNAME is {observed['www_cname']}")
    if observed.get("apex_status") != "200":
        errors.append(f"{zone} apex HTTPS status is {observed.get('apex_status')}")
    location = observed.get("apex_location") or ""
    if location:
        errors.append(f"{zone} apex returned Location {location}; the landing hop is in the HTML body")
    if "github" not in (observed.get("apex_server") or "").lower():
        errors.append(f"{zone} apex server is {observed.get('apex_server')}")
    www_location = observed.get("www_location") or ""
    allowed_www = {f"https://{zone}/", f"https://{zone}", ""}
    if www_location not in allowed_www:
        errors.append(f"{zone} www Location {www_location} leaves the warming domain")
    required_names = {zone, f"www.{zone}"}
    if not required_names <= set(observed.get("cert_names") or []):
        errors.append(
            f"{zone} certificate names {sorted(observed.get('cert_names') or [])} omit apex or www"
        )
    if DESTINATION in (location, www_location):
        errors.append(f"{zone} HTTP Location points at the landing origin")
    return errors


class RedirectKitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.targets = load_json("github-pages-targets.json")
        cls.html = (KITS / DOMAINS[0] / "index.html").read_text()

    def test_destination_constant_matches_pages_target(self) -> None:
        self.assertEqual(self.targets["destination"], DESTINATION)
        self.assertEqual(set(self.targets["repos"]), set(DOMAINS))

    def test_each_kit_is_a_complete_pages_root(self) -> None:
        html_bytes = None
        for domain in DOMAINS:
            folder = KITS / domain
            files = sorted(path.name for path in folder.iterdir())
            self.assertEqual(files, [".nojekyll", "404.html", "CNAME", "index.html"])
            self.assertEqual((folder / ".nojekyll").read_bytes(), b"")
            self.assertEqual((folder / "CNAME").read_text().strip(), domain)
            self.assertNotIn("\n", (folder / "CNAME").read_text().strip())
            index = (folder / "index.html").read_bytes()
            self.assertEqual((folder / "404.html").read_bytes(), index)
            html_bytes = index if html_bytes is None else html_bytes
            self.assertEqual(index, html_bytes)
            assert_redirect_html(index.decode())

    def test_runbook_quotes_official_addresses_and_destination(self) -> None:
        runbook = (KITS / "RUNBOOK.md").read_text()
        for value in self.targets["apex_a"] + self.targets["apex_aaaa"]:
            self.assertIn(value, runbook)
        self.assertIn(self.targets["www_cname"], runbook)
        self.assertIn(DESTINATION, runbook)
        self.assertIn(self.targets["verification_txt_host"], runbook)
        for domain, address in MAILPOOL_A.items():
            self.assertIn(address, runbook)
            self.assertIn(self.targets["repos"][domain], runbook)
        blob = "\n".join(
            path.read_text(errors="replace")
            for path in KITS.rglob("*")
            if path.is_file() and "tests" not in path.parts and "__pycache__" not in path.parts
        )
        self.assertNotIn("v=DKIM1", blob)
        self.assertNotIn("google-site-verification=", blob)
        self.assertFalse((KITS / "dns").exists())

    def test_post_checker_accepts_only_the_fixed_setup(self) -> None:
        zone = "trainingdatascoutco.com"
        good = {
            "apex_a": list(self.targets["apex_a"]),
            "apex_aaaa": list(self.targets["apex_aaaa"]),
            "www_a": [],
            "www_cname": [self.targets["www_cname_fqdn"]],
            "apex_status": "200",
            "apex_location": "",
            "apex_server": "GitHub.com",
            "www_location": "https://trainingdatascoutco.com/",
            "cert_names": [zone, f"www.{zone}"],
        }
        self.assertEqual(assess_post(zone, good, self.targets), [])
        leaked = dict(good, apex_location=DESTINATION)
        self.assertTrue(assess_post(zone, leaked, self.targets))
        wrong_www = dict(good, www_cname=["trainingdatascout.com."])
        self.assertTrue(assess_post(zone, wrong_www, self.targets))
        leftover = dict(good, apex_a=list(self.targets["apex_a"]) + ["35.208.109.108"])
        self.assertTrue(assess_post(zone, leftover, self.targets))

    def test_landing_repository_files_match_origin_main(self) -> None:
        self.assertEqual((ROOT / "CNAME").read_bytes(), b"trainingdatascout.com")
        for relative in LANDING_FILES:
            committed = subprocess.check_output(["git", "show", f"origin/main:{relative}"])
            self.assertEqual((ROOT / relative).read_bytes(), committed, relative)
        changed = []
        for args in (
            ["git", "diff", "--name-only", "origin/main"],
            ["git", "diff", "--name-only", "--cached"],
            ["git", "ls-files", "--others", "--exclude-standard"],
        ):
            output = subprocess.check_output(args, cwd=ROOT, text=True)
            changed.extend(line for line in output.splitlines() if line)
        for path in changed:
            self.assertTrue(path.startswith("redirect-kits/"), path)

    def test_browser_redirects_to_the_fixed_destination(self) -> None:
        html = (KITS / "trainingdatascoutco.com" / "index.html").read_text()
        server = ThreadingHTTPServer(("127.0.0.1", 0), RedirectHandler)
        server.page_body = html
        server.events = []
        port = server.server_address[1]
        import threading
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            cases = [
                (f"http://127.0.0.1:{port}/", False),
                (f"http://127.0.0.1:{port}/?next=https://evil.example&to=//evil.example", False),
                (f"http://127.0.0.1:{port}/some/path?next=https://evil.example", False),
                (f"http://127.0.0.1:{port}/https://evil.example", True),
            ]
            probe = ThreadingHTTPServer(("127.0.0.1", 0), RedirectHandler)
            probe.page_body = (
                '<meta http-equiv="refresh" content="0; url=https://trainingdatascout.com/">'
                '<script>location.replace("https://example.invalid/js");</script>'
            )
            probe.events = []
            probe_port = probe.server_address[1]
            probe_thread = threading.Thread(target=probe.serve_forever, daemon=True)
            probe_thread.start()
            probe_urls = chrome_page_urls(f"http://127.0.0.1:{probe_port}/", disable_javascript=True)
            print("no-javascript probe:", probe_urls)
            self.assertTrue(any(is_destination(url) for url in probe_urls), probe_urls)
            self.assertFalse(any("example.invalid" in url for url in probe_urls), probe_urls)
            for start, disable_javascript in cases:
                urls = chrome_page_urls(start, disable_javascript=disable_javascript)
                print(("script-disabled" if disable_javascript else "script-enabled"), start, "->", urls)
                landed = [url for url in urls if is_destination(url)]
                self.assertEqual(landed, [DESTINATION], urls)
                self.assertFalse(any("evil.example" in url for url in urls), urls)
            statuses = [code for code, _path in server.events]
            self.assertIn(200, statuses)
            self.assertIn(404, statuses)
            self.assertNotIn("Location", html)
        finally:
            server.shutdown()
            if "probe" in locals():
                probe.shutdown()


def live_dns(mode: str) -> int:
    targets = load_json("github-pages-targets.json")
    failed = False
    for zone in DOMAINS:
        observed = address_observation(zone)
        if mode == "pre":
            zone_errors = []
            expected = [MAILPOOL_A[zone]]
            if observed["apex_a"] != expected or observed["www_a"] != expected:
                zone_errors.append(f"address records {observed}")
            if observed["apex_aaaa"] or observed["www_cname"]:
                zone_errors.append(f"unexpected address records {observed}")
            if zone_errors:
                failed = True
                print(f"PRE {zone}")
                for error in zone_errors:
                    print(f"  {error}")
            else:
                print(f"PRE {zone} still uses {expected[0]} for apex and www")
            continue
        apex = header_map(f"https://{zone}/")
        www = header_map(f"https://www.{zone}/")
        observed.update({
            "apex_status": apex["status"],
            "apex_location": apex["location"],
            "apex_server": apex["server"],
            "www_location": www["location"],
            "cert_names": certificate_names(zone),
        })
        errors = assess_post(zone, observed, targets)
        if errors:
            failed = True
            print(f"POST {zone}")
            for error in errors:
                print(f"  {error}")
        else:
            print(f"POST {zone} matches the GitHub Pages target")
    return 1 if failed else 0


if __name__ == "__main__":
    mode = None
    if "--dns-pre" in sys.argv:
        sys.argv.remove("--dns-pre")
        mode = "pre"
    if "--dns-post" in sys.argv:
        sys.argv.remove("--dns-post")
        mode = "post"
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RedirectKitTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    dns_code = live_dns(mode) if mode else 0
    sys.exit(0 if result.wasSuccessful() and dns_code == 0 else 1)
