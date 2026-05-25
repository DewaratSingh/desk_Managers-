#!/usr/bin/env python3
"""
Shreeji Industries - DeskManager Server Controller
A professional, high-fidelity desktop dashboard designed to configure, start, stop, 
and monitor both the Backend and Frontend servers. Includes automatic crash-detection 
and graceful recovery (auto-restart) with robust process tree cleanup on Windows.
"""

import os
import sys
import json
import time
import queue
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter.scrolledtext import ScrolledText

# Premium Design System Tokens
COLOR_BG = "#0B0F19"         # Deep space dark background
COLOR_PANEL = "#151B2C"      # Sleek slate panel background
COLOR_TEXT_MAIN = "#F8FAFC"  # High-contrast slate white
COLOR_TEXT_MUTED = "#94A3B8" # Muted blue-grey text
COLOR_ACCENT = "#DC332E"     # Shreeji Red
COLOR_ACCENT_HOVER = "#B82723"
COLOR_SUCCESS = "#10B981"    # Green
COLOR_SUCCESS_BG = "#064E3B"
COLOR_DANGER = "#EF4444"     # Red
COLOR_DANGER_BG = "#7F1D1D"
COLOR_WARNING = "#F59E0B"    # Amber
COLOR_WARNING_BG = "#78350F"
COLOR_CONSOLE_BG = "#030712"  # Pitch black console log background
COLOR_CONSOLE_FG = "#E2E8F0"

FONT_FAMILY_MAIN = "Segoe UI"
FONT_FAMILY_MONO = "Consolas"

CONFIG_FILENAME = ".desk_manager_config.json"

