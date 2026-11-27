"""Shared mask tracing: marching squares + Ramer-Douglas-Peucker, for the mounted-figure tools.

Grid points are (col, row) at cell-edge midpoints in pixel-index space (the continuous pixel
coordinate is +0.5).
"""
import math
from PIL import Image


def mask_of(path, threshold=128):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    a = im.getchannel("A").load()
    return [[1 if a[c, r] >= threshold else 0 for c in range(w)] for r in range(h)]


def contours(m):
    """Closed outlines of a binary grid (list of rows of 0/1)."""
    h, w = len(m), len(m[0])

    def val(r, c):
        return m[r][c] if 0 <= r < h and 0 <= c < w else 0

    def pos(k):
        t, r, c = k
        return (c + .5, r) if t == 'h' else (c, r + .5)

    # Only scan the bounding box of the set pixels (plus a margin).
    rows = [r for r in range(h) if any(m[r])]
    if not rows:
        return []
    cols = [c for c in range(w) if any(m[r][c] for r in rows)]
    r0, r1, c0, c1 = rows[0] - 1, rows[-1] + 1, cols[0] - 1, cols[-1] + 1
    adj = {}
    for i in range(r0, r1):
        for j in range(c0, c1):
            tl, tr, br, bl = val(i, j), val(i, j + 1), val(i + 1, j + 1), val(i + 1, j)
            if tl == tr == br == bl:
                continue
            top, right, bottom, left = ('h', i, j), ('v', i, j + 1), ('h', i + 1, j), ('v', i, j)
            cross = [e for e, a, b in ((top, tl, tr), (right, tr, br), (bottom, br, bl), (left, bl, tl)) if a != b]
            if len(cross) == 2:
                pairs = [(cross[0], cross[1])]
            elif tl == 1 and br == 1:
                pairs = [(top, left), (right, bottom)]
            else:
                pairs = [(top, right), (bottom, left)]
            for a, b in pairs:
                adj.setdefault(a, []).append(b)
                adj.setdefault(b, []).append(a)
    loops, seen = [], set()
    for start in adj:
        if start in seen:
            continue
        loop, prev, cur = [], None, start
        while True:
            seen.add(cur)
            loop.append(pos(cur))
            nxt = [k for k in adj[cur] if k != prev and k not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
        if len(loop) >= 3:
            loops.append(loop)
    return loops


def rdp(points, eps):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-9
    best, idx = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
        if d > best:
            best, idx = d, i
    if best > eps:
        return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]


def simplify_closed(loop, eps):
    """RDP on a closed loop: split at the point farthest from the start, simplify both halves."""
    if len(loop) < 4:
        return loop
    x0, y0 = loop[0]
    far = max(range(1, len(loop)), key=lambda i: (loop[i][0] - x0) ** 2 + (loop[i][1] - y0) ** 2)
    return rdp(loop[:far + 1], eps)[:-1] + rdp(loop[far:] + [loop[0]], eps)[:-1]
