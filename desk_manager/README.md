# DeskManager Network Server Finder & Chrome Launcher

A fast, lightweight Python desktop application that automatically discovers devices connected to your local router running on **port 5000**, retrieves their **IPv4 address**, and opens the service (`http://<ipv4>:5000`) in **Google Chrome**.

---

## 🚀 Key Features

- **Automatic Router & Subnet Discovery:**
  - Identifies the default router gateway (e.g. `192.168.1.1`, `10.187.105.209`).
  - Reads active connected devices from the system ARP table (`arp -a`).
  - Rapidly probes the entire `/24` router subnet in parallel using a multi-threaded pool (completes in ~1 to 4 seconds).
- **Service Verification on Port 5000:**
  - Checks TCP socket connectivity on port 5000.
  - Verifies HTTP response status (e.g., HTTP 200 OK).
- **Google Chrome Integration:**
  - Locates Google Chrome directly on Windows (`Program Files`, `Local AppData`, system PATH).
  - Automatically launches the detected URL (`http://<ipv4>:5000`) in Google Chrome.
  - Gracefully falls back to the system default browser if Chrome is not installed.
- **Modern Dark Desktop GUI:**
  - Clean slate dark-themed interface built using Python's standard `tkinter`.
  - Shows router gateway, local machine IP, and real-time scanning progress.
  - Interactive table of discovered servers with single/double-click to open.
  - Copy URL and rescan controls.
  - Customizable target port (default: 5000).
- **Zero Third-Party Pip Dependencies:**
  - Built strictly using Python's standard library (`socket`, `subprocess`, `threading`, `urllib`, `webbrowser`, `tkinter`).
  - Runs out of the box on any Windows PC with Python 3.8+.
- **CLI & Headless Support:**
  - Can be run directly from terminal or automated scripts with `--cli`.

---

## 📂 File Structure

```
desk_manager/
├── main.py              # Main desktop GUI application & CLI entry point
├── scanner.py           # Core network scanning & Chrome launching engine
├── deskmanager.ico      # Application icon
├── run.bat              # One-click Windows batch launcher
├── build.bat            # PyInstaller script to compile into standalone .exe
├── requirements.txt     # Dependency information
└── README.md            # Documentation
```

---

## 💻 How to Run

### 1. Launch the Desktop GUI
Double-click `run.bat` or run:
```bash
python main.py
```
*Upon launch, it immediately scans the router network and automatically opens the discovered server in Google Chrome.*

### 2. Run in CLI / Terminal Mode
To run without the GUI (in console only):
```bash
python main.py --cli
```
Or directly:
```bash
python scanner.py
```

### 3. Additional CLI Flags
```bash
# Scan a custom port (e.g. port 8080 or 4000)
python main.py --cli --port 8080

# Scan without automatically opening Chrome
python main.py --cli --no-open

# Open GUI without scanning automatically on startup
python main.py --no-auto-scan
```

---

## 🛠️ Building Standalone Windows Executable (.exe)

To compile into a single `.exe` file that can be distributed to any Windows PC without requiring Python installed:

1. Ensure `pyinstaller` is installed:
   ```bash
   pip install pyinstaller
   ```
2. Run the build script:
   - Double-click `build.bat`, or
   - Run:
     ```bash
     pyinstaller --noconsole --onefile --name="DeskManagerFinder" --icon="deskmanager.ico" --add-data "deskmanager.ico;." --add-data "scanner.py;." main.py
     ```
3. The standalone binary will be created in:
   ```
   desk_manager/dist/DeskManagerFinder.exe
   ```
