"""
DeskManager - Router Network Discovery & Chrome Launcher
A lightweight, modern Python desktop application that searches all IP addresses
connected to the local router for active services on port 5000, retrieves their
IPv4 address, and automatically opens the web service in Google Chrome.
"""

import os
import sys
import argparse
import threading
import time
import tkinter as tk
from tkinter import ttk, messagebox

# Enable High-DPI awareness on Windows for sharp fonts
if sys.platform == "win32":
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

from scanner import (
    get_default_gateways_and_interfaces,
    scan_network_for_port,
    open_in_chrome,
    find_chrome_executable
)


class DeskManagerApp:
    def __init__(self, root, auto_scan: bool = True, target_port: int = 5000):
        self.root = root
        self.target_port = target_port
        self.auto_scan = auto_scan

        self.scanning = False
        self.stop_event = threading.Event()
        self.found_servers = []
        self.opened_urls = set()

        self.setup_window()
        self.setup_styles()
        self.build_ui()
        self.refresh_network_info()

        if self.auto_scan:
            self.root.after(300, self.start_scan)

    def setup_window(self):
        self.root.title("DeskManager - Router Network Server Finder")
        self.root.geometry("740x620")
        self.root.minsize(680, 520)
        self.root.configure(bg="#0f172a")

        # Set window icon if present
        base_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
        icon_path = os.path.join(base_dir, "deskmanager.ico")
        if os.path.exists(icon_path):
            try:
                self.root.iconbitmap(icon_path)
            except Exception:
                pass

        # Center window on screen
        self.root.update_idletasks()
        w = self.root.winfo_width()
        h = self.root.winfo_height()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = max(0, int((sw - w) / 2))
        y = max(0, int((sh - h) / 2))
        self.root.geometry(f"{w}x{h}+{x}+{y}")

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        # Colors
        bg_dark = "#0f172a"
        card_bg = "#1e293b"
        card_border = "#334155"
        accent_blue = "#2563eb"
        text_light = "#f8fafc"
        text_muted = "#94a3b8"

        # Treeview styling
        style.configure(
            "Treeview",
            background=card_bg,
            foreground=text_light,
            fieldbackground=card_bg,
            rowheight=32,
            font=("Segoe UI", 10),
            borderwidth=0
        )
        style.map(
            "Treeview",
            background=[("selected", accent_blue)],
            foreground=[("selected", "#ffffff")]
        )
        style.configure(
            "Treeview.Heading",
            background="#334155",
            foreground=text_light,
            relief="flat",
            font=("Segoe UI", 10, "bold")
        )
        style.map(
            "Treeview.Heading",
            background=[("active", "#475569")]
        )

        # Progressbar
        style.configure(
            "Accent.Horizontal.TProgressbar",
            troughcolor="#1e293b",
            background="#2563eb",
            bordercolor="#334155",
            lightcolor="#3b82f6",
            darkcolor="#1d4ed8"
        )

    def build_ui(self):
        # Main container with padding
        main_frame = tk.Frame(self.root, bg="#0f172a", padx=20, pady=16)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # 1. Header Section
        header_frame = tk.Frame(main_frame, bg="#0f172a")
        header_frame.pack(fill=tk.X, pady=(0, 12))

        title_lbl = tk.Label(
            header_frame,
            text="DeskManager Network Finder",
            font=("Segoe UI", 16, "bold"),
            fg="#f8fafc",
            bg="#0f172a"
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(
            header_frame,
            text="Searches all router IP addresses for port 5000 and opens in Google Chrome",
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#0f172a"
        )
        subtitle_lbl.pack(anchor="w", pady=(2, 0))

        # 2. Network Info Card
        info_card = tk.Frame(main_frame, bg="#1e293b", highlightbackground="#334155", highlightthickness=1, padx=14, pady=10)
        info_card.pack(fill=tk.X, pady=(0, 12))

        info_inner = tk.Frame(info_card, bg="#1e293b")
        info_inner.pack(fill=tk.X)

        # Router Gateway
        lbl_gw_title = tk.Label(info_inner, text="ROUTER GATEWAY:", font=("Segoe UI", 8, "bold"), fg="#94a3b8", bg="#1e293b")
        lbl_gw_title.grid(row=0, column=0, sticky="w", padx=(0, 4))
        self.lbl_gw_val = tk.Label(info_inner, text="Detecting...", font=("Segoe UI", 9, "bold"), fg="#38bdf8", bg="#1e293b")
        self.lbl_gw_val.grid(row=0, column=1, sticky="w", padx=(0, 24))

        # Local IPv4
        lbl_ip_title = tk.Label(info_inner, text="LOCAL IPV4:", font=("Segoe UI", 8, "bold"), fg="#94a3b8", bg="#1e293b")
        lbl_ip_title.grid(row=0, column=2, sticky="w", padx=(0, 4))
        self.lbl_ip_val = tk.Label(info_inner, text="Detecting...", font=("Segoe UI", 9, "bold"), fg="#38bdf8", bg="#1e293b")
        self.lbl_ip_val.grid(row=0, column=3, sticky="w", padx=(0, 24))

        # Target Port
        lbl_port_title = tk.Label(info_inner, text="PORT:", font=("Segoe UI", 8, "bold"), fg="#94a3b8", bg="#1e293b")
        lbl_port_title.grid(row=0, column=4, sticky="w", padx=(0, 6))

        self.port_var = tk.StringVar(value=str(self.target_port))
        self.port_entry = tk.Entry(
            info_inner,
            textvariable=self.port_var,
            font=("Segoe UI", 9, "bold"),
            width=6,
            bg="#0f172a",
            fg="#f8fafc",
            insertbackground="#ffffff",
            relief="flat",
            highlightbackground="#475569",
            highlightthickness=1,
            justify="center"
        )
        self.port_entry.grid(row=0, column=5, sticky="w")

        # 3. Status & Progress Card
        status_card = tk.Frame(main_frame, bg="#1e293b", highlightbackground="#334155", highlightthickness=1, padx=14, pady=10)
        status_card.pack(fill=tk.X, pady=(0, 12))

        status_top = tk.Frame(status_card, bg="#1e293b")
        status_top.pack(fill=tk.X)

        self.status_icon = tk.Label(status_top, text="●", font=("Segoe UI", 12), fg="#38bdf8", bg="#1e293b")
        self.status_icon.pack(side=tk.LEFT, padx=(0, 6))

        self.status_label = tk.Label(
            status_top,
            text="Ready to scan router network",
            font=("Segoe UI", 10, "bold"),
            fg="#f8fafc",
            bg="#1e293b"
        )
        self.status_label.pack(side=tk.LEFT)

        self.auto_open_var = tk.BooleanVar(value=True)
        self.chk_auto_open = tk.Checkbutton(
            status_top,
            text="Auto-open in Chrome",
            variable=self.auto_open_var,
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#1e293b",
            activebackground="#1e293b",
            activeforeground="#f8fafc",
            selectcolor="#0f172a"
        )
        self.chk_auto_open.pack(side=tk.RIGHT)

        self.progress_bar = ttk.Progressbar(
            status_card,
            orient="horizontal",
            mode="determinate",
            style="Accent.Horizontal.TProgressbar"
        )
        self.progress_bar.pack(fill=tk.X, pady=(8, 2))

        # 4. Results Section (Table of Discovered Servers)
        results_frame = tk.Frame(main_frame, bg="#0f172a")
        results_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        results_header = tk.Frame(results_frame, bg="#0f172a")
        results_header.pack(fill=tk.X, pady=(0, 6))

        res_title = tk.Label(
            results_header,
            text="Discovered Services Running on Port 5000",
            font=("Segoe UI", 10, "bold"),
            fg="#f8fafc",
            bg="#0f172a"
        )
        res_title.pack(side=tk.LEFT)

        self.res_count_lbl = tk.Label(
            results_header,
            text="0 found",
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#0f172a"
        )
        self.res_count_lbl.pack(side=tk.RIGHT)

        # Treeview Table
        table_container = tk.Frame(results_frame, bg="#1e293b", highlightbackground="#334155", highlightthickness=1)
        table_container.pack(fill=tk.BOTH, expand=True)

        columns = ("ip", "port", "url", "status")
        self.tree = ttk.Treeview(table_container, columns=columns, show="headings", selectmode="browse")
        self.tree.heading("ip", text="IPv4 Address")
        self.tree.heading("port", text="Port")
        self.tree.heading("url", text="Full Web URL")
        self.tree.heading("status", text="Response Status")

        self.tree.column("ip", width=140, anchor="center")
        self.tree.column("port", width=80, anchor="center")
        self.tree.column("url", width=260, anchor="w")
        self.tree.column("status", width=140, anchor="center")

        tree_scroll = ttk.Scrollbar(table_container, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scroll.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.tree.bind("<Double-1>", lambda event: self.open_selected_in_chrome())

        # 5. Bottom Action Controls
        control_frame = tk.Frame(main_frame, bg="#0f172a")
        control_frame.pack(fill=tk.X, pady=(4, 0))

        self.btn_scan = tk.Button(
            control_frame,
            text="🔍 Scan Network",
            font=("Segoe UI", 10, "bold"),
            bg="#2563eb",
            fg="#ffffff",
            activebackground="#1d4ed8",
            activeforeground="#ffffff",
            relief="flat",
            padx=16,
            pady=8,
            cursor="hand2",
            command=self.start_scan
        )
        self.btn_scan.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_chrome = tk.Button(
            control_frame,
            text="🚀 Open in Chrome",
            font=("Segoe UI", 10, "bold"),
            bg="#10b981",
            fg="#ffffff",
            activebackground="#059669",
            activeforeground="#ffffff",
            relief="flat",
            padx=16,
            pady=8,
            cursor="hand2",
            command=self.open_selected_in_chrome
        )
        self.btn_chrome.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_copy = tk.Button(
            control_frame,
            text="📋 Copy URL",
            font=("Segoe UI", 9),
            bg="#334155",
            fg="#f8fafc",
            activebackground="#475569",
            activeforeground="#ffffff",
            relief="flat",
            padx=12,
            pady=8,
            cursor="hand2",
            command=self.copy_selected_url
        )
        self.btn_copy.pack(side=tk.LEFT)

        # Chrome detected indicator
        chrome_exe = find_chrome_executable()
        chrome_status = "Google Chrome Ready" if chrome_exe else "Chrome not detected (Fallback: Default Browser)"
        self.lbl_chrome_status = tk.Label(
            control_frame,
            text=f"🌐 {chrome_status}",
            font=("Segoe UI", 8),
            fg="#94a3b8" if chrome_exe else "#f59e0b",
            bg="#0f172a"
        )
        self.lbl_chrome_status.pack(side=tk.RIGHT, pady=6)

    def refresh_network_info(self):
        routes = get_default_gateways_and_interfaces()
        if routes:
            gw = routes[0]["gateway"]
            iface = routes[0]["interface"]
            self.lbl_gw_val.config(text=gw)
            self.lbl_ip_val.config(text=iface)
        else:
            self.lbl_gw_val.config(text="Unknown")
            self.lbl_ip_val.config(text="127.0.0.1")

    def log_status(self, text: str, color: str = "#f8fafc", icon_color: str = "#38bdf8"):
        self.status_label.config(text=text, fg=color)
        self.status_icon.config(fg=icon_color)

    def start_scan(self):
        if self.scanning:
            return

        # Validate port
        try:
            port = int(self.port_var.get().strip())
            if not (1 <= port <= 65535):
                raise ValueError
        except ValueError:
            messagebox.showerror("Invalid Port", "Please enter a valid TCP port number between 1 and 65535.")
            return

        self.target_port = port
        self.scanning = True
        self.stop_event.clear()
        self.btn_scan.config(text="⏹ Stop Scan", bg="#dc2626", activebackground="#b91c1c", command=self.stop_scan)

        # Clear previous items
        for item in self.tree.get_children():
            self.tree.delete(item)
        self.found_servers.clear()
        self.res_count_lbl.config(text="0 found")
        self.progress_bar["value"] = 0

        self.log_status(f"Scanning router network for port {self.target_port}...", "#38bdf8", "#38bdf8")

        thread = threading.Thread(target=self._scan_worker, daemon=True)
        thread.start()

    def stop_scan(self):
        if self.scanning:
            self.stop_event.set()
            self.log_status("Stopping scan...", "#f59e0b", "#f59e0b")

    def _scan_worker(self):
        def on_progress(checked, total, current_ip):
            self.root.after(0, self._update_progress, checked, total, current_ip)

        def on_found(ip, port, item):
            self.root.after(0, self._add_found_server, ip, port, item)

        results = scan_network_for_port(
            port=self.target_port,
            max_workers=80,
            socket_timeout=0.35,
            on_candidate_checked=on_progress,
            on_found=on_found,
            stop_event=self.stop_event
        )

        self.root.after(0, self._finish_scan, results)

    def _update_progress(self, checked, total, current_ip):
        if total > 0:
            pct = int((checked / total) * 100)
            self.progress_bar["value"] = pct
            self.log_status(f"Scanning router subnet [{checked}/{total}] Probing {current_ip}...", "#94a3b8", "#38bdf8")

    def _add_found_server(self, ip: str, port: int, item: dict):
        url = item["url"]
        msg = item["info"].get("message", f"Port {port} Open")

        # Insert into treeview
        row_id = self.tree.insert("", tk.END, values=(ip, port, url, msg))
        self.found_servers.append(item)
        self.res_count_lbl.config(text=f"{len(self.found_servers)} found")

        # Select first item automatically
        if len(self.found_servers) == 1:
            self.tree.selection_set(row_id)
            self.tree.focus(row_id)

        # Auto-open in Chrome
        if self.auto_open_var.get() and url not in self.opened_urls:
            self.opened_urls.add(url)
            self.log_status(f"Found {ip}:{port}! Opening in Chrome...", "#10b981", "#10b981")
            open_in_chrome(url)

    def _finish_scan(self, results):
        self.scanning = False
        self.btn_scan.config(text="🔍 Scan Network", bg="#2563eb", activebackground="#1d4ed8", command=self.start_scan)
        self.progress_bar["value"] = 100

        count = len(self.found_servers)
        if count > 0:
            self.log_status(f"Scan complete. Discovered {count} server(s) running port {self.target_port}.", "#10b981", "#10b981")
        else:
            self.log_status(f"Scan complete. No servers found on port {self.target_port}.", "#f59e0b", "#f59e0b")

    def get_selected_url(self) -> str:
        selected = self.tree.selection()
        if selected:
            values = self.tree.item(selected[0], "values")
            if len(values) >= 3:
                return values[2]
        elif self.found_servers:
            return self.found_servers[0]["url"]
        return ""

    def open_selected_in_chrome(self):
        url = self.get_selected_url()
        if not url:
            messagebox.showinfo("No Server Selected", "Please select a discovered server or run a scan first.")
            return

        success = open_in_chrome(url)
        if success:
            self.log_status(f"Opened {url} in Google Chrome.", "#10b981", "#10b981")
        else:
            messagebox.showerror("Launch Error", f"Could not launch browser for URL: {url}")

    def copy_selected_url(self):
        url = self.get_selected_url()
        if not url:
            messagebox.showinfo("No Server", "No URL available to copy.")
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(url)
        self.log_status(f"Copied {url} to clipboard!", "#38bdf8", "#38bdf8")

    def on_close(self):
        self.stop_event.set()
        self.root.destroy()


def run_cli_mode(port: int = 5000, no_open: bool = False):
    """
    Headless command line mode.
    """
    print("=" * 65)
    print(f" DeskManager Network Scanner (CLI Mode) - Port {port}")
    print("=" * 65)

    routes = get_default_gateways_and_interfaces()
    if routes:
        for r in routes:
            print(f"[Router Network] Gateway: {r['gateway']} | Local IPv4: {r['interface']}")

    chrome = find_chrome_executable()
    print(f"[Chrome Path] {chrome or 'Not found (Using default browser)'}")
    print(f"[Action] Searching router network for devices running port {port}...\n")

    opened_once = False

    def handle_found(ip, port_num, item):
        nonlocal opened_once
        url = item['url']
        status = item['info'].get('message', 'Active')
        print(f"\n[FOUND] IPv4 Address: {ip} | Port: {port_num}")
        print(f"[FOUND] Full URL:     {url} ({status})")
        if not no_open and not opened_once:
            opened_once = True
            print(f"[Action] Opening {url} in Google Chrome...")
            open_in_chrome(url)

    def handle_progress(checked, total, current_ip):
        sys.stdout.write(f"\rScanning router subnet... [{checked}/{total}] checking {current_ip:<16}")
        sys.stdout.flush()

    start_time = time.time()
    results = scan_network_for_port(
        port=port,
        on_candidate_checked=handle_progress,
        on_found=handle_found
    )
    elapsed = time.time() - start_time
    print(f"\n\nScan completed in {elapsed:.2f} seconds. Discovered {len(results)} server(s).")
    if results:
        print("\nDiscovered Active Servers:")
        for idx, s in enumerate(results, 1):
            print(f"  {idx}. {s['url']} ({s['ip']}) - {s['info'].get('message')}")


def main():
    parser = argparse.ArgumentParser(description="DeskManager Router Network Scanner & Chrome Opener")
    parser.add_argument("--cli", action="store_true", help="Run in command line mode without GUI")
    parser.add_argument("--port", type=int, default=5000, help="Target port to search for (default: 5000)")
    parser.add_argument("--no-open", action="store_true", help="Do not automatically open Chrome")
    parser.add_argument("--no-auto-scan", action="store_true", help="Do not start scan automatically on GUI open")
    args = parser.parse_args()

    if args.cli:
        run_cli_mode(port=args.port, no_open=args.no_open)
    else:
        root = tk.Tk()
        app = DeskManagerApp(root, auto_scan=not args.no_auto_scan, target_port=args.port)
        root.mainloop()


if __name__ == "__main__":
    main()
