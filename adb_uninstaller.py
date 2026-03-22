import sys
import subprocess
from PyQt6.QtWidgets import (
    QApplication, QWidget, QLabel, QLineEdit, QListWidget,
    QPushButton, QVBoxLayout, QHBoxLayout, QMessageBox, QListWidgetItem, QAbstractItemView
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QIcon


# Hide console window on Windows
if sys.platform == "win32":
    import ctypes
    ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)

class ADBUninstaller(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ADB App Uninstaller")
        self.resize(700, 520)
        self.setWindowIcon(QIcon("app_icon.ico"))

        self.sys_packages = []
        self.user_packages = []

        # List widgets for showing package list
        self.list_sys = QListWidget()
        self.list_sys.setSelectionMode(QAbstractItemView.SelectionMode.MultiSelection)
        self.list_user = QListWidget()
        self.list_user.setSelectionMode(QAbstractItemView.SelectionMode.MultiSelection)

        lbl_sys = QLabel("System Apps")
        lbl_user = QLabel("3rd Party Apps")

        vbox_sys = QVBoxLayout()
        vbox_sys.addWidget(lbl_sys)
        vbox_sys.addWidget(self.list_sys)

        vbox_user = QVBoxLayout()
        vbox_user.addWidget(lbl_user)
        vbox_user.addWidget(self.list_user)

        lists_layout = QHBoxLayout()
        lists_layout.addLayout(vbox_sys)
        lists_layout.addLayout(vbox_user)

        # Search box
        self.search_entry = QLineEdit()
        self.search_entry.setPlaceholderText("Search apps...")
        self.search_entry.textChanged.connect(self.search_package)

        # Buttons layout
        btn_layout = QHBoxLayout()
        self.btn_refresh = QPushButton("Refresh")
        self.btn_refresh.clicked.connect(self.refresh_list)
        self.btn_uninstall = QPushButton("Uninstall Selected")
        self.btn_uninstall.clicked.connect(self.uninstall_selected)

        btn_layout.addWidget(self.btn_refresh)
        btn_layout.addWidget(self.btn_uninstall)

        # Status label
        self.status_label = QLabel("Waiting for action...")
        self.status_label.setStyleSheet("color: blue;")

        # Main layout
        main_layout = QVBoxLayout()
        main_layout.addLayout(lists_layout)
        main_layout.addWidget(self.search_entry)
        main_layout.addLayout(btn_layout)
        main_layout.addWidget(self.status_label)

        self.setLayout(main_layout)

        # Load package list at start
        self.refresh_list()

    def get_installed_packages(self):
        try:
            # Fetch System Apps
            cmd_sys = ["adb", "shell", "pm", "list", "packages", "-s", "--user", "0"]
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            result_sys = subprocess.run(cmd_sys, capture_output=True, text=True, startupinfo=startupinfo)
            if result_sys.returncode != 0:
                return [], [], "ADB not running or device not connected!"
            lines_sys = result_sys.stdout.strip().split('\n')
            sys_pkgs = [line.replace("package:", "").strip() for line in lines_sys if line]

            # Fetch 3rd Party Apps
            cmd_user = ["adb", "shell", "pm", "list", "packages", "-3", "--user", "0"]
            result_user = subprocess.run(cmd_user, capture_output=True, text=True, startupinfo=startupinfo)
            lines_user = result_user.stdout.strip().split('\n')
            user_pkgs = [line.replace("package:", "").strip() for line in lines_user if line]

            return sys_pkgs, user_pkgs, ""
        except Exception as e:
            return [], [], f"Error: {str(e)}"

    def uninstall_package(self, pkg):
        cmd = ["adb", "shell", "pm", "uninstall", "-k", "--user", "0", pkg]
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        result = subprocess.run(cmd, capture_output=True, text=True, startupinfo=startupinfo)
        output = result.stdout.strip()
        if "Success" in output:
            return True, f"Successfully uninstalled: {pkg}"
        else:
            return False, f"Failed to uninstall: {pkg} - {output}"

    def refresh_list(self):
        self.status_label.setText("Loading package list...")
        QApplication.processEvents()  # Update UI

        sys_pkgs, user_pkgs, err = self.get_installed_packages()
        if err:
            QMessageBox.critical(self, "Error", err)
            self.status_label.setText(err)
            self.sys_packages, self.user_packages = [], []
            self.list_sys.clear()
            self.list_user.clear()
            return

        self.sys_packages = sorted(sys_pkgs)
        self.user_packages = sorted(user_pkgs)
        self.update_lists(self.sys_packages, self.user_packages)
        self.status_label.setText(f"Loaded {len(sys_pkgs)} system apps and {len(user_pkgs)} 3rd-party apps.")

    def update_lists(self, sys_list, user_list):
        self.list_sys.clear()
        for pkg in sys_list:
            self.list_sys.addItem(QListWidgetItem(pkg))
            
        self.list_user.clear()
        for pkg in user_list:
            self.list_user.addItem(QListWidgetItem(pkg))

    def search_package(self):
        keyword = self.search_entry.text().strip().lower()
        if not self.sys_packages and not self.user_packages:
            return
            
        if keyword == "":
            self.update_lists(self.sys_packages, self.user_packages)
        else:
            filtered_sys = [pkg for pkg in self.sys_packages if keyword in pkg.lower()]
            filtered_user = [pkg for pkg in self.user_packages if keyword in pkg.lower()]
            self.update_lists(filtered_sys, filtered_user)

    def uninstall_selected(self):
        selected_sys = self.list_sys.selectedItems()
        selected_user = self.list_user.selectedItems()
        
        all_selected = selected_sys + selected_user
        if not all_selected:
            QMessageBox.warning(self, "No Selection", "Please select apps to uninstall.")
            return
            
        pkgs = [item.text() for item in all_selected]

        reply = QMessageBox.question(
            self,
            "Confirm",
            f"Are you sure you want to uninstall {len(pkgs)} app(s)?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply != QMessageBox.StandardButton.Yes:
            return

        ok, fail = 0, 0
        for pkg in pkgs:
            success, msg = self.uninstall_package(pkg)
            if success:
                ok += 1
            else:
                fail += 1
            self.status_label.setText(msg)
            QApplication.processEvents()

        QMessageBox.information(self, "Result", f"Success: {ok}\nFailed: {fail}")
        self.refresh_list()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle('windowsvista')
    window = ADBUninstaller()
    window.show()
    sys.exit(app.exec())