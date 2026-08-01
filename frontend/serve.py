#!/usr/bin/env python3
"""
Secure HTTP Server for SereneMind Frontend.
Disables automatic directory browsing/listings to prevent sensitive path exposure.
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class SecureHTTPRequestHandler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        """Disables directory browsing by sending a 403 Forbidden error response."""
        self.send_error(403, "Access denied: Directory browsing is disabled for security.")
        return None

    def do_GET(self):
        # Clean path from query strings and hashes
        cleaned_path = self.path.split('?')[0].split('#')[0]
        if cleaned_path.endswith('/') and cleaned_path != '/':
            full_dir = self.translate_path(self.path)
            index_path = os.path.join(full_dir, 'index.html')
            if not os.path.exists(index_path):
                self.send_error(403, "Access denied: Directory browsing is disabled for security.")
                return
        return super().do_GET()


def run_server():
    port = 8000
    directory = "."

    args = sys.argv[1:]
    if "--directory" in args:
        idx = args.index("--directory")
        if idx + 1 < len(args):
            directory = args[idx + 1]
            args.pop(idx + 1)
            args.pop(idx)

    for arg in args:
        if arg.isdigit():
            port = int(arg)
            break

    if directory and directory != ".":
        os.chdir(directory)

    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, SecureHTTPRequestHandler)
    print(f"Serving HTTP on 0.0.0.0 port {port} (Directory listing disabled) from {os.getcwd()} ...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    run_server()