class ServerProcess:
    """Manages an individual server process lifecycle in a background thread."""
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
        self.event_callback(f"Starting {self.name} server...")
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        with self.lock:
            self.should_be_running = False
            
        if self.process:
            self.event_callback(f"Stopping {self.name} server and cleaning up process tree...")
            self._kill_process_tree()
            
        self.status_callback("Stopped")
        self.event_callback(f"{self.name} server stopped successfully.")

    def _run_loop(self):
        retry_cooldown = 2.0  # seconds
        
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
                # Windows specific process parameters to hide terminal windows
                startupinfo = None
                creationflags = 0
                if sys.platform == "win32":
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = subprocess.SW_HIDE
                    # Prevent new console window, run strictly in background
                    creationflags = subprocess.CREATE_NO_WINDOW
                
                # Run the command with shell=True because npm is an npm.cmd script on Windows
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
                
                # Stream logs in real-time
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
                    
            # If we get here, the process terminated unexpectedly!
            self.status_callback("Crashed")
            self.event_callback(f"WARNING: {self.name} exited unexpectedly (Code: {exit_code}).")
            self.event_callback(f"Auto-Restarting {self.name} in {retry_cooldown} seconds...")
            
            # Cooldown before restart to avoid hot loops
            time.sleep(retry_cooldown)

    def _kill_process_tree(self):
        """Cleans up the subprocess and all of its descendants recursively on Windows."""
        if not self.process:
            return
            
        pid = self.process.pid
        try:
            if sys.platform == "win32":
                # For Windows, use taskkill to kill the whole tree recursively (/T) and forcefully (/F)
                result = subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
                if result.returncode != 0:
                    self.event_callback(f"taskkill failed for {self.name}: {result.stderr}")
            else:
                # Unix fallback
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
        
        # Thread-safe messaging queue for GUI updates
        self.gui_queue = queue.Queue()
        
        # Configuration setup
        self.root_directory = ""
        self.config_path = os.path.join(os.path.expanduser("~"), CONFIG_FILENAME)
        
        # Initialize backend and frontend managers
        # Backend command: npm run dev
        # Frontend command: npm run dev -- --host
        self.backend = ServerProcess(
            name="Backend Server",
            relative_dir="backend",
            start_command="npm run dev",
            log_callback=lambda msg: self.queue_gui_call(self.append_log, "backend", msg),
            status_callback=lambda status: self.queue_gui_call(self.update_status, "backend", status),
            event_callback=lambda msg: self.queue_gui_call(self.append_system_event, f"[Backend] {msg}")
        )
        
        self.frontend = ServerProcess(
            name="Frontend Server",
            relative_dir="frontend/desk-manager",
            start_command="npm run dev -- --host",
            log_callback=lambda msg: self.queue_gui_call(self.append_log, "frontend", msg),
            status_callback=lambda status: self.queue_gui_call(self.update_status, "frontend", status),
            event_callback=lambda msg: self.queue_gui_call(self.append_system_event, f"[Frontend] {msg}")
        )
        
        # Build UI layout
        self.build_ui()
        
        # Register window closing handler
        self.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Start queue polling loop
        self.poll_queue()
        
        # Load saved directory or prompt
        self.load_or_prompt_directory()

    def build_ui(self):
        # Configure overall ttk styling
        style = ttk.Style()
        style.theme_use("clam")
        
        # Notebook (Tabs) styling
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
        
        # Header banner panel
        header_frame = tk.Frame(self, bg=COLOR_PANEL, height=80)
        header_frame.pack(fill=tk.X, padx=0, pady=0)
        header_frame.pack_propagate(False)
        
        # Accent left indicator line
        accent_strip = tk.Frame(header_frame, bg=COLOR_ACCENT, width=6)
        accent_strip.pack(side=tk.LEFT, fill=tk.Y)
        
        # Logo placeholder & text labels
        title_container = tk.Frame(header_frame, bg=COLOR_PANEL)
        title_container.pack(side=tk.LEFT, padx=15, fill=tk.Y)
        
        lbl_brand = tk.Label(title_container, 
                             text="SHREEJI INDUSTRIES", 
                             fg=COLOR_ACCENT, 
                             bg=COLOR_PANEL, 
                             font=(FONT_FAMILY_MAIN, 16, "bold"))
        lbl_brand.pack(anchor=tk.W, pady=(15, 0))
        
        lbl_subtitle = tk.Label(title_container, 
                                text="DeskManager Suite — Production & Development Control Board", 
                                fg=COLOR_TEXT_MUTED, 
                                bg=COLOR_PANEL, 
                                font=(FONT_FAMILY_MAIN, 9, "normal"))
        lbl_subtitle.pack(anchor=tk.W)

        # Directory Selector Panel
        dir_frame = tk.Frame(self, bg=COLOR_PANEL, bd=0)
        dir_frame.pack(fill=tk.X, padx=20, pady=(20, 0))
        
        lbl_dir_title = tk.Label(dir_frame, 
                                 text="WORKSPACE FOLDER PATH:", 
                                 fg=COLOR_TEXT_MUTED, 
                                 bg=COLOR_PANEL, 
                                 font=(FONT_FAMILY_MAIN, 9, "bold"))
        lbl_dir_title.pack(anchor=tk.W, padx=15, pady=(10, 2))
        
        path_selector_container = tk.Frame(dir_frame, bg=COLOR_PANEL)
        path_selector_container.pack(fill=tk.X, padx=15, pady=(0, 15))
        
        self.lbl_path = tk.Label(path_selector_container, 
                                 text="No folder loaded. Please configure the root folder.", 
                                 fg=COLOR_TEXT_MAIN, 
                                 bg=COLOR_BG, 
                                 anchor=tk.W,
                                 padx=10,
                                 pady=8,
                                 relief=tk.FLAT,
                                 font=(FONT_FAMILY_MAIN, 10, "bold"))
        self.lbl_path.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        btn_select_dir = tk.Button(path_selector_container, 
                                   text="Browse Folder...", 
                                   command=self.browse_directory,
                                   bg=COLOR_PANEL, 
                                   fg=COLOR_ACCENT, 
                                   activebackground=COLOR_ACCENT,
                                   activeforeground=COLOR_TEXT_MAIN,
                                   bd=2,
                                   highlightthickness=0,
                                   relief=tk.FLAT,
                                   highlightbackground=COLOR_ACCENT,
                                   font=(FONT_FAMILY_MAIN, 9, "bold"),
                                   padx=15, 
                                   pady=4,
                                   cursor="hand2")
        btn_select_dir.pack(side=tk.RIGHT)
        
        # Master Controllers & Realtime Status Panel
        status_control_frame = tk.Frame(self, bg=COLOR_BG)
        status_control_frame.pack(fill=tk.X, padx=20, pady=20)
        
        # Left Panel: Master Start/Stop Controls
        controls_panel = tk.Frame(status_control_frame, bg=COLOR_PANEL, width=320)
        controls_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        lbl_ctrl_title = tk.Label(controls_panel, 
                                  text="SYSTEM MASTER CONTROLS", 
                                  fg=COLOR_TEXT_MUTED, 
                                  bg=COLOR_PANEL, 
                                  font=(FONT_FAMILY_MAIN, 9, "bold"))
        lbl_ctrl_title.pack(anchor=tk.W, padx=15, pady=(15, 10))
        
        btn_container = tk.Frame(controls_panel, bg=COLOR_PANEL)
        btn_container.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 15))
        
        self.btn_start_all = tk.Button(btn_container, 
                                       text="START ALL SERVERS", 
                                       command=self.start_all,
                                       bg=COLOR_SUCCESS_BG, 
                                       fg=COLOR_TEXT_MAIN, 
                                       activebackground=COLOR_SUCCESS,
                                       activeforeground=COLOR_TEXT_MAIN,
                                       bd=0, 
                                       relief=tk.FLAT,
                                       font=(FONT_FAMILY_MAIN, 11, "bold"),
                                       pady=12,
                                       cursor="hand2")
        self.btn_start_all.pack(fill=tk.X, pady=(0, 10))
        
        self.btn_stop_all = tk.Button(btn_container, 
                                      text="STOP ALL SERVERS", 
                                      command=self.stop_all,
                                      bg=COLOR_DANGER_BG, 
                                      fg=COLOR_TEXT_MAIN, 
                                      activebackground=COLOR_DANGER,
                                      activeforeground=COLOR_TEXT_MAIN,
                                      bd=0, 
                                      relief=tk.FLAT,
                                      font=(FONT_FAMILY_MAIN, 11, "bold"),
                                      pady=12,
                                      cursor="hand2")
        self.btn_stop_all.pack(fill=tk.X)
        
        # Right Panel: Individual Server Grid Status
        server_grid_panel = tk.Frame(status_control_frame, bg=COLOR_PANEL)
        server_grid_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))
        
        lbl_status_title = tk.Label(server_grid_panel, 
                                    text="REAL-TIME MONITORING STATUS", 
                                    fg=COLOR_TEXT_MUTED, 
                                    bg=COLOR_PANEL, 
                                    font=(FONT_FAMILY_MAIN, 9, "bold"))
        lbl_status_title.pack(anchor=tk.W, padx=15, pady=(15, 10))
        
        grid_container = tk.Frame(server_grid_panel, bg=COLOR_PANEL)
        grid_container.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 15))
        
        # 1. Backend Row
        lbl_be_name = tk.Label(grid_container, 
                               text="Backend API Service :", 
                               fg=COLOR_TEXT_MAIN, 
                               bg=COLOR_PANEL, 
                               font=(FONT_FAMILY_MAIN, 10, "bold"))
        lbl_be_name.grid(row=0, column=0, sticky=tk.W, pady=10)
        
        self.lbl_be_badge = tk.Label(grid_container, 
                                     text="STOPPED", 
                                     fg=COLOR_TEXT_MAIN, 
                                     bg=COLOR_DANGER_BG,
                                     font=(FONT_FAMILY_MAIN, 8, "bold"), 
                                     padx=10, 
                                     pady=4)
        self.lbl_be_badge.grid(row=0, column=1, padx=15, sticky=tk.W)
        
        self.btn_be_toggle = tk.Button(grid_container, 
                                       text="Start", 
                                       command=self.toggle_backend,
                                       bg=COLOR_BG, 
                                       fg=COLOR_TEXT_MAIN, 
                                       activebackground=COLOR_PANEL,
                                       bd=1, 
                                       relief=tk.SOLID,
                                       font=(FONT_FAMILY_MAIN, 8, "bold"),
                                       padx=15,
                                       cursor="hand2")
        self.btn_be_toggle.grid(row=0, column=2, sticky=tk.W)
        
        # 2. Frontend Row
        lbl_fe_name = tk.Label(grid_container, 
                               text="Frontend Web Console :", 
                               fg=COLOR_TEXT_MAIN, 
                               bg=COLOR_PANEL, 
                               font=(FONT_FAMILY_MAIN, 10, "bold"))
        lbl_fe_name.grid(row=1, column=0, sticky=tk.W, pady=10)
        
        self.lbl_fe_badge = tk.Label(grid_container, 
                                     text="STOPPED", 
                                     fg=COLOR_TEXT_MAIN, 
                                     bg=COLOR_DANGER_BG,
                                     font=(FONT_FAMILY_MAIN, 8, "bold"), 
                                     padx=10, 
                                     pady=4)
        self.lbl_fe_badge.grid(row=1, column=1, padx=15, sticky=tk.W)
        
        self.btn_fe_toggle = tk.Button(grid_container, 
                                       text="Start", 
                                       command=self.toggle_frontend,
                                       bg=COLOR_BG, 
                                       fg=COLOR_TEXT_MAIN, 
                                       activebackground=COLOR_PANEL,
                                       bd=1, 
                                       relief=tk.SOLID,
                                       font=(FONT_FAMILY_MAIN, 8, "bold"),
                                       padx=15,
                                       cursor="hand2")
        self.btn_fe_toggle.grid(row=1, column=2, sticky=tk.W)

        # Tabbed Log Console Area
        console_frame = tk.Frame(self, bg=COLOR_BG)
        console_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 20))
        
        self.notebook = ttk.Notebook(console_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # Tab 1: Backend Logs
        self.txt_backend = ScrolledText(self.notebook, 
                                        bg=COLOR_CONSOLE_BG, 
                                        fg=COLOR_CONSOLE_FG, 
                                        insertbackground=COLOR_TEXT_MAIN,
                                        font=(FONT_FAMILY_MONO, 10),
                                        relief=tk.FLAT,
                                        bd=0)
        self.notebook.add(self.txt_backend, text=" BACKEND STDOUT/STDERR ")
        
        # Tab 2: Frontend Logs
        self.txt_frontend = ScrolledText(self.notebook, 
                                         bg=COLOR_CONSOLE_BG, 
                                         fg=COLOR_CONSOLE_FG, 
                                         insertbackground=COLOR_TEXT_MAIN,
                                         font=(FONT_FAMILY_MONO, 10),
                                         relief=tk.FLAT,
                                         bd=0)
        self.notebook.add(self.txt_frontend, text=" FRONTEND STDOUT/STDERR ")
        
        # Tab 3: System Event logs
        self.txt_system = ScrolledText(self.notebook, 
                                       bg=COLOR_CONSOLE_BG, 
                                       fg=COLOR_CONSOLE_FG, 
                                       insertbackground=COLOR_TEXT_MAIN,
                                       font=(FONT_FAMILY_MONO, 10),
                                       relief=tk.FLAT,
                                       bd=0)
        self.notebook.add(self.txt_system, text=" SYSTEM LOG EVENTS ")
        
        # Prepopulate system tab with greeting
        self.append_system_event("System control board initialized.")

    # ----------------------------------------------------
    # Directory & Config Handlers
    # ----------------------------------------------------
    def load_or_prompt_directory(self):
        """Attempts to load a saved directory path, or prompts the user."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    saved_path = data.get("root_directory", "")
                    if self.validate_and_set_directory(saved_path):
                        return
            except Exception as e:
                self.append_system_event(f"Error loading saved config: {str(e)}")
                
        # If no config or invalid config, prompt
        self.append_system_event("No workspace path loaded. Prompting path selector...")
        self.after(500, self.prompt_directory_dialog)

    def prompt_directory_dialog(self):
        """Opens directory selection dialog and validates folder choice."""
        # Visual hint
        self.lbl_path.config(text="Please choose the 'desk-manager' folder...", fg=COLOR_WARNING)
        
        default_dir = os.path.dirname(os.path.abspath(__file__))
        selected_dir = filedialog.askdirectory(
            title="Select DeskManager Workspace Root Directory",
            initialdir=default_dir
        )
        
        if not selected_dir:
            self.lbl_path.config(text="No folder loaded. Please configure the root folder.", fg=COLOR_DANGER)
            messagebox.showwarning(
                "Configuration Required",
                "A valid 'desk-manager' directory path is required to operate the servers."
            )
            return
            
        if self.validate_and_set_directory(selected_dir):
            self.save_directory_config(selected_dir)
            messagebox.showinfo("Success", f"Workspace configuration loaded successfully:\n{selected_dir}")
        else:
            self.lbl_path.config(text="Configuration error. Please reload a valid directory.", fg=COLOR_DANGER)
            messagebox.showerror(
                "Invalid Folder",
                "The selected folder is not a valid 'desk-manager' workspace.\n\n"
                "Ensure it contains:\n"
                "1. A 'backend' directory with 'package.json'\n"
                "2. A 'frontend/desk-manager' directory with 'package.json'"
            )
            # Re-prompt
            self.after(500, self.prompt_directory_dialog)

    def browse_directory(self):
        """Triggered manually by the 'Browse Folder...' button."""
        # Prevent browsing if servers are already active to avoid directory swapping issues
        if self.backend.should_be_running or self.frontend.should_be_running:
            messagebox.showwarning(
                "Servers Active", 
                "Please stop both servers before attempting to reconfigure the workspace directory."
            )
            return
        self.prompt_directory_dialog()

    def validate_and_set_directory(self, path):
        """Verifies workspace folder directories exist in selected path."""
        if not path or not os.path.exists(path):
            return False
            
        be_path = os.path.join(path, "backend")
        fe_path = os.path.join(path, "frontend", "desk-manager")
        
        be_pkg = os.path.join(be_path, "package.json")
        fe_pkg = os.path.join(fe_path, "package.json")
        
        if os.path.exists(be_pkg) and os.path.exists(fe_pkg):
            self.root_directory = path
            self.lbl_path.config(text=path, fg=COLOR_TEXT_MAIN)
            self.backend.set_root_dir(path)
            self.frontend.set_root_dir(path)
            self.append_system_event(f"Workspace path updated: {path}")
            return True
            
        return False

    def save_directory_config(self, path):
        """Saves active path to user profile JSON config."""
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump({"root_directory": path}, f, indent=4)
            self.append_system_event("Configuration saved successfully.")
        except Exception as e:
            self.append_system_event(f"Error saving config file: {str(e)}")

    # ----------------------------------------------------
    # Process Execution Operations
    # ----------------------------------------------------
    def start_all(self):
        if not self.root_directory:
            messagebox.showerror("Error", "No workspace directory configured. Please browse and load a folder first.")
            return
        self.backend.start()
        self.frontend.start()

    def stop_all(self):
        self.backend.stop()
        self.frontend.stop()

    def toggle_backend(self):
        if not self.root_directory:
            messagebox.showerror("Error", "No workspace directory configured. Please browse and load a folder first.")
            return
        if self.backend.should_be_running:
            self.backend.stop()
        else:
            self.backend.start()

    def toggle_frontend(self):
        if not self.root_directory:
            messagebox.showerror("Error", "No workspace directory configured. Please browse and load a folder first.")
            return
        if self.frontend.should_be_running:
            self.frontend.stop()
        else:
            self.frontend.start()

    # ----------------------------------------------------
    # Thread-safe GUI queue communication
    # ----------------------------------------------------
    def queue_gui_call(self, func, *args):
        self.gui_queue.put((func, args))

    def poll_queue(self):
        """Listens to queued updates to update text logs or status badges in main loop thread safely."""
        try:
            while True:
                func, args = self.gui_queue.get_nowait()
                func(*args)
        except queue.Empty:
            pass
        self.after(100, self.poll_queue)

    def append_log(self, server_key, message):
        """Appends stdout streaming line to monospaced text console area."""
        txt_widget = self.txt_backend if server_key == "backend" else self.txt_frontend
        
        # Prevent memory leaks by truncating console history if it exceeds 10,000 lines
        line_count = int(txt_widget.index('end-1c').split('.')[0])
        if line_count > 10000:
            txt_widget.delete("1.0", "2000.0")
            
        txt_widget.insert(tk.END, message)
        txt_widget.see(tk.END)

    def append_system_event(self, message):
        """Appends system logs (e.g. startup, error alerts, crash, restarts)."""
        timestamp = time.strftime("[%Y-%m-%d %H:%M:%S]")
        self.txt_system.insert(tk.END, f"{timestamp} {message}\n")
        self.txt_system.see(tk.END)

    def update_status(self, server_key, status):
        """Dynamically updates badge background colors and button labels."""
        badge = self.lbl_be_badge if server_key == "backend" else self.lbl_fe_badge
        toggle_btn = self.btn_be_toggle if server_key == "backend" else self.btn_fe_toggle
        
        badge.config(text=status.upper())
        
        # Color coding state badges
        if status == "Running":
            badge.config(bg=COLOR_SUCCESS_BG, fg=COLOR_TEXT_MAIN)
            toggle_btn.config(text="Stop", bg=COLOR_DANGER_BG)
        elif status == "Stopping..." or status == "Starting...":
            badge.config(bg=COLOR_WARNING_BG, fg=COLOR_TEXT_MAIN)
            toggle_btn.config(text="---", state=tk.DISABLED)
        elif status == "Crashed":
            badge.config(bg=COLOR_DANGER_BG, fg=COLOR_TEXT_MAIN)
            toggle_btn.config(text="Start", bg=COLOR_BG, state=tk.NORMAL)
        else: # Stopped / Error
            badge.config(bg=COLOR_BG, fg=COLOR_TEXT_MUTED)
            toggle_btn.config(text="Start", bg=COLOR_BG, state=tk.NORMAL)

    def on_closing(self):
        """Intercepts window destroy event and executes robust server termination routines."""
        # Visual shutdown splash hint
        self.title("Stopping servers and shutting down... Please wait.")
        self.append_system_event("Initiating application termination routine...")
        
        # Stop background loops and kill process trees asynchronously in thread pool to prevent GUI freeze
        def shutdown_routine():
            self.backend.stop()
            self.frontend.stop()
            # Quit main thread GUI after processes are safely dead
            self.queue_gui_call(self.destroy)
            
        t = threading.Thread(target=shutdown_routine, daemon=True)
        t.start()

if __name__ == "__main__":
    app = ControllerApp()
    app.mainloop()
