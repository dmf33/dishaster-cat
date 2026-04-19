import math
import os
import struct
import zlib


SIZE = 512
OUTPUT_PATH = os.path.join("assets", "images", "favicon.png")


def clamp(value, low=0, high=255):
    return max(low, min(high, int(value)))


class Canvas:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.pixels = bytearray(width * height * 4)

    def blend_pixel(self, x, y, color):
        if x < 0 or y < 0 or x >= self.width or y >= self.height:
            return

        r, g, b, a = color
        offset = (y * self.width + x) * 4
        dst_r = self.pixels[offset]
        dst_g = self.pixels[offset + 1]
        dst_b = self.pixels[offset + 2]
        dst_a = self.pixels[offset + 3]

        src_a = a / 255.0
        dst_a_f = dst_a / 255.0
        out_a = src_a + dst_a_f * (1 - src_a)

        if out_a <= 0:
            return

        out_r = (r * src_a + dst_r * dst_a_f * (1 - src_a)) / out_a
        out_g = (g * src_a + dst_g * dst_a_f * (1 - src_a)) / out_a
        out_b = (b * src_a + dst_b * dst_a_f * (1 - src_a)) / out_a

        self.pixels[offset] = clamp(out_r)
        self.pixels[offset + 1] = clamp(out_g)
        self.pixels[offset + 2] = clamp(out_b)
        self.pixels[offset + 3] = clamp(out_a * 255)

    def fill(self, color):
        for y in range(self.height):
          for x in range(self.width):
                self.blend_pixel(x, y, color)

    def fill_rounded_rect(self, x, y, width, height, radius, color):
        x0 = int(x)
        y0 = int(y)
        x1 = int(x + width)
        y1 = int(y + height)
        radius_sq = radius * radius

        for py in range(y0, y1):
            for px in range(x0, x1):
                dx = 0
                dy = 0
                if px < x + radius:
                    dx = x + radius - px
                elif px > x + width - radius:
                    dx = px - (x + width - radius)
                if py < y + radius:
                    dy = y + radius - py
                elif py > y + height - radius:
                    dy = py - (y + height - radius)

                if dx * dx + dy * dy <= radius_sq:
                    self.blend_pixel(px, py, color)
                elif dx == 0 or dy == 0:
                    self.blend_pixel(px, py, color)

    def fill_circle(self, cx, cy, radius, color):
        radius_sq = radius * radius
        x0 = int(cx - radius)
        x1 = int(cx + radius) + 1
        y0 = int(cy - radius)
        y1 = int(cy + radius) + 1
        for py in range(y0, y1):
            for px in range(x0, x1):
                dx = px - cx
                dy = py - cy
                if dx * dx + dy * dy <= radius_sq:
                    self.blend_pixel(px, py, color)

    def fill_ellipse(self, cx, cy, rx, ry, color):
        x0 = int(cx - rx)
        x1 = int(cx + rx) + 1
        y0 = int(cy - ry)
        y1 = int(cy + ry) + 1
        for py in range(y0, y1):
            for px in range(x0, x1):
                dx = (px - cx) / rx
                dy = (py - cy) / ry
                if dx * dx + dy * dy <= 1:
                    self.blend_pixel(px, py, color)

    def fill_triangle(self, p1, p2, p3, color):
        min_x = int(min(p1[0], p2[0], p3[0]))
        max_x = int(max(p1[0], p2[0], p3[0])) + 1
        min_y = int(min(p1[1], p2[1], p3[1]))
        max_y = int(max(p1[1], p2[1], p3[1])) + 1

        def sign(pa, pb, pc):
            return (pa[0] - pc[0]) * (pb[1] - pc[1]) - (pb[0] - pc[0]) * (pa[1] - pc[1])

        for py in range(min_y, max_y):
            for px in range(min_x, max_x):
                point = (px, py)
                d1 = sign(point, p1, p2)
                d2 = sign(point, p2, p3)
                d3 = sign(point, p3, p1)
                has_neg = d1 < 0 or d2 < 0 or d3 < 0
                has_pos = d1 > 0 or d2 > 0 or d3 > 0
                if not (has_neg and has_pos):
                    self.blend_pixel(px, py, color)

    def stroke_line(self, p1, p2, thickness, color):
        steps = int(max(abs(p2[0] - p1[0]), abs(p2[1] - p1[1]), 1))
        radius = thickness / 2
        for step in range(steps + 1):
            t = step / steps
            x = p1[0] + (p2[0] - p1[0]) * t
            y = p1[1] + (p2[1] - p1[1]) * t
            self.fill_circle(x, y, radius, color)

    def stroke_curve(self, points, thickness, color):
        for index in range(len(points) - 1):
            self.stroke_line(points[index], points[index + 1], thickness, color)

    def save_png(self, path):
        def png_chunk(chunk_type, data):
            return (
                struct.pack("!I", len(data))
                + chunk_type
                + data
                + struct.pack("!I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
            )

        raw = bytearray()
        stride = self.width * 4
        for y in range(self.height):
            raw.append(0)
            start = y * stride
            raw.extend(self.pixels[start:start + stride])

        png = bytearray(b"\x89PNG\r\n\x1a\n")
        png.extend(png_chunk(b"IHDR", struct.pack("!IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0)))
        png.extend(png_chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        png.extend(png_chunk(b"IEND", b""))

        with open(path, "wb") as output_file:
            output_file.write(png)


def draw_favicon():
    canvas = Canvas(SIZE, SIZE)

    cream = (255, 247, 235, 255)
    warm_circle = (246, 231, 200, 255)
    cat_brown = (123, 75, 42, 255)
    cat_dark = (74, 45, 31, 255)
    ear_pink = (244, 214, 188, 255)
    eye_white = (255, 247, 235, 255)
    shadow = (109, 68, 40, 48)

    canvas.fill_rounded_rect(0, 0, SIZE, SIZE, 96, cream)
    canvas.fill_circle(256, 256, 208, warm_circle)

    canvas.fill_ellipse(238, 308, 128, 88, shadow)
    canvas.fill_circle(336, 262, 60, shadow)
    canvas.stroke_curve(
        [(112, 320), (84, 292), (84, 236), (132, 228), (166, 258), (150, 318)],
        28,
        shadow,
    )

    canvas.fill_ellipse(238, 292, 126, 88, cat_brown)
    canvas.fill_circle(336, 246, 62, cat_brown)
    canvas.fill_triangle((288, 208), (314, 144), (344, 206), cat_brown)
    canvas.fill_triangle((334, 204), (364, 144), (390, 214), cat_brown)
    canvas.fill_rounded_rect(148, 334, 30, 92, 14, cat_brown)
    canvas.fill_rounded_rect(214, 346, 30, 80, 14, cat_brown)
    canvas.fill_rounded_rect(292, 344, 30, 82, 14, cat_brown)
    canvas.stroke_curve(
        [(118, 314), (86, 288), (86, 236), (128, 228), (170, 258), (142, 334)],
        34,
        cat_brown,
    )

    canvas.fill_triangle((304, 204), (316, 170), (332, 202), ear_pink)
    canvas.fill_triangle((346, 202), (362, 170), (374, 208), ear_pink)

    canvas.fill_ellipse(326, 242, 14, 16, eye_white)
    canvas.fill_ellipse(352, 242, 14, 16, eye_white)
    canvas.fill_circle(326, 244, 4, cat_dark)
    canvas.fill_circle(352, 244, 4, cat_dark)
    canvas.fill_ellipse(339, 262, 6, 4, cat_dark)

    for whisker in [
        ((315, 262), (286, 256)),
        ((315, 271), (284, 272)),
        ((363, 262), (392, 256)),
        ((363, 271), (394, 272)),
    ]:
        canvas.stroke_line(whisker[0], whisker[1], 5, cat_dark)

    canvas.save_png(OUTPUT_PATH)


if __name__ == "__main__":
    draw_favicon()
