"""Tool: fetch_url.

Fetches and extracts readable text from a public web page.

Security:
- HTTPS only (no plain HTTP, no file://).
- Hostname must not resolve to a loopback / private / link-local IP
  (basic SSRF guard; rely on a real egress firewall in production).
- Response truncated to ``MAX_FETCH_BYTES``.
- Hard timeout ``FETCH_TIMEOUT_SECONDS``.
"""

from __future__ import annotations

import ipaddress
import json
import socket
from urllib.parse import urlparse

import httpx
from langchain_core.tools import tool

from ..config import settings


_BLOCKED_HOSTS = {"localhost", "metadata.google.internal", "169.254.169.254"}


def _is_safe_host(hostname: str) -> tuple[bool, str]:
    """Resolve the host once and refuse private/loopback ranges."""
    if not hostname:
        return False, "missing hostname"
    if hostname.lower() in _BLOCKED_HOSTS:
        return False, f"blocked host: {hostname}"
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        return False, f"dns failure: {exc}"
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False, f"refused private address {addr}"
    return True, ""


@tool
def fetch_url(url: str) -> str:
    """Fetch a public HTTPS URL and return its main text content.

    Only call with URLs returned by `web_search`. Do not fabricate URLs.

    Args:
        url: A full HTTPS URL.

    Returns:
        JSON: {"url", "title", "text"} on success, {"error": "..."} on failure.
    """
    parsed = urlparse(url or "")
    if parsed.scheme != "https":
        return json.dumps({"error": "fetch_url accepts https URLs only"})

    ok, reason = _is_safe_host(parsed.hostname or "")
    if not ok:
        return json.dumps({"error": f"refused for safety: {reason}"})

    try:
        with httpx.Client(
            timeout=settings.fetch_timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": "MilestoneAgent/0.1 (+local-demo)"},
        ) as client:
            r = client.get(url)
            r.raise_for_status()
            raw = r.text[: settings.max_fetch_bytes]
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": f"fetch_url failed: {exc}"})

    title = ""
    text = raw
    try:
        import trafilatura

        extracted = trafilatura.extract(raw, include_comments=False, include_tables=False)
        if extracted:
            text = extracted
        meta = trafilatura.extract_metadata(raw)
        if meta and meta.title:
            title = meta.title
    except Exception:
        pass

    return json.dumps(
        {"url": url, "title": title, "text": (text or "").strip()[:5000]},
        ensure_ascii=False,
    )
