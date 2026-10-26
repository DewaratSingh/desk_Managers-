"""
DeskManager Network Scanner & Chrome Launcher
Core scanning engine to discover active IPv4 addresses running port 5000 on the local router/network.
"""

import os
import sys
import re
import socket
import subprocess
import threading
import time
import urllib.request
import urllib.error
import webbrowser
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Optional, Callable


def get_default_gateways_and_interfaces() -> List[Dict[str, str]]:
    """
    Retrieves default gateway (router) IPs and corresponding network interface IPs on Windows.
    Returns list of dicts: [{'gateway': '192.168.1.1', 'interface': '192.168.1.50'}]
    """
    results = []
    seen = set()

    # Method 1: route print 0.0.0.0
    try:
        out = subprocess.check_output(['route', 'print', '0.0.0.0'], text=True, errors='ignore')
        for line in out.splitlines():
            parts = line.strip().split()
            if len(parts) >= 5 and parts[0] == '0.0.0.0' and parts[1] == '0.0.0.0':
                gw, iface = parts[2], parts[3]
                key = (gw, iface)
                if key not in seen and not gw.startswith('0.') and not iface.startswith(('127.', '169.254.')):
                    seen.add(key)
                    results.append({'gateway': gw, 'interface': iface})
    except Exception:
        pass

    # Method 2: Fallback via socket connection to external probe
    if not results:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            iface_ip = s.getsockname()[0]
            s.close()
            parts = iface_ip.split('.')
            if len(parts) == 4 and not iface_ip.startswith(('127.', '169.254.')):
                gw = f"{parts[0]}.{parts[1]}.{parts[2]}.1"
                results.append({'gateway': gw, 'interface': iface_ip})
        except Exception:
            pass

    # Method 3: Fallback to socket gethostbyname
    if not results:
        try:
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            parts = local_ip.split('.')
            if len(parts) == 4 and not local_ip.startswith(('127.', '169.254.')):
                gw = f"{parts[0]}.{parts[1]}.{parts[2]}.1"
                results.append({'gateway': gw, 'interface': local_ip})
        except Exception:
            pass

    return results


