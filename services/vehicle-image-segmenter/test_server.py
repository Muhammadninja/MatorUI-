import io
import unittest

from PIL import Image

from server import enforce_foreground_confidence, validate_cutout, validate_source


def encoded(image: Image.Image, fmt: str) -> bytes:
    output = io.BytesIO()
    image.save(output, format=fmt)
    return output.getvalue()


class SegmentationQualityTests(unittest.TestCase):
    def test_accepts_supported_photo_and_returns_oriented_dimensions(self):
        data = encoded(Image.new("RGB", (800, 400), "#789"), "JPEG")
        self.assertEqual(validate_source(data), (800, 400))

    def test_rejects_small_or_invalid_input(self):
        with self.assertRaises(ValueError):
            validate_source(encoded(Image.new("RGB", (400, 200)), "JPEG"))
        with self.assertRaises(ValueError):
            validate_source(b"not an image")

    def test_accepts_transparent_subject_with_padding(self):
        image = Image.new("RGBA", (800, 400), (0, 0, 0, 0))
        for x in range(100, 700):
            for y in range(100, 330):
                image.putpixel((x, y), (30, 40, 50, 255))
        result = encoded(image, "PNG")
        checks = validate_cutout(result, (800, 400))
        self.assertGreater(checks["alphaCoverage"], 0.03)
        self.assertEqual(checks["bounds"], [100, 100, 700, 330])

    def test_rejects_opaque_background_and_empty_mask(self):
        with self.assertRaises(ValueError):
            validate_cutout(encoded(Image.new("RGBA", (800, 400), (255, 255, 255, 255)), "PNG"), (800, 400))
        with self.assertRaises(ValueError):
            validate_cutout(encoded(Image.new("RGBA", (800, 400), (0, 0, 0, 0)), "PNG"), (800, 400))

    def test_removes_low_confidence_background_haze(self):
        image = Image.new("RGBA", (800, 400), (0, 0, 0, 0))
        for x in range(100, 700):
            for y in range(100, 330):
                image.putpixel((x, y), (30, 40, 50, 255))
        image.putpixel((20, 20), (80, 90, 100, 128))
        result = Image.open(io.BytesIO(enforce_foreground_confidence(encoded(image, "PNG"))))
        self.assertEqual(result.getpixel((20, 20))[3], 0)
        self.assertEqual(result.getpixel((300, 200))[3], 255)

    def test_rejects_vehicle_touching_side_or_roof_frame(self):
        image = Image.new("RGBA", (800, 400), (0, 0, 0, 0))
        for x in range(0, 500):
            for y in range(50, 300):
                image.putpixel((x, y), (30, 40, 50, 255))
        with self.assertRaisesRegex(ValueError, "cropped"):
            validate_cutout(encoded(image, "PNG"), (800, 400))


if __name__ == "__main__":
    unittest.main()
