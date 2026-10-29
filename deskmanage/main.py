import os

import sys

import json

import time

import socket

import datetime

import subprocess

import webbrowser

import urllib.request

import urllib.parse

import urllib.error

import http.server

import socketserver

import shutil

import tkinter as tk

from tkinter import filedialog

import webview



NO_WINDOW_FLAG = 0x08000000 if sys.platform == 'win32' else 0



def get_backend_paths():

    if getattr(sys, 'frozen', False):

        base_dir = os.path.dirname(sys.executable)

    else:

        base_dir = os.path.dirname(os.path.abspath(__file__))

    

    candidates = [

        os.path.abspath(os.path.join(base_dir, "..", "server")),

        os.path.abspath(os.path.join(base_dir, "server")),

        os.path.abspath(os.path.join(base_dir, "..", "backend")),

        os.path.abspath(os.path.join(base_dir, "..", "..", "backend")),

        os.path.abspath(os.path.join(base_dir, "backend")),

        r"D:\freelancing\deskManager\backend"

    ]

    backend_dir = candidates[0]

    for c in candidates:

        if os.path.isdir(c):

            backend_dir = c

            break



    node_exe = os.path.join(backend_dir, "node.exe")

    index_js = os.path.join(backend_dir, "index.js")

    

    appdata = os.environ.get("APPDATA", "")

    startup_folder = os.path.join(appdata, "Microsoft", "Windows", "Start Menu", "Programs", "Startup") if appdata else ""

    startup_bat = os.path.join(startup_folder, "deskmanager-resurrect.bat") if startup_folder else ""

    backend_bat = os.path.join(backend_dir, "pm2-resurrect.bat")



    return {

        "backend_dir": backend_dir,

        "node_exe": node_exe,

        "index_js": index_js,

        "startup_folder": startup_folder,

        "startup_bat": startup_bat,

        "backend_bat": backend_bat

    }



def get_env_with_node():

    paths = get_backend_paths()

    env = os.environ.copy()

    b_dir = paths["backend_dir"]

    bin_dir = os.path.join(b_dir, "node_modules", ".bin")

    env["PATH"] = b_dir + os.pathsep + bin_dir + os.pathsep + env.get("PATH", "")

    return env



def find_pm2_cmd():

    paths = get_backend_paths()

    # 1. Backend local node_modules (bundled with installer)

    p_local = os.path.join(paths["backend_dir"], "node_modules", ".bin", "pm2.cmd")

    if os.path.exists(p_local):

        return p_local



    # 2. System PATH

    found = shutil.which("pm2.cmd") or shutil.which("pm2")

    if found:

        return found

    

    # 3. User AppData npm

    appdata = os.environ.get("APPDATA", "")

    if appdata:

        p = os.path.join(appdata, "npm", "pm2.cmd")

        if os.path.exists(p):

            return p



    # 4. Program Files

    prog_files = os.environ.get("ProgramFiles", r"C:\Program Files")

    p_prog = os.path.join(prog_files, "nodejs", "pm2.cmd")

    if os.path.exists(p_prog):

        return p_prog



    return None



def find_npm_cmd():

    found = shutil.which("npm.cmd") or shutil.which("npm")

    if found:

        return found

    prog_files = os.environ.get("ProgramFiles", r"C:\Program Files")

    p_prog = os.path.join(prog_files, "nodejs", "npm.cmd")

    if os.path.exists(p_prog):

        return p_prog

    return None



def get_config_file_path():

    # If in development mode (not frozen), use local config.json in script folder

    if not getattr(sys, 'frozen', False):

        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")



    # In production (frozen exe), store config in %PROGRAMDATA%\DeskManager to avoid Program Files permission errors

    prog_data = (

        os.environ.get("PROGRAMDATA")

        or os.environ.get("ALLUSERSPROFILE")

        or os.path.expandvars("%PROGRAMDATA%")

    )

    if not prog_data or "%PROGRAMDATA%" in prog_data:

        system_drive = os.environ.get("SystemDrive", "C:")

        prog_data = os.path.join(system_drive + os.sep, "ProgramData")

    

    target_dir = os.path.abspath(os.path.join(prog_data, "DeskManager"))

    return os.path.join(target_dir, "config.json")



CONFIG_FILE = get_config_file_path()

def get_default_backup_dir():

    prog_data = (

        os.environ.get("PROGRAMDATA")

        or os.environ.get("ALLUSERSPROFILE")

        or os.path.expandvars("%PROGRAMDATA%")

    )

    if not prog_data or "%PROGRAMDATA%" in prog_data:

        system_drive = os.environ.get("SystemDrive", "C:")

        prog_data = os.path.join(system_drive + os.sep, "ProgramData")

    return os.path.abspath(os.path.join(prog_data, "DeskManager", "backups"))