def get_arp_ips() -> List[str]:
    """
    Reads the system ARP cache ('arp -a') to find IP addresses of devices
    connected to the router / local network that recently exchanged traffic.
    """
    ips = set()
    try:
        out = subprocess.check_output(['arp', '-a'], text=True, errors='ignore')
        matches = re.findall(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', out)
        for ip in matches:
            # Filter multicast, broadcast, and invalid ranges
            if ip.startswith(('224.', '239.', '255.', '127.', '169.254.')):
                continue
            if ip.endswith(('.255', '.0')):
                continue
            ips.add(ip)
    except Exception:
        pass
    return sorted(list(ips))


def generate_subnet_ips(interface_ip: str) -> List[str]:
    """
    Generates all 254 host IPv4 addresses for the /24 subnet of the interface IP.
    E.g. for 192.168.1.50 -> ['192.168.1.1', ..., '192.168.1.254']
    """
    ips = []
    try:
        parts = interface_ip.split('.')
        if len(parts) == 4:
            base = f"{parts[0]}.{parts[1]}.{parts[2]}."
            for i in range(1, 255):
                ips.append(f"{base}{i}")
    except Exception:
        pass
    return ips


def check_port(ip: str, port: int = 5000, timeout: float = 0.35) -> bool:
    """
    Checks if a TCP port is open on the specified IP with a short timeout.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        res = sock.connect_ex((ip, port))
        return res == 0
    except Exception:
        return False
    finally:
        sock.close()


def verify_http_service(ip: str, port: int = 5000, timeout: float = 1.0) -> Dict[str, any]:
    """
    Sends a lightweight HTTP request to verify if an HTTP server is responding.
    Returns dict: {'url': str, 'status_code': int, 'message': str, 'is_http': bool}
    """
    url = f"http://{ip}:{port}"
    result = {
        "url": url,
        "is_http": False,
        "status_code": None,
        "server_header": None,
        "message": ""
    }
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'DeskManager-Scanner/1.0'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result["is_http"] = True
            result["status_code"] = resp.getcode()
            result["server_header"] = resp.headers.get('Server', resp.headers.get('X-Powered-By', ''))
            result["message"] = f"HTTP {resp.getcode()} OK"
    except urllib.error.HTTPError as e:
        result["is_http"] = True
        result["status_code"] = e.code
        result["message"] = f"HTTP {e.code}"
    except Exception:
        result["message"] = f"Port {port} Active"
    return result


def find_chrome_executable() -> Optional[str]:
    """
    Finds the full path to Google Chrome on Windows.
    Checks standard Program Files, LocalAppData, and system PATH.
    """
    candidates = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%SystemDrive%\Program Files\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%SystemDrive%\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return os.path.abspath(path)

    import shutil
    chrome_in_path = shutil.which("chrome.exe") or shutil.which("chrome")
    if chrome_in_path:
        return chrome_in_path

    return None


def open_in_chrome(url: str) -> bool:
    """
    Opens the specified URL in Google Chrome.
    Falls back gracefully to default browser if Chrome is not found.
    """
    chrome_path = find_chrome_executable()
    if chrome_path:
        try:
            subprocess.Popen([chrome_path, url])
            return True
        except Exception as e:
            print(f"[Warning] Failed to launch Chrome binary directly: {e}")

    try:
        chrome_browser = webbrowser.get('chrome')
        if chrome_browser:
            chrome_browser.open(url)
            return True
    except Exception:
        pass

    try:
        webbrowser.open(url)
        return True
    except Exception as e:
        print(f"[Error] Fallback browser launch failed: {e}")
        return False


def scan_network_for_port(
    port: int = 5000,
    max_workers: int = 80,
    socket_timeout: float = 0.35,
    on_candidate_checked: Optional[Callable[[int, int, str], None]] = None,
    on_found: Optional[Callable[[str, int, Dict], None]] = None,
    stop_event: Optional[threading.Event] = None
) -> List[Dict]:
    """
    Performs comprehensive discovery to find all router-connected IPv4 addresses running `port`.
    Priority:
    1. Local machine's router-assigned IPv4 address(es)
    2. Router gateway & ARP table connected devices
    3. Entire /24 subnet range of router interface
    4. Localhost (127.0.0.1) as fallback if no LAN server was found
    """
    found_servers = []
    found_ips = set()

    # 1. Gather routing info and ARP devices
    routes = get_default_gateways_and_interfaces()
    arp_ips = get_arp_ips()

    candidate_ips = []
    seen = set()

    def add_candidate(ip: str):
        if ip and ip not in seen and not ip.startswith(('127.', '169.254.')):
            seen.add(ip)
            candidate_ips.append(ip)

    # Priority 1: Local network interface IP (router-assigned IPv4)
    for r in routes:
        add_candidate(r["interface"])

    # Priority 2: Router Gateways & ARP cache of connected devices
    for r in routes:
        add_candidate(r["gateway"])
    for a in arp_ips:
        add_candidate(a)

    # Priority 3: Full subnet sweep of the router network
    for r in routes:
        subnet_hosts = generate_subnet_ips(r["interface"])
        for h in subnet_hosts:
            add_candidate(h)

    # Fallback if no routes found: try common router subnets
    if not candidate_ips:
        for subnet in ["192.168.1.", "192.168.0.", "10.0.0."]:
            for i in range(1, 255):
                add_candidate(f"{subnet}{i}")

    total_candidates = len(candidate_ips)
    checked_count = 0

    def probe(ip: str):
        if stop_event and stop_event.is_set():
            return None
        if check_port(ip, port, timeout=socket_timeout):
            info = verify_http_service(ip, port)
            return (ip, info)
        return None

    # Check high priority targets first (local IP, router gateway, ARP devices)
    high_priority = candidate_ips[:min(10, total_candidates)]
    remaining = candidate_ips[min(10, total_candidates):]

    for ip in high_priority:
        if stop_event and stop_event.is_set():
            break
        checked_count += 1
        if on_candidate_checked:
            on_candidate_checked(checked_count, total_candidates, ip)

        res = probe(ip)
        if res:
            ip_found, info = res
            if ip_found not in found_ips:
                found_ips.add(ip_found)
                item = {"ip": ip_found, "port": port, "url": f"http://{ip_found}:{port}", "info": info}
                found_servers.append(item)
                if on_found:
                    on_found(ip_found, port, item)

    # Concurrently sweep the rest of the subnet
    if remaining and not (stop_event and stop_event.is_set()):
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_ip = {executor.submit(probe, ip): ip for ip in remaining}
            for future in as_completed(future_to_ip):
                if stop_event and stop_event.is_set():
                    break
                checked_count += 1
                ip = future_to_ip[future]
                if on_candidate_checked:
                    on_candidate_checked(checked_count, total_candidates, ip)

                try:
                    res = future.result()
                    if res:
                        ip_found, info = res
                        if ip_found not in found_ips:
                            found_ips.add(ip_found)
                            item = {"ip": ip_found, "port": port, "url": f"http://{ip_found}:{port}", "info": info}
                            found_servers.append(item)
                            if on_found:
                                on_found(ip_found, port, item)
                except Exception:
                    pass

    # If nothing found on LAN, check localhost as ultimate fallback
    if not found_servers and not (stop_event and stop_event.is_set()):
        if check_port("127.0.0.1", port, timeout=socket_timeout):
            info = verify_http_service("127.0.0.1", port)
            item = {"ip": "127.0.0.1", "port": port, "url": f"http://127.0.0.1:{port}", "info": info}
            found_servers.append(item)
            if on_found:
                on_found("127.0.0.1", port, item)

    return found_servers


if __name__ == "__main__":
    print("=" * 65)
    print(" DeskManager Local Router Network Scanner & Chrome Opener")
    print("=" * 65)

    routes = get_default_gateways_and_interfaces()
    if routes:
        for r in routes:
            print(f"[Router Network] Gateway: {r['gateway']} | Your Local IPv4: {r['interface']}")
    else:
        print("[Router Network] Probing local network interfaces...")

    chrome = find_chrome_executable()
    print(f"[Chrome Path] {chrome or 'Not found (Using default browser)'}")
    print("[Action] Searching router network for devices running port 5000...\n")

    opened_once = False

    def handle_found(ip, port, item):
        global opened_once
        url = item['url']
        status = item['info'].get('message', 'Active')
        print(f"\n[SUCCESS] Found device running on port {port}: {ip}")
        print(f"[SUCCESS] URL: {url} ({status})")
        if not opened_once:
            opened_once = True
            print(f"[Action] Launching {url} in Google Chrome...")
            open_in_chrome(url)

    def handle_progress(checked, total, current_ip):
        sys.stdout.write(f"\rScanning router subnet... [{checked}/{total}] checking {current_ip:<16}")
        sys.stdout.flush()

    start_time = time.time()
    results = scan_network_for_port(
        port=5000,
        on_candidate_checked=handle_progress,
        on_found=handle_found
    )
    elapsed = time.time() - start_time
    print(f"\n\nScan completed in {elapsed:.2f} seconds. Discovered {len(results)} server(s).")
