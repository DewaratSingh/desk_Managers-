#!/usr/bin/env python3
"""
Shreeji Industries - DeskManager Server Controller
A professional, high-fidelity desktop dashboard designed to configure, start, stop, 
and monitor the Unified DeskManager Application. Includes automatic crash-detection,
health check validation, and file-based log storage.
"""

import os
import sys
import json
import time
import queue
import threading
import subprocess
import urllib.request
import urllib.error
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter.scrolledtext import ScrolledText

# Premium Design System Tokens
COLOR_BG = "#0B0F19"
COLOR_PANEL = "#151B2C"
COLOR_TEXT_MAIN = "#F8FAFC"
COLOR_TEXT_MUTED = "#94A3B8"
COLOR_ACCENT = "#DC332E"
COLOR_SUCCESS_BG = "#064E3B"
COLOR_DANGER_BG = "#7F1D1D"
COLOR_WARNING_BG = "#78350F"
COLOR_CONSOLE_BG = "#030712"
COLOR_CONSOLE_FG = "#E2E8F0"

FONT_FAMILY_MAIN = "Segoe UI"
FONT_FAMILY_MONO = "Consolas"

CONFIG_FILENAME = ".desk_manager_config.json"
LOG_FILENAME = "deskmanager_app.log"

class ServerProcess:
    def __init__(self, name, relative_dir, start_command, log_callback, status_callback, event_callback):
        self.name = name
        self.relative_dir = relative_dir
        self.start_command = start_command
        self.log_callback = log_callback
        self.status_callback = status_callback
        self.event_callback = event_callback
        
        self.root_dir = ""
        self.process = None
        self.thread = None
        self.should_be_running = False
        self.lock = threading.Lock()
        
    def set_root_dir(self, root_dir):
        self.root_dir = root_dir

    def get_working_dir(self):
        return os.path.normpath(os.path.join(self.root_dir, self.relative_dir))

    def start(self):
        with self.lock:
            if self.should_be_running:
                return
            self.should_be_running = True
            
        self.status_callback("Starting...")
        self.event_callback(f"Starting {self.name}...")
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        with self.lock:
            self.should_be_running = False
            
        if self.process:
            self.event_callback(f"Stopping {self.name} and cleaning up process tree...")
            self._kill_process_tree()
            
        self.status_callback("Stopped")
        self.event_callback(f"{self.name} stopped successfully.")

    def _run_loop(self):
        retry_cooldown = 2.0
        
        while True:
            with self.lock:
                if not self.should_be_running:
                    break
            
            working_dir = self.get_working_dir()
            if not os.path.exists(working_dir):
                self.status_callback("Error")
                self.event_callback(f"Error: Directory not found - {working_dir}")
                break
            
            self.status_callback("Running")
            self.event_callback(f"{self.name} started in: {working_dir}")
            
            try:
                startupinfo = None
                creationflags = 0
                if sys.platform == "win32":
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = subprocess.SW_HIDE
                    creationflags = subprocess.CREATE_NO_WINDOW
                
                self.process = subprocess.Popen(
                    self.start_command,
                    cwd=working_dir,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    startupinfo=startupinfo,
                    creationflags=creationflags
                )
                
                for line in self.process.stdout:
                    self.log_callback(line)
                    
                self.process.wait()
                exit_code = self.process.returncode
                self.process = None
                
            except Exception as e:
                self.event_callback(f"Exception while running {self.name}: {str(e)}")
                exit_code = -1
                time.sleep(retry_cooldown)
            
            with self.lock:
                if not self.should_be_running:
                    break
                    
            self.status_callback("Crashed")
            self.event_callback(f"WARNING: {self.name} exited unexpectedly (Code: {exit_code}).")
            self.event_callback(f"Auto-Restarting {self.name} in {retry_cooldown} seconds...")
            time.sleep(retry_cooldown)

    def _kill_process_tree(self):
        if not self.process:
            return
        pid = self.process.pid
        try:
            if sys.platform == "win32":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
            else:
                self.process.terminate()
                self.process.wait(timeout=3)
        except Exception as e:
            self.event_callback(f"Error terminating process tree for {self.name}: {str(e)}")