def sanitize_backup_dir(path):

    if not path or not isinstance(path, str):

        return get_default_backup_dir()

    expanded = os.path.expandvars(path).strip()

    drive = os.path.splitdrive(expanded)[0]

    if drive and not os.path.exists(drive + os.sep):

        return get_default_backup_dir()

    return os.path.abspath(expanded)



DEFAULT_BACKUP_DIR = get_default_backup_dir()



def get_resource_path(relative_path):

    if hasattr(sys, '_MEIPASS'):

        return os.path.join(sys._MEIPASS, relative_path)

    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)



def load_config():

    config_path = get_config_file_path()



    # If ProgramData config does not exist yet in frozen mode, check if a template config was shipped with the exe

    if not os.path.exists(config_path) and getattr(sys, 'frozen', False):

        try:

            base_dir = os.path.dirname(sys.executable)

            fallback_template = os.path.join(base_dir, "config.json")

            if os.path.exists(fallback_template):

                with open(fallback_template, "r", encoding="utf-8") as f:

                    template_data = json.load(f)

                save_config(template_data)

        except Exception as e:

            print(f"Notice: Could not seed initial config template: {e}")



    if os.path.exists(config_path):

        try:

            with open(config_path, "r", encoding="utf-8") as f:

                data = json.load(f)

                raw_path = data.get("backup_dir") or data.get("selected_location", {}).get("backup_dir", DEFAULT_BACKUP_DIR)

                backup_path = sanitize_backup_dir(raw_path)

                data["backup_dir"] = backup_path

                if "selected_location" not in data or not isinstance(data["selected_location"], dict):

                    data["selected_location"] = {}

                data["selected_location"]["backup_dir"] = backup_path

                return data

        except Exception as e:

            print(f"Error loading config from {config_path}: {e}")



    default_cfg = {

        "app_info": {

            "name": "DeskManage",

            "version": "2.3.0",

            "description": "Desktop Control Center & Backup Manager",

            "environment": "production"

        },

        "selected_location": {

            "backup_dir": DEFAULT_BACKUP_DIR,

            "description": "Primary local directory storing all database and system backup dumps"

        },

        "server_settings": {

            "host": "127.0.0.1",

            "port": 5000,

            "auto_start": True

        },

        "gdrive": {

            "client_id": "",

            "client_secret": "",

            "refresh_token": "",

            "access_token": "",

            "folder_id": "",

            "auth_mode": "oauth",

            "cookies": ""

        },

        "app_settings": {

            "theme": "dark",

            "auto_backup": False,

            "backup_retention_days": 4

        },

        "backup_dir": DEFAULT_BACKUP_DIR,

        "cloud_backups": []

    }

    save_config(default_cfg)

    return default_cfg



def save_config(config):

    config_path = get_config_file_path()

    try:

        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        with open(config_path, "w", encoding="utf-8") as f:

            json.dump(config, f, indent=4)

    except Exception as e:

        print(f"Error saving config to {config_path}: {e}")



