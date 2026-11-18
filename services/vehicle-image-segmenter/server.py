#!/usr/bin/env python3
"""Private single-worker vehicle-photo segmentation service (U2NetP / ONNX CPU)."""
from http.server import BaseHTTPRequestHandler
from io import BytesIO
import json
import os
from pathlib import Path
from socketserver import UnixStreamServer
import threading

from PIL import Image, ImageOps
from rembg import new_session, remove

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 20_000_000
MODEL = "u2net"
ALPHA_THRESHOLD = 192
SOCKET_PATH = os.environ.get("VEHICLE_IMAGE_SEGMENTER_SOCKET", "/run/mator-vehicle-image-segmenter/api.sock")


def validate_source(data: bytes) -> tuple[int, int]:
    if not data or len(data) > MAX_BYTES:
        raise ValueError("source size is invalid")
    try:
        with Image.open(BytesIO(data)) as image:
            source_format = image.format
            image = ImageOps.exif_transpose(image)
            if source_format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("source format is unsupported")
            width, height = image.size
            if width < 512 or height < 256 or width * height > MAX_PIXELS:
                raise ValueError("source dimensions are outside the supported range")
            image.load()
    except ValueError:
        raise
    except (OSError, SyntaxError, Image.DecompressionBombError) as error:
        raise ValueError("source image is not decodable") from error
    return width, height


def validate_cutout(data: bytes, expected: tuple[int, int]) -> dict:
    with Image.open(BytesIO(data)) as image:
        if image.format != "PNG" or image.mode != "RGBA" or image.size != expected:
            raise ValueError("segmentation output contract failed")
        alpha = image.getchannel("A")
        histogram = alpha.histogram()
        visible = sum(histogram[16:])
        if visible < expected[0] * expected[1] * 0.03 or visible > expected[0] * expected[1] * 0.97:
            raise ValueError("segmentation subject coverage is implausible")
        bounds = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
        if not bounds:
            raise ValueError("segmentation produced an empty subject")
        left, top, right, bottom = bounds
        margin = max(2, int(min(expected) * 0.003))
        if left <= margin or top <= margin or right >= expected[0] - margin:
            raise ValueError("segmentation may have cropped the vehicle at the frame edge")
        return {"alphaCoverage": round(visible / (expected[0] * expected[1]), 4),
                "bounds": [left, top, right, bottom]}


def enforce_foreground_confidence(data: bytes) -> bytes:
    """Drop low-confidence background haze while retaining confident vehicle pixels."""
    with Image.open(BytesIO(data)) as image:
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A").point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0)
        rgba.putalpha(alpha)
        output = BytesIO()
        rgba.save(output, format="PNG", optimize=True)
        return output.getvalue()


class SegmenterServer(UnixStreamServer):
    allow_reuse_address = True
    request_queue_size = 2


class Handler(BaseHTTPRequestHandler):
    server_version = "MatorImageSegmenter/1.0"
    session = None

    def log_message(self, _format, *_args):
        # Never log image bytes, filenames, or source metadata.
        return

    def send_json(self, status: int, body: dict):
        encoded = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path != "/health/ready" or self.session is None:
            self.send_json(404 if self.path != "/health/ready" else 503, {"status": "not_ready"})
            return
        self.send_json(200, {"status": "ready", "model": MODEL, "provider": "onnx-cpu"})

    def do_POST(self):
        if self.path != "/segment":
            self.send_json(404, {"error": "not_found"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 32 or size > MAX_BYTES or self.headers.get("Content-Type") != "application/octet-stream":
                self.send_json(413, {"error": "invalid_request_size_or_type"})
                return
            raw = self.rfile.read(size)
            if len(raw) != size:
                self.send_json(400, {"error": "truncated_request"})
                return
            dimensions = validate_source(raw)
            with self.server.inference_lock:
                result = remove(raw, session=self.session, force_return_bytes=True, decontaminate=True)
            result = enforce_foreground_confidence(result)
            validate_cutout(result, dimensions)
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(result)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(result)
        except ValueError as error:
            self.send_json(422, {"error": str(error)[:120]})
        except Exception:
            self.send_json(503, {"error": "segmentation_failed"})


def main():
    path = Path(SOCKET_PATH)
    path.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    session = new_session(MODEL, providers=["CPUExecutionProvider"])
    Handler.session = session
    server = SegmenterServer(str(path), Handler)
    os.chmod(path, 0o660)
    server.inference_lock = threading.Lock()
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()
        if path.exists():
            path.unlink()


if __name__ == "__main__":
    main()