class ControllerApp(tk.Tk):
    def __init__(self):
        super().__init__()
        
        self.title("Shreeji Industries — DeskManager Server Controller")
        self.geometry("960x680")
        self.minsize(800, 600)
        self.configure(bg=COLOR_BG)
        
        self.gui_queue = queue.Queue()
        self.root_directory = ""
        self.config_path = os.path.join(os.path.expanduser("~"), CONFIG_FILENAME)
        
        # Unified backend process
        self.app_process = ServerProcess(
            name="DeskManager App",
            relative_dir="backend",
            start_command="npm start",
            log_callback=self.handle_app_log,
            status_callback=lambda status: self.queue_gui_call(self.update_status, status),
            event_callback=lambda msg: self.queue_gui_call(self.append_system_event, msg)
        )
        
        self.build_ui()
        self.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.poll_queue()
        self.load_or_prompt_directory()
        
        # Start health check thread
        self.health_thread_active = True
        threading.Thread(target=self.health_check_loop, daemon=True).start()

    def handle_app_log(self, message):
        # Store in log file
        try:
            with open(LOG_FILENAME, "a", encoding="utf-8") as f:
                f.write(message)
        except Exception:
            pass
        # Display in GUI
        self.queue_gui_call(self.append_log, message)

    def health_check_loop(self):
        while self.health_thread_active:
            if self.app_process.should_be_running:
                try:
                    req = urllib.request.Request("http://localhost:5000/api/health")
                    with urllib.request.urlopen(req, timeout=2) as response:
                        if response.status == 200:
                            self.queue_gui_call(self.set_health_ok)
                except Exception:
                    # If health fails while it should be running, it's starting/error
                    pass
            time.sleep(3)

    def set_health_ok(self):
        # Once health is confirmed, update status badge specifically if it's currently "Running"
        current_text = self.lbl_app_badge.cget("text")
        if current_text == "RUNNING" or current_text == "STARTING...":
            self.lbl_app_badge.config(text="ONLINE (HEALTH OK)", bg=COLOR_SUCCESS_BG, fg=COLOR_TEXT_MAIN)

    def build_ui(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TNotebook", background=COLOR_BG, borderwidth=0)
        style.configure("TNotebook.Tab", 
                        background=COLOR_PANEL, 
                        foreground=COLOR_TEXT_MUTED, 
                        font=(FONT_FAMILY_MAIN, 9, "bold"),
                        padding=[15, 6],
                        borderwidth=0)
        style.map("TNotebook.Tab",
                  background=[("selected", COLOR_ACCENT), ("active", COLOR_PANEL)],
                  foreground=[("selected", COLOR_TEXT_MAIN), ("active", COLOR_TEXT_MAIN)])
        
        header_frame = tk.Frame(self, bg=COLOR_PANEL, height=80)
        header_frame.pack(fill=tk.X)
        header_frame.pack_propagate(False)
        tk.Frame(header_frame, bg=COLOR_ACCENT, width=6).pack(side=tk.LEFT, fill=tk.Y)
        
        title_container = tk.Frame(header_frame, bg=COLOR_PANEL)
        title_container.pack(side=tk.LEFT, padx=15, fill=tk.Y)
        tk.Label(title_container, text="SHREEJI INDUSTRIES", fg=COLOR_ACCENT, bg=COLOR_PANEL, font=(FONT_FAMILY_MAIN, 16, "bold")).pack(anchor=tk.W, pady=(15, 0))
        tk.Label(title_container, text="DeskManager — Unified Control Board", fg=COLOR_TEXT_MUTED, bg=COLOR_PANEL, font=(FONT_FAMILY_MAIN, 9, "normal")).pack(anchor=tk.W)

        dir_frame = tk.Frame(self, bg=COLOR_PANEL)
        dir_frame.pack(fill=tk.X, padx=20, pady=(20, 0))
        tk.Label(dir_frame, text="WORKSPACE FOLDER PATH:", fg=COLOR_TEXT_MUTED, bg=COLOR_PANEL, font=(FONT_FAMILY_MAIN, 9, "bold")).pack(anchor=tk.W, padx=15, pady=(10, 2))
        
        path_selector_container = tk.Frame(dir_frame, bg=COLOR_PANEL)
        path_selector_container.pack(fill=tk.X, padx=15, pady=(0, 15))
        self.lbl_path = tk.Label(path_selector_container, text="No folder loaded.", fg=COLOR_TEXT_MAIN, bg=COLOR_BG, anchor=tk.W, padx=10, pady=8, font=(FONT_FAMILY_MAIN, 10, "bold"))
        self.lbl_path.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        tk.Button(path_selector_container, text="Browse...", command=self.browse_directory, bg=COLOR_PANEL, fg=COLOR_ACCENT, font=(FONT_FAMILY_MAIN, 9, "bold")).pack(side=tk.RIGHT)
        
        status_control_frame = tk.Frame(self, bg=COLOR_BG)
        status_control_frame.pack(fill=tk.X, padx=20, pady=20)
        
        server_grid_panel = tk.Frame(status_control_frame, bg=COLOR_PANEL)
        server_grid_panel.pack(fill=tk.BOTH, expand=True)
        
        tk.Label(server_grid_panel, text="APPLICATION STATUS", fg=COLOR_TEXT_MUTED, bg=COLOR_PANEL, font=(FONT_FAMILY_MAIN, 9, "bold")).pack(anchor=tk.W, padx=15, pady=(15, 10))
        
        grid_container = tk.Frame(server_grid_panel, bg=COLOR_PANEL)
        grid_container.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 15))
        
        tk.Label(grid_container, text="DeskManager Unified App :", fg=COLOR_TEXT_MAIN, bg=COLOR_PANEL, font=(FONT_FAMILY_MAIN, 12, "bold")).grid(row=0, column=0, sticky=tk.W, pady=10)
        self.lbl_app_badge = tk.Label(grid_container, text="STOPPED", fg=COLOR_TEXT_MAIN, bg=COLOR_DANGER_BG, font=(FONT_FAMILY_MAIN, 9, "bold"), padx=15, pady=6)
        self.lbl_app_badge.grid(row=0, column=1, padx=20, sticky=tk.W)
        self.btn_app_toggle = tk.Button(grid_container, text="START APP", command=self.toggle_app, bg=COLOR_SUCCESS_BG, fg=COLOR_TEXT_MAIN, font=(FONT_FAMILY_MAIN, 10, "bold"), padx=25, pady=8, cursor="hand2")
        self.btn_app_toggle.grid(row=0, column=2, sticky=tk.W)

        console_frame = tk.Frame(self, bg=COLOR_BG)
        console_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 20))
        
        self.notebook = ttk.Notebook(console_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        self.txt_app = ScrolledText(self.notebook, bg=COLOR_CONSOLE_BG, fg=COLOR_CONSOLE_FG, font=(FONT_FAMILY_MONO, 10), bd=0)
        self.notebook.add(self.txt_app, text=" APPLICATION LOGS ")
        
        self.txt_system = ScrolledText(self.notebook, bg=COLOR_CONSOLE_BG, fg=COLOR_CONSOLE_FG, font=(FONT_FAMILY_MONO, 10), bd=0)
        self.notebook.add(self.txt_system, text=" SYSTEM LOG EVENTS ")
        
        self.append_system_event("System control board initialized.")

    def load_or_prompt_directory(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if self.validate_and_set_directory(data.get("root_directory", "")): return
            except Exception: pass
        self.after(500, self.prompt_directory_dialog)

    def prompt_directory_dialog(self):
        selected_dir = filedialog.askdirectory(title="Select DeskManager Workspace")
        if not selected_dir or not self.validate_and_set_directory(selected_dir):
            messagebox.showwarning("Configuration Required", "A valid 'desk-manager' workspace with a 'backend' directory is required.")
            self.after(500, self.prompt_directory_dialog)
        else:
            self.save_directory_config(selected_dir)

    def browse_directory(self):
        if self.app_process.should_be_running:
            messagebox.showwarning("Active", "Please stop the app before changing directory.")
            return
        self.prompt_directory_dialog()

    def validate_and_set_directory(self, path):
        if not path or not os.path.exists(os.path.join(path, "backend", "package.json")): return False
        self.root_directory = path
        self.lbl_path.config(text=path, fg=COLOR_TEXT_MAIN)
        self.app_process.set_root_dir(path)
        self.append_system_event(f"Workspace path updated: {path}")
        return True

    def save_directory_config(self, path):
        try:
            with open(self.config_path, "w", encoding="utf-8") as f: json.dump({"root_directory": path}, f)
        except Exception: pass

    def toggle_app(self):
        if not self.root_directory: return
        if self.app_process.should_be_running:
            self.app_process.stop()
        else:
            self.app_process.start()

    def queue_gui_call(self, func, *args):
        self.gui_queue.put((func, args))

    def poll_queue(self):
        try:
            while True:
                func, args = self.gui_queue.get_nowait()
                func(*args)
        except queue.Empty: pass
        self.after(100, self.poll_queue)

    def append_log(self, message):
        line_count = int(self.txt_app.index('end-1c').split('.')[0])
        if line_count > 10000: self.txt_app.delete("1.0", "2000.0")
        self.txt_app.insert(tk.END, message)
        self.txt_app.see(tk.END)

    def append_system_event(self, message):
        timestamp = time.strftime("[%Y-%m-%d %H:%M:%S]")
        self.txt_system.insert(tk.END, f"{timestamp} {message}\n")
        self.txt_system.see(tk.END)

    def update_status(self, status):
        self.lbl_app_badge.config(text=status.upper())
        if status == "Running":
            self.lbl_app_badge.config(bg=COLOR_WARNING_BG, fg=COLOR_TEXT_MAIN) # Yellow until health check passes
            self.btn_app_toggle.config(text="STOP APP", bg=COLOR_DANGER_BG)
        elif status == "Stopping..." or status == "Starting...":
            self.lbl_app_badge.config(bg=COLOR_WARNING_BG, fg=COLOR_TEXT_MAIN)
            self.btn_app_toggle.config(state=tk.DISABLED)
        elif status == "Crashed":
            self.lbl_app_badge.config(bg=COLOR_DANGER_BG, fg=COLOR_TEXT_MAIN)
            self.btn_app_toggle.config(text="START APP", bg=COLOR_SUCCESS_BG, state=tk.NORMAL)
        else:
            self.lbl_app_badge.config(bg=COLOR_BG, fg=COLOR_TEXT_MUTED)
            self.btn_app_toggle.config(text="START APP", bg=COLOR_SUCCESS_BG, state=tk.NORMAL)

    def on_closing(self):
        self.title("Stopping servers and shutting down... Please wait.")
        self.health_thread_active = False
        def shutdown_routine():
            self.app_process.stop()
            self.queue_gui_call(self.destroy)
        threading.Thread(target=shutdown_routine, daemon=True).start()

if __name__ == "__main__":
    app = ControllerApp()
    app.mainloop()