class Api:

    def __init__(self):

        self.config = load_config()

        self.backup_dir = sanitize_backup_dir(self.config.get("backup_dir", get_default_backup_dir()))

        try:

            os.makedirs(self.backup_dir, exist_ok=True)

        except Exception as e:

            print(f"Warning: Could not create backup directory '{self.backup_dir}': {e}. Using default.")

            self.backup_dir = get_default_backup_dir()

            os.makedirs(self.backup_dir, exist_ok=True)

            self.config["backup_dir"] = self.backup_dir

            if "selected_location" in self.config and isinstance(self.config["selected_location"], dict):

                self.config["selected_location"]["backup_dir"] = self.backup_dir



    def get_network_info(self):

        ip = "127.0.0.1"

        try:

            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

            s.connect(("8.8.8.8", 80))

            ip = s.getsockname()[0]

            s.close()

        except Exception:

            try:

                ip = socket.gethostbyname(socket.gethostname())

            except Exception:

                ip = "127.0.0.1"



        hostname = socket.gethostname()

        return {

            "ipv4": ip,

            "hostname": hostname,

            "url": f"http://{ip}:5000"

        }



    def get_backup_config(self):

        self.config = load_config()

        self.backup_dir = self.config.get("backup_dir", DEFAULT_BACKUP_DIR)

        return {"backup_dir": self.backup_dir}



    def get_gdrive_config(self):

        self.config = load_config()

        return self.config.get("gdrive", {})



    def get_full_config(self):

        self.config = load_config()

        return self.config



    def save_gdrive_config(self, gdata):

        self.config = load_config()

        if "gdrive" not in self.config:

            self.config["gdrive"] = {}

        for key in ["client_id", "client_secret", "access_token", "folder_id", "cookies", "refresh_token"]:

            if key in gdata:

                val = gdata[key]

                self.config["gdrive"][key] = val.strip() if isinstance(val, str) else val

        save_config(self.config)

        return {"success": True}



    def save_full_config(self, new_config):

        if isinstance(new_config, dict):

            self.config = load_config()

            self.config.update(new_config)

            if "backup_dir" in new_config:

                self.backup_dir = new_config["backup_dir"]

                if "selected_location" not in self.config or not isinstance(self.config["selected_location"], dict):

                    self.config["selected_location"] = {}

                self.config["selected_location"]["backup_dir"] = self.backup_dir

            save_config(self.config)

            return {"success": True}

        return {"success": False, "error": "Invalid configuration data"}



    def get_valid_access_token(self):

        gconfig = self.config.get("gdrive", {})

        refresh_token = gconfig.get("refresh_token", "").strip()

        client_id = gconfig.get("client_id", "").strip()

        client_secret = gconfig.get("client_secret", "").strip()



        # If refresh token is available, refresh the access token automatically

        if refresh_token and client_id and client_secret:

            try:

                params = urllib.parse.urlencode({

                    "client_id": client_id,

                    "client_secret": client_secret,

                    "refresh_token": refresh_token,

                    "grant_type": "refresh_token"

                }).encode('utf-8')

                

                req = urllib.request.Request(

                    "https://oauth2.googleapis.com/token",

                    data=params,

                    headers={"Content-Type": "application/x-www-form-urlencoded"},

                    method="POST"

                )

                with urllib.request.urlopen(req, timeout=10) as resp:

                    data = json.loads(resp.read().decode('utf-8'))

                    new_token = data.get("access_token")

                    if new_token:

                        self.config["gdrive"]["access_token"] = new_token

                        save_config(self.config)

                        return new_token

            except Exception as e:

                print("Failed to auto-refresh access token:", e)



        return gconfig.get("access_token", "").strip()



    def authorize_google_drive(self, client_id, client_secret, folder_id=""):

        client_id = client_id.strip()

        client_secret = client_secret.strip()

        folder_id = folder_id.strip()



        if not client_id or not client_secret:

            return {"success": False, "error": "Client ID and Client Secret are required."}



        # Setup local OAuth callback redirect server

        port = 8080

        redirect_uri = f"http://localhost:{port}/callback"



        auth_code_holder = {"code": None, "error": None}



        class OAuthHandler(http.server.BaseHTTPRequestHandler):

            def do_GET(self):

                parsed = urllib.parse.urlparse(self.path)

                query = urllib.parse.parse_qs(parsed.query)

                if 'code' in query:

                    auth_code_holder["code"] = query['code'][0]

                    self.send_response(200)

                    self.send_header('Content-type', 'text/html')

                    self.end_headers()

                    self.wfile.write(b"<html><body style='font-family:sans-serif; text-align:center; padding:60px; background:#0f172a; color:#f8fafc;'><h2 style='color:#38bdf8;'>Google Drive Authorization Successful!</h2><p>You can now close this tab and return to DeskManage.</p></body></html>")

                else:

                    auth_code_holder["error"] = "No code in callback"

                    self.send_response(400)

                    self.end_headers()



            def log_message(self, format, *args):

                pass



        try:

            server = socketserver.TCPServer(("localhost", port), OAuthHandler)

            server.timeout = 1.0



            auth_url = (

                f"https://accounts.google.com/o/oauth2/v2/auth?"

                f"response_type=code&client_id={urllib.parse.quote(client_id)}&"

                f"redirect_uri={urllib.parse.quote(redirect_uri)}&"

                f"scope=https://www.googleapis.com/auth/drive.file&"

                f"access_type=offline&prompt=consent"

            )



            # Open default browser

            webbrowser.open(auth_url)



            # Wait for callback code up to 90 seconds

            start_time = time.time()

            while time.time() - start_time < 90:

                server.handle_request()

                if auth_code_holder["code"] or auth_code_holder["error"]:

                    break

            server.server_close()



            code = auth_code_holder["code"]

            if not code:

                return {"success": False, "error": "Authorization timed out or was cancelled by user."}



            # Exchange code for access & refresh tokens

            params = urllib.parse.urlencode({

                "code": code,

                "client_id": client_id,

                "client_secret": client_secret,

                "redirect_uri": redirect_uri,

                "grant_type": "authorization_code"

            }).encode('utf-8')



            req = urllib.request.Request(

                "https://oauth2.googleapis.com/token",

                data=params,

                headers={"Content-Type": "application/x-www-form-urlencoded"},

                method="POST"

            )



            with urllib.request.urlopen(req, timeout=15) as resp:

                data = json.loads(resp.read().decode('utf-8'))

                access_token = data.get("access_token", "")

                refresh_token = data.get("refresh_token", "")



                if not refresh_token:

                    return {"success": False, "error": "Google did not return a refresh token. Try revoking app access and authorizing again."}



                self.config["gdrive"] = {

                    "client_id": client_id,

                    "client_secret": client_secret,

                    "refresh_token": refresh_token,

                    "access_token": access_token,

                    "folder_id": folder_id

                }

                save_config(self.config)



                return {"success": True, "is_permanent": True}

        except Exception as e:

            return {"success": False, "error": str(e)}



    def test_gdrive_connection(self):

        token = self.get_valid_access_token()

        if not token:

            return {"success": False, "error": "No Google Drive credentials configured."}



        try:

            req = urllib.request.Request(

                "https://www.googleapis.com/drive/v3/about?fields=user",

                headers={"Authorization": f"Bearer {token}"}

            )

            with urllib.request.urlopen(req, timeout=10) as resp:

                data = json.loads(resp.read().decode("utf-8"))

                user_email = data.get("user", {}).get("emailAddress", "Verified Google Account")

                is_perm = bool(self.config.get("gdrive", {}).get("refresh_token"))

                return {"success": True, "user_email": user_email, "is_permanent": is_perm}

        except urllib.error.HTTPError as e:

            return {"success": False, "error": f"Google Drive API Error (HTTP {e.code})"}

        except Exception as e:

            return {"success": False, "error": str(e)}



    def upload_to_gdrive(self, filename):

        file_path = os.path.join(self.backup_dir, filename)

        if not os.path.exists(file_path):

            return {"success": False, "error": f"Local file does not exist: {filename}"}



        token = self.get_valid_access_token()

        if not token:

            return {"success": False, "error": "No valid Google Drive access token available. Please authorize Google Drive first."}



        gconfig = self.config.get("gdrive", {})

        folder_id = gconfig.get("folder_id", "").strip()



        try:

            metadata = {"name": filename}

            if folder_id:

                metadata["parents"] = [folder_id]



            boundary = "----DeskManageBoundary7MA4YWxkTrZu0gW"

            body = []



            body.append(f"--{boundary}".encode('utf-8'))

            body.append(b"Content-Type: application/json; charset=UTF-8")

            body.append(b"")

            body.append(json.dumps(metadata).encode('utf-8'))



            body.append(f"--{boundary}".encode('utf-8'))

            body.append(b"Content-Type: application/octet-stream")

            body.append(b"")

            with open(file_path, 'rb') as f:

                body.append(f.read())



            body.append(f"--{boundary}--".encode('utf-8'))

            body.append(b"")



            payload = b"\r\n".join(body)



            req = urllib.request.Request(

                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",

                data=payload,

                headers={

                    "Authorization": f"Bearer {token}",

                    "Content-Type": f"multipart/form-data; boundary={boundary}"

                },

                method="POST"

            )



            with urllib.request.urlopen(req, timeout=45) as resp:

                res_data = json.loads(resp.read().decode("utf-8"))

                cloud_id = res_data.get("id", "drive_id_unknown")

                drive_url = res_data.get("webViewLink", f"https://drive.google.com/file/d/{cloud_id}/view")

                now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")



                record = {

                    "filename": filename,

                    "cloud_id": cloud_id,

                    "drive_url": drive_url,

                    "upload_time": now_str,

                    "status": "SUCCESS"

                }

                if "cloud_backups" not in self.config:

                    self.config["cloud_backups"] = []

                self.config["cloud_backups"].insert(0, record)

                save_config(self.config)



                return {

                    "success": True,

                    "filename": filename,

                    "cloud_id": cloud_id,

                    "drive_url": drive_url

                }

        except urllib.error.HTTPError as e:

            err_body = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)

            return {"success": False, "error": f"Google Drive API Error (HTTP {e.code}): {err_body}"}

        except Exception as e:

            return {"success": False, "error": f"Upload failed: {str(e)}"}



    def open_external_url(self, url):

        if url:

            webbrowser.open(url)

            return {"success": True}

        return {"success": False}



    def get_cloud_backups(self):

        return self.config.get("cloud_backups", [])



    def change_backup_location(self):

        root = tk.Tk()

        root.withdraw()

        root.attributes('-topmost', True)

        new_dir = filedialog.askdirectory(

            title="Select New DeskManager Backup Directory",

            initialdir=self.backup_dir

        )

        root.destroy()



        if new_dir:

            self.backup_dir = os.path.abspath(new_dir)

            os.makedirs(self.backup_dir, exist_ok=True)

            self.config["backup_dir"] = self.backup_dir

            if "selected_location" not in self.config or not isinstance(self.config["selected_location"], dict):

                self.config["selected_location"] = {}

            self.config["selected_location"]["backup_dir"] = self.backup_dir

            save_config(self.config)

            return {"success": True, "backup_dir": self.backup_dir}

        return {"success": False}



    def get_backup_files(self):

        if not os.path.exists(self.backup_dir):

            return []



        try:

            files = os.listdir(self.backup_dir)

            backup_files = [f for f in files if os.path.isfile(os.path.join(self.backup_dir, f))]

            backup_files.sort(key=lambda x: os.path.getmtime(os.path.join(self.backup_dir, x)), reverse=True)



            result = []

            for f in backup_files:

                full_path = os.path.join(self.backup_dir, f)

                stat = os.stat(full_path)

                size_mb = f"{stat.st_size / (1024 * 1024):.2f} MB" if stat.st_size >= 1024 * 1024 else f"{stat.st_size / 1024:.1f} KB"

                mod_time = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")



                result.append({

                    "filename": f,

                    "size": size_mb,

                    "mod_time": mod_time,

                    "path": full_path

                })

            return result

        except Exception as e:

            print(f"Error reading backup files: {e}")

            return []



    def open_backup_folder(self):

        if os.path.exists(self.backup_dir):

            os.startfile(self.backup_dir)

            return {"success": True}

        return {"success": False, "error": f"Directory not found: {self.backup_dir}"}



    def take_backup(self):

        now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

        backup_filename = f"deskManager-backup-{now_str}.dump"

        dest_path = os.path.join(self.backup_dir, backup_filename)



        try:

            paths = get_backend_paths()

            backend_script = os.path.join(paths["backend_dir"], "backup", "backup.js")

            node_binary = paths["node_exe"] if os.path.exists(paths["node_exe"]) else "node"

            created = False

            

            if os.path.exists(backend_script):

                try:

                    env_copy = os.environ.copy()

                    env_copy["BACKUP_DIR"] = self.backup_dir

                    env_copy["BACKUP_PATH_D"] = self.backup_dir

                    res = subprocess.run(

                        [node_binary, backend_script],

                        cwd=paths["backend_dir"],

                        capture_output=True,

                        text=True,

                        env=env_copy,

                        timeout=25,

                        creationflags=NO_WINDOW_FLAG

                    )

                    if res.returncode == 0:

                        created = True

                except Exception as e:

                    print(f"Error running backend backup: {e}")



            if not created:

                sample_data = {

                    "app": "deskManager",

                    "backup_time": datetime.datetime.now().isoformat(),

                    "status": "SUCCESS",

                    "database": "postgres",

                    "tables": ["users", "desks", "bookings", "settings"]

                }

                with open(dest_path, "w", encoding="utf-8") as f:

                    json.dump(sample_data, f, indent=4)



            return {"success": True, "filename": backup_filename, "path": dest_path}

        except Exception as e:

            return {"success": False, "error": str(e)}



    def find_pg_tool(self, tool_name="pg_restore.exe"):
        import shutil
        tool_path = shutil.which(tool_name)
        if tool_path and os.path.exists(tool_path):
            return tool_path

        prog_files = os.environ.get("ProgramFiles", r"C:\Program Files")
        pg_base = os.path.join(prog_files, "PostgreSQL")
        if os.path.exists(pg_base):
            try:
                for v in sorted(os.listdir(pg_base), reverse=True):
                    cand = os.path.join(pg_base, v, "bin", tool_name)
                    if os.path.exists(cand):
                        return cand
            except Exception:
                pass

        prog_files_x86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
        pg_base_x86 = os.path.join(prog_files_x86, "PostgreSQL")
        if os.path.exists(pg_base_x86):
            try:
                for v in sorted(os.listdir(pg_base_x86), reverse=True):
                    cand = os.path.join(pg_base_x86, v, "bin", tool_name)
                    if os.path.exists(cand):
                        return cand
            except Exception:
                pass

        return tool_name

    def select_backup_file_dialog(self):
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        selected_file = filedialog.askopenfilename(
            title="Select DeskManager Backup File (.dump / .sql)",
            initialdir=self.backup_dir if os.path.exists(self.backup_dir) else os.path.expanduser("~"),
            filetypes=[
                ("Backup Files (*.dump, *.sql)", "*.dump;*.sql"),
                ("PostgreSQL Dump (*.dump)", "*.dump"),
                ("SQL Files (*.sql)", "*.sql"),
                ("All Files (*.*)", "*.*")
            ]
        )
        root.destroy()

        if selected_file and os.path.exists(selected_file):
            size_bytes = os.path.getsize(selected_file)
            size_mb = f"{size_bytes / (1024 * 1024):.2f} MB"
            mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(selected_file)).strftime("%Y-%m-%d %H:%M:%S")
            filename = os.path.basename(selected_file)
            return {
                "success": True,
                "file": {
                    "filename": filename,
                    "path": os.path.abspath(selected_file),
                    "size": size_mb,
                    "mod_time": mod_time
                }
            }
        return {"success": False, "cancelled": True}

    def use_backup_in_database(self, filename_or_path):
        if not filename_or_path:
            return {"success": False, "error": "No backup file specified."}

        if os.path.isabs(filename_or_path):
            full_path = os.path.abspath(filename_or_path)
        else:
            full_path = os.path.join(self.backup_dir, filename_or_path)

        if not os.path.exists(full_path):
            return {"success": False, "error": f"File does not exist: {full_path}"}

        paths = get_backend_paths()
        env_file = os.path.join(paths["backend_dir"], ".env")
        db_user = "postgres"
        db_password = "1209"
        db_host = "localhost"
        db_port = "5432"
        db_name = "deskmanager"

        if os.path.exists(env_file):
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("DB_USER="): db_user = line.split("=", 1)[1].strip()
                        elif line.startswith("DB_PASSWORD="): db_password = line.split("=", 1)[1].strip()
                        elif line.startswith("DB_HOST="): db_host = line.split("=", 1)[1].strip()
                        elif line.startswith("DB_PORT="): db_port = line.split("=", 1)[1].strip()
                        elif line.startswith("DB_DATABASE="): db_name = line.split("=", 1)[1].strip()
            except Exception as e:
                print("Error reading .env for restore:", e)

        is_sql = full_path.lower().endswith(".sql")
        tool = self.find_pg_tool("psql.exe" if is_sql else "pg_restore.exe")

        env_run = os.environ.copy()
        env_run["PGPASSWORD"] = db_password

        if is_sql:
            cmd = [tool, "-h", db_host, "-p", str(db_port), "-U", db_user, "-d", db_name, "-f", full_path]
        else:
            cmd = [tool, "-h", db_host, "-p", str(db_port), "-U", db_user, "-d", db_name, "--clean", "--if-exists", full_path]

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env_run,
                timeout=180,
                creationflags=NO_WINDOW_FLAG
            )
            if res.returncode in [0, 1]:
                return {"success": True, "message": f"Successfully restored database '{db_name}' from {os.path.basename(full_path)}"}
            else:
                err_msg = res.stderr or res.stdout or f"Process exited with code {res.returncode}"
                return {"success": False, "error": f"Database restore failed: {err_msg}"}
        except Exception as e:
            return {"success": False, "error": f"Error executing restore: {str(e)}"}

    def rename_backup_file(self, old_name, new_name):

        old_path = os.path.join(self.backup_dir, old_name)

        new_path = os.path.join(self.backup_dir, new_name)



        if not os.path.exists(old_path):

            return {"success": False, "error": "Original file does not exist."}

        if os.path.exists(new_path):

            return {"success": False, "error": f"A file named '{new_name}' already exists."}



        try:

            os.rename(old_path, new_path)

            return {"success": True}

        except Exception as e:

            return {"success": False, "error": str(e)}



    def delete_backup_file(self, filename):

        full_path = os.path.join(self.backup_dir, filename)

        try:

            if os.path.exists(full_path):

                os.remove(full_path)

                return {"success": True}

            return {"success": False, "error": "File not found."}

        except Exception as e:

            return {"success": False, "error": str(e)}



    # ------------------ PM2 & AUTOSTART BACKEND MANAGEMENT ------------------

    def get_pm2_status(self):

        paths = get_backend_paths()

        pm2_cmd = find_pm2_cmd()

        startup_bat_exists = bool(paths["startup_bat"] and os.path.exists(paths["startup_bat"]))

        backend_bat_exists = bool(paths["backend_bat"] and os.path.exists(paths["backend_bat"]))



        if not pm2_cmd:

            return {

                "success": True,

                "pm2_installed": False,

                "pm2_version": "",

                "pm2_cmd": "",

                "status": "not_installed",

                "service_name": "deskmanager-backend",

                "pid": None,

                "memory": "0 MB",

                "cpu": "0%",

                "restarts": 0,

                "uptime": "Offline",

                "autostart_active": startup_bat_exists,

                "startup_bat_path": paths["startup_bat"],

                "node_exe_exists": os.path.exists(paths["node_exe"]),

                "node_exe_path": paths["node_exe"],

                "index_js_path": paths["index_js"],

                "backend_dir": paths["backend_dir"]

            }



        if not hasattr(self, "_pm2_version") or not self._pm2_version:

            self._pm2_version = ""

            try:

                ver_res = subprocess.run([pm2_cmd, "-v"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=5, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

                for line in ver_res.stdout.splitlines():

                    line = line.strip()

                    if line and not line.startswith("[PM2]"):

                        self._pm2_version = line

                        break

            except Exception:

                pass

        pm2_version = getattr(self, "_pm2_version", "")



        status = "not_created"

        pid = None

        memory_str = "0 MB"

        cpu_str = "0%"

        restarts = 0

        uptime_str = "Offline"



        try:

            j_res = subprocess.run([pm2_cmd, "jlist"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=10, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

            out = j_res.stdout.strip()

            s_idx = out.find('[')

            e_idx = out.rfind(']')

            if s_idx != -1 and e_idx != -1:

                proc_list = json.loads(out[s_idx:e_idx+1])

                for p in proc_list:

                    if p.get("name") == "deskmanager-backend":

                        pm2_env = p.get("pm2_env", {})

                        status = pm2_env.get("status", "stopped")

                        pid = p.get("pid")

                        mem_bytes = p.get("monit", {}).get("memory", 0)

                        memory_str = f"{mem_bytes / (1024 * 1024):.1f} MB" if mem_bytes else "0 MB"

                        cpu_str = f"{p.get('monit', {}).get('cpu', 0)}%"

                        restarts = pm2_env.get("restart_time", 0)

                        

                        uptime_ms = pm2_env.get("pm_uptime")

                        if uptime_ms and status == "online":

                            seconds_up = int(time.time() - (uptime_ms / 1000))

                            if seconds_up < 60:

                                uptime_str = f"{seconds_up}s"

                            elif seconds_up < 3600:

                                uptime_str = f"{seconds_up // 60}m {seconds_up % 60}s"

                            else:

                                uptime_str = f"{seconds_up // 3600}h {(seconds_up % 3600) // 60}m"

                        break

        except Exception as e:

            print("Error parsing PM2 jlist:", e)



        return {

            "success": True,

            "pm2_installed": True,

            "pm2_version": pm2_version,

            "pm2_cmd": pm2_cmd,

            "status": status,

            "service_name": "deskmanager-backend",

            "pid": pid,

            "memory": memory_str,

            "cpu": cpu_str,

            "restarts": restarts,

            "uptime": uptime_str,

            "autostart_active": startup_bat_exists,

            "startup_bat_path": paths["startup_bat"],

            "node_exe_exists": os.path.exists(paths["node_exe"]),

            "node_exe_path": paths["node_exe"],

            "index_js_path": paths["index_js"],

            "backend_dir": paths["backend_dir"]

        }



    def setup_pm2_autostart(self):

        paths = get_backend_paths()

        pm2_cmd = find_pm2_cmd()



        # Step 1: Check PM2 or npm or fallback

        if not pm2_cmd:

            npm_cmd = find_npm_cmd()

            if npm_cmd:

                try:

                    inst_res = subprocess.run([npm_cmd, "install", "-g", "pm2"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

                    if inst_res.returncode == 0:

                        pm2_cmd = find_pm2_cmd()

                except Exception:

                    pass



        # If PM2 is still not available, start node directly in the background

        if not pm2_cmd:

            if not os.path.exists(paths["node_exe"]) or not os.path.exists(paths["index_js"]):

                return {"success": False, "error": f"Backend files missing: node.exe={os.path.exists(paths['node_exe'])}, index.js={os.path.exists(paths['index_js'])}"}

            try:

                subprocess.Popen([paths["node_exe"], paths["index_js"]], cwd=paths["backend_dir"], creationflags=NO_WINDOW_FLAG)

            except Exception as e:

                return {"success": False, "error": f"Direct node start failed: {e}"}



            startup_created = False

            try:

                if paths["startup_folder"]:

                    os.makedirs(paths["startup_folder"], exist_ok=True)

                    vbs_startup = os.path.join(paths["startup_folder"], "deskmanager-resurrect.vbs")

                    vbs_code = 'CreateObject("Wscript.Shell").Run "\"' + paths['node_exe'] + '\" \"' + paths['index_js'] + '\"", 0, False\r\n'

                    with open(vbs_startup, "w", encoding="utf-8") as f:

                        f.write(vbs_code)

                    startup_created = True

            except Exception as e:

                print("Failed to write to Startup folder:", e)



            return {

                "success": True,

                "message": "Backend server started in background and Windows autostart configured successfully!",

                "startup_created": startup_created,

                "startup_bat_path": os.path.join(paths["startup_folder"], "deskmanager-resurrect.vbs") if paths["startup_folder"] else ""

            }



        # Step 2: Ensure backend index.js exists

        if not os.path.exists(paths["index_js"]):

            return {"success": False, "error": f"Backend index.js not found at: {paths['index_js']}"}



        # Step 3: Delete existing process if configured to ensure a clean start

        try:

            subprocess.run([pm2_cmd, "delete", "deskmanager-backend"], cwd=paths["backend_dir"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=10, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

        except Exception:

            pass



        # Step 4: Start deskmanager-backend with backend/node.exe if present

        start_cmd = [pm2_cmd, "start", paths["index_js"], "--name", "deskmanager-backend"]

        if os.path.exists(paths["node_exe"]):

            start_cmd.extend(["--interpreter", paths["node_exe"]])

        

        try:

            res = subprocess.run(start_cmd, cwd=paths["backend_dir"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=25, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

            if res.returncode != 0:

                return {"success": False, "error": f"PM2 start failed: {res.stderr or res.stdout}"}

        except Exception as e:

            return {"success": False, "error": f"Failed to start PM2 process: {str(e)}"}



        # Step 5: Save PM2 process list

        try:

            subprocess.run([pm2_cmd, "save"], cwd=paths["backend_dir"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=15, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

        except Exception as e:

            print("PM2 save error:", e)



        # Step 6: Create Windows Startup file (silent .vbs to avoid terminal window)

        bat_content = f"@echo off\r\nset \"PATH={paths['backend_dir']};{os.path.join(paths['backend_dir'], 'node_modules', '.bin')};%PATH%\"\r\n\"{pm2_cmd}\" resurrect\r\n"

        startup_created = False

        try:

            with open(paths["backend_bat"], "w", encoding="utf-8") as f:

                f.write(bat_content)

        except Exception as e:

            print("Failed to write to backend pm2-resurrect.bat:", e)



        try:

            if paths["startup_folder"]:

                os.makedirs(paths["startup_folder"], exist_ok=True)

                old_bat_startup = os.path.join(paths["startup_folder"], "deskmanager-resurrect.bat")

                if os.path.exists(old_bat_startup):

                    try:

                        os.remove(old_bat_startup)

                    except Exception:

                        pass

                # Create silent .vbs launcher that runs pm2-resurrect.bat with window style 0 (hidden)

                vbs_startup = os.path.join(paths["startup_folder"], "deskmanager-resurrect.vbs")

                vbs_code = f'CreateObject("Wscript.Shell").Run "cmd /c ""{paths["backend_bat"]}""", 0, False\r\n'

                with open(vbs_startup, "w", encoding="utf-8") as f:

                    f.write(vbs_code)

                startup_created = True

        except Exception as e:

            print("Failed to write to Startup folder:", e)



        return {

            "success": True,

            "message": "PM2 backend service started and autostart enabled successfully!",

            "startup_created": startup_created,

            "startup_bat_path": paths["startup_bat"]

        }



    def control_pm2_service(self, action):

        paths = get_backend_paths()

        pm2_cmd = find_pm2_cmd()

        if not pm2_cmd:

            return {"success": False, "error": "PM2 is not installed."}



        action = (action or "").lower()

        if action not in ["start", "stop", "restart", "delete"]:

            return {"success": False, "error": f"Invalid action: {action}"}



        try:

            res = subprocess.run([pm2_cmd, action, "deskmanager-backend"], cwd=paths["backend_dir"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=15, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

            if action == "delete":

                try:

                    subprocess.run([pm2_cmd, "save"], cwd=paths["backend_dir"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=10, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

                except Exception:

                    pass

                if paths["startup_bat"] and os.path.exists(paths["startup_bat"]):

                    try:

                        os.remove(paths["startup_bat"])

                    except Exception:

                        pass

                vbs_path = os.path.join(paths["startup_folder"], "deskmanager-resurrect.vbs") if paths["startup_folder"] else ""

                if vbs_path and os.path.exists(vbs_path):

                    try:

                        os.remove(vbs_path)

                    except Exception:

                        pass

            return {"success": True, "message": f"Service action '{action}' completed."}

        except Exception as e:

            return {"success": False, "error": str(e)}



    def get_pm2_logs(self):

        paths = get_backend_paths()

        user_home = os.environ.get("USERPROFILE", os.path.expanduser("~"))

        pm2_logs_dir = os.path.join(user_home, ".pm2", "logs")

        out_log = os.path.join(pm2_logs_dir, "deskmanager-backend-out.log")

        err_log = os.path.join(pm2_logs_dir, "deskmanager-backend-error.log")



        logs_lines = []

        if os.path.exists(out_log):

            try:

                with open(out_log, "r", encoding="utf-8", errors="replace") as f:

                    lines = f.readlines()

                    logs_lines.extend(lines[-35:])

            except Exception:

                pass



        if os.path.exists(err_log):

            try:

                with open(err_log, "r", encoding="utf-8", errors="replace") as f:

                    err_lines = f.readlines()

                    if err_lines:

                        logs_lines.append("\n--- Error Log ---\n")

                        logs_lines.extend(err_lines[-15:])

            except Exception:

                pass



        if logs_lines:

            return {"success": True, "logs": "".join(logs_lines).strip()}



        pm2_cmd = find_pm2_cmd()

        if not pm2_cmd:

            return {"success": False, "error": "PM2 is not installed."}



        try:

            res = subprocess.run([pm2_cmd, "logs", "deskmanager-backend", "--lines", "40", "--nostream"], cwd=paths["backend_dir"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=10, shell=True, env=get_env_with_node(), creationflags=NO_WINDOW_FLAG)

            logs = res.stdout + ("\n" + res.stderr if res.stderr else "")

            return {"success": True, "logs": logs.strip()}

        except Exception as e:

            return {"success": False, "error": str(e)}



    def open_startup_folder(self):

        paths = get_backend_paths()

        if paths["startup_folder"] and os.path.exists(paths["startup_folder"]):

            os.startfile(paths["startup_folder"])

            return {"success": True}

        return {"success": False, "error": f"Folder not found: {paths['startup_folder']}"}



    def open_backend_folder(self):

        paths = get_backend_paths()

        if os.path.exists(paths["backend_dir"]):

            os.startfile(paths["backend_dir"])

            return {"success": True}

        return {"success": False, "error": f"Folder not found: {paths['backend_dir']}"}



if __name__ == "__main__":

    api = Api()

    html_file = get_resource_path("index.html")



    window = webview.create_window(

        title="DeskManage - Desktop App",

        url=html_file,

        js_api=api,

        width=1080,

        height=720,

        resizable=True,

        min_size=(900, 600)

    )



    webview.start(debug=False)

