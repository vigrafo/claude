"""Erzeugt thematische Platzhalter-Illustrationen (SVG) in den Kilic-Farben."""
import math, random, json, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

LIGHT, LINE, INK, INK2, INK3 = "#efede9", "#dedad3", "#1b1f23", "#2a3036", "#3b434b"
ACC, ACCD, ACCS = "#e8892b", "#c96f17", "#fbeedf"
BLUE, BLUED, BLUES = "#1f6fd1", "#1756a6", "#e6effb"
RED = "#d7262f"


class Cam:
    def __init__(s, W, H, eye=(0.0, 1.55, 0.0), f=None, hor=0.42, look_x=0.0, tilt=0.0):
        s.W, s.H, s.e = W, H, eye
        s.f = f or W * 0.62
        s.cx = W * 0.5 - look_x * s.f
        s.cy = H * hor
        s.tilt = tilt

    def p(s, x, y, z):
        X, Y, Z = x - s.e[0], y - s.e[1], z - s.e[2]
        # Neigung nach unten
        c, si = math.cos(s.tilt), math.sin(s.tilt)
        Y, Z = Y * c + Z * si, -Y * si + Z * c
        Z = max(Z, 0.05)
        return (s.cx + s.f * X / Z, s.cy - s.f * Y / Z)

    def poly(s, pts, fill, extra=""):
        d = " ".join("%.1f,%.1f" % s.p(*q) for q in pts)
        return '<polygon points="%s" fill="%s" %s/>' % (d, fill, extra)

    def line(s, a, b, stroke, w, extra=""):
        (x1, y1), (x2, y2) = s.p(*a), s.p(*b)
        return '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f" stroke-linecap="round" %s/>' % (x1, y1, x2, y2, stroke, w, extra)

    def path(s, pts, stroke, w, extra=""):
        d = "M" + " L".join("%.1f %.1f" % s.p(*q) for q in pts)
        return '<path d="%s" fill="none" stroke="%s" stroke-width="%.2f" stroke-linejoin="round" stroke-linecap="round" %s/>' % (d, stroke, w, extra)

    def scale(s, z):
        return s.f / max(z - s.e[2], 0.05)


def defs(grads):
    out = "<defs>"
    for gid, (x1, y1, x2, y2, stops) in grads.items():
        out += '<linearGradient id="%s" x1="%s" y1="%s" x2="%s" y2="%s">' % (gid, x1, y1, x2, y2)
        for o, c, a in stops:
            out += '<stop offset="%s" stop-color="%s" stop-opacity="%s"/>' % (o, c, a)
        out += "</linearGradient>"
    out += ('<radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="glowA"><stop offset="0" stop-color="%s" stop-opacity=".55"/><stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="glowB"><stop offset="0" stop-color="#9cc3f5" stop-opacity=".6"/><stop offset="1" stop-color="#9cc3f5" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="glowR"><stop offset="0" stop-color="%s" stop-opacity=".9"/><stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient>'
            '<filter id="blur"><feGaussianBlur stdDeviation="6"/></filter>'
            '<filter id="blur2"><feGaussianBlur stdDeviation="18"/></filter>') % (ACC, ACC, RED, RED)
    return out + "</defs>"


def svg(W, H, body, grads=None):
    return '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">%s%s</svg>' % (W, H, W, H, defs(grads or {}), body)


# ---------- Raum ----------
MOODS = {
    "hell":   dict(wall="#d9d5cd", wall2="#c9c4bb", back="#e4e0d8", ceil="#cfcac1", floor=("#cbc6bd", "#a9a49b"), light="#fff4e3", sky="#f6e3c6"),
    "warm":   dict(wall="#cdbfae", wall2="#b8a996", back="#d8cab8", ceil="#bfb2a2", floor=("#c4b9ab", "#9c9184"), light="#ffe2bd", sky="#f2c690"),
    "dunkel": dict(wall="#2f353b", wall2="#262b30", back="#383e44", ceil="#24292e", floor=("#4a4f53", "#2a2f33"), light="#f3b878", sky="#e99a4c"),
    "blau":   dict(wall="#c9d0d8", wall2="#b6bec8", back="#d5dbe2", ceil="#bcc3cc", floor=("#b9bfc6", "#959ca4"), light="#eef4fb", sky="#cfe0f4"),
    "nacht":  dict(wall="#1d2329", wall2="#171c21", back="#232a31", ceil="#14181c", floor=("#2c3238", "#1a1f24"), light="#9cc3f5", sky="#2f4f78"),
}


def room(c, mood, W, H, depth=11.0, xw=4.2, ch=2.75, window="left", z0=0.6):
    m = MOODS[mood]
    g = {
        "fl": ("0", "0", "0", "1", [(0, m["floor"][0], 1), (1, m["floor"][1], 1)]),
        "lw": ("0", "0", "1", "0", [(0, m["wall2"], 1), (1, m["wall"], 1)]),
        "rw": ("1", "0", "0", "0", [(0, m["wall2"], 1), (1, m["wall"], 1)]),
        "bk": ("0", "0", "0", "1", [(0, m["back"], 1), (1, m["wall"], 1)]),
        "sky": ("0", "0", "0", "1", [(0, m["sky"], 1), (1, m["light"], 1)]),
        "beam": ("0", "0", "1", "1", [(0, m["light"], .55), (1, m["light"], 0)]),
    }
    b = '<rect width="%d" height="%d" fill="%s"/>' % (W, H, m["back"])
    b += c.poly([(-xw, ch, z0), (xw, ch, z0), (xw, ch, depth), (-xw, ch, depth)], m["ceil"])
    b += c.poly([(-xw, 0, depth), (xw, 0, depth), (xw, ch, depth), (-xw, ch, depth)], "url(#bk)")
    b += c.poly([(-xw, 0, z0), (-xw, 0, depth), (-xw, ch, depth), (-xw, ch, z0)], "url(#lw)")
    b += c.poly([(xw, 0, z0), (xw, 0, depth), (xw, ch, depth), (xw, ch, z0)], "url(#rw)")
    b += c.poly([(-xw, 0, z0), (xw, 0, z0), (xw, 0, depth), (-xw, 0, depth)], "url(#fl)")
    # Fenster in der Rückwand bzw. Seitenwand + Lichtkegel auf dem Boden
    if window in ("left", "right"):
        sx = -xw if window == "left" else xw
        for z1 in (depth * 0.38, depth * 0.66):
            z2 = z1 + 1.5
            b += c.poly([(sx, 0.9, z1), (sx, 0.9, z2), (sx, 2.25, z2), (sx, 2.25, z1)], "url(#sky)")
            b += c.poly([(sx, 0.9, z1), (sx, 0.9, z2), (sx * -0.05, 0, z2 + 1.2), (sx * -0.05, 0, z1 + 0.6)], "url(#beam)", 'opacity=".85"')
    else:
        b += c.poly([(-1.4, 0.9, depth), (1.4, 0.9, depth), (1.4, 2.3, depth), (-1.4, 2.3, depth)], "url(#sky)")
        b += c.poly([(-1.4, 0, depth), (1.4, 0, depth), (2.2, 0, depth - 4), (-2.2, 0, depth - 4)], "url(#beam)", 'opacity=".7"')
    # Sockel-/Randdämmstreifen
    b += c.line((-xw, 0.02, z0), (-xw, 0.02, depth), "#f2efe9", 3, 'opacity=".6"')
    b += c.line((xw, 0.02, z0), (xw, 0.02, depth), "#f2efe9", 3, 'opacity=".6"')
    b += c.line((-xw, 0.02, depth), (xw, 0.02, depth), "#f2efe9", 3, 'opacity=".6"')
    return b, g


def floor_sheen(c, x, z, r, op=.35):
    sx, sy = c.p(x, 0, z)
    rr = r * c.scale(z)
    return '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="url(#glow)" opacity="%s"/>' % (sx, sy, rr, rr * 0.22, op)


def screed_lines(c, x1, x2, z1, z2, n=18, col="#ffffff", op=.08):
    b = ""
    rnd = random.Random(3)
    for i in range(n):
        z = z1 + (z2 - z1) * i / n + rnd.uniform(-0.1, 0.1)
        b += c.line((x1, 0.005, z), (x2, 0.005, z + rnd.uniform(-0.2, 0.2)), col, 1.4, 'opacity="%s"' % op)
    return b


def person(c, x, z, tone=INK, accent=ACC, pose="kelle", scale=1.0, rim="#ffd9a8"):
    """Arbeiter von hinten (Silhouette), Fußpunkt x/z."""
    fx, fy = c.p(x, 0, z)
    s = c.scale(z) * scale
    u = lambda v: v * s
    b = '<g>'
    # Schatten
    b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#000" opacity=".25" filter="url(#blur)"/>' % (fx + u(.1), fy, u(.55), u(.09))
    hip = fy - u(.92)
    sh = fy - u(1.45)
    if pose == "knien":
        hip = fy - u(.55); sh = fy - u(1.05)
        b += '<path d="M%.1f %.1f q%.1f %.1f %.1f %.1f l%.1f 0 z" fill="%s"/>' % (fx - u(.32), fy, u(.05), -u(.5), u(.3), -u(.56), u(.25), tone)
        b += '<path d="M%.1f %.1f l%.1f %.1f l%.1f 0 l%.1f %.1f z" fill="%s"/>' % (fx + u(.02), hip, u(.45), u(.5), u(.2), -u(.2), -u(.55), "#20262b")
    else:
        # Beine (Arbeitshose mit Kniepolster)
        b += '<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="%s"/>' % (fx - u(.24), fy, fx - u(.17), hip, fx - u(.01), hip, fx - u(.06), fy, "#262c31")
        b += '<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="%s"/>' % (fx + u(.04), fy, fx + u(.01), hip, fx + u(.18), hip, fx + u(.24), fy, "#262c31")
        b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#14181b"/>' % (fx - u(.27), fy - u(.08), u(.23), u(.1), u(.03))
        b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#14181b"/>' % (fx + u(.03), fy - u(.08), u(.23), u(.1), u(.03))
    # Oberkörper (Jacke), leicht vorgebeugt
    lean = u(.12) if pose in ("kelle", "latte") else 0
    b += '<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f L%.1f %.1f Q%.1f %.1f %.1f %.1f Z" fill="%s"/>' % (
        fx - u(.22), hip, fx - u(.3) + lean, sh + u(.15), fx - u(.24) + lean, sh, fx + u(.26) + lean, sh, fx + u(.32) + lean, sh + u(.15), fx + u(.23), hip, tone)
    # Warnweste-Streifen in Akzentfarbe
    b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" opacity=".95"/>' % (fx - u(.27) + lean * .6, hip - u(.2), u(.54), u(.045), accent)
    b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" opacity=".95"/>' % (fx - u(.29) + lean * .8, hip - u(.36), u(.58), u(.045), accent)
    # Kopf (Hinterkopf) + Mütze
    hx, hy = fx + lean * 1.1, sh - u(.14)
    b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (hx - u(.05), sh - u(.08), u(.1), u(.1), "#2a2420")
    b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#2b2622"/>' % (hx, hy, u(.105), u(.125))
    b += '<path d="M%.1f %.1f a%.1f %.1f 0 0 1 %.1f 0 z" fill="%s"/>' % (hx - u(.112), hy - u(.01), u(.112), u(.12), u(.224), accent if accent != BLUE else BLUED)
    # Arme + Werkzeug
    if pose == "kelle":
        b += '<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="%s"/>' % (fx + u(.2) + lean, sh + u(.05), fx + u(.45) + lean, hip + u(.05), fx + u(.55) + lean, hip, fx + u(.3) + lean, sh + u(.02), tone)
        b += '<path d="M%.1f %.1f l%.1f %.1f l%.1f %.1f l%.1f %.1f z" fill="#c9ccce"/>' % (fx + u(.5) + lean, hip + u(.02), u(.32), u(.05), -u(.05), u(.05), -u(.32), -u(.03))
    elif pose == "latte":
        b += '<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="%s"/>' % (fx - u(.22) + lean, sh + u(.05), fx - u(.42) + lean, hip, fx - u(.33) + lean, hip + u(.02), fx - u(.12) + lean, sh + u(.08), tone)
        b += '<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="%s"/>' % (fx + u(.2) + lean, sh + u(.05), fx + u(.42) + lean, hip, fx + u(.33) + lean, hip + u(.02), fx + u(.12) + lean, sh + u(.08), tone)
        b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#b9bcbe"/>' % (fx - u(1.1) + lean, hip - u(.02), u(2.2), u(.06), u(.02))
    elif pose == "wasserwaage":
        b += '<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="%s"/>' % (fx + u(.2), sh + u(.05), fx + u(.34), hip - u(.05), fx + u(.25), hip, fx + u(.13), sh + u(.1), tone)
        b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s" transform="rotate(-8 %.1f %.1f)"/>' % (fx + u(.18), hip - u(.08), u(.09), u(.95), u(.02), ACC, fx + u(.22), hip)
    elif pose == "schacht":
        b += '<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="%s"/>' % (fx + u(.2), sh + u(.05), fx + u(.5), hip + u(.15), fx + u(.58), hip + u(.08), fx + u(.3), sh + u(.02), tone)
    b += '</g>'
    # Lichtkante
    b += '<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f" stroke="%s" stroke-width="%.1f" fill="none" opacity=".55"/>' % (fx + u(.26) + lean, sh, fx + u(.33) + lean, sh + u(.2), fx + u(.24), hip, rim, max(1.5, u(.02)))
    return b


def bucket(c, x, z, col=ACC, r=.17, h=.33):
    cx, cy = c.p(x, 0, z)
    s = c.scale(z)
    return ('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#000" opacity=".2" filter="url(#blur)"/>' % (cx + 6, cy, r * s * 1.3, r * s * .35) +
            '<path d="M%.1f %.1f L%.1f %.1f A%.1f %.1f 0 0 0 %.1f %.1f L%.1f %.1f A%.1f %.1f 0 0 1 %.1f %.1f Z" fill="%s"/>' % (
                cx - r * s, cy - h * s, cx - r * s * .85, cy, r * s * .85, r * s * .3, cx + r * s * .85, cy, cx + r * s, cy - h * s, r * s, r * s * .3, cx - r * s, cy - h * s, col) +
            '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#6f6a63"/>' % (cx, cy - h * s, r * s, r * s * .3) +
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#fff" opacity=".18"/>' % (cx - r * s * .7, cy - h * s * .8, r * s * .25, h * s * .7))


# ---------- Motive ----------
def m_estrich_person(W, H, mood="warm", pose="kelle", look=-0.35, px=1.3, pz=4.6):
    c = Cam(W, H, look_x=look, hor=0.4)
    b, g = room(c, mood, W, H)
    b += screed_lines(c, -4, 4, 1, 11, 26, op=.06)
    b += floor_sheen(c, 1.5, 6.5, 2.4, .35)
    b += c.poly([(-4.2, 0.004, 0.6), (4.2, 0.004, 0.6), (4.2, 0.004, 3.2), (-4.2, 0.004, 3.4)], "#5d5953", 'opacity=".18"')
    b += bucket(c, 2.9, 7.5)
    b += bucket(c, 3.3, 7.9, "#b9b3a9")
    b += person(c, px, pz, pose=pose, rim="#ffd29b" if mood != "dunkel" else "#f3b878")
    return svg(W, H, b, g)


def m_raum(W, H, mood="hell", look=-0.3, window="left", sheen=True):
    c = Cam(W, H, look_x=look, hor=0.42)
    b, g = room(c, mood, W, H, window=window)
    b += screed_lines(c, -4, 4, 1, 11, 30, op=.05)
    if sheen:
        b += floor_sheen(c, 0.5, 6, 3.5, .45)
        b += floor_sheen(c, -1, 4, 2.2, .25)
    return svg(W, H, b, g)


def m_heiz(W, H, look=-0.1):
    c = Cam(W, H, eye=(0, 1.7, 0), look_x=look, hor=0.3, tilt=0.18)
    b, g = room(c, "hell", W, H, depth=9)
    # Noppenplatten
    b += c.poly([(-4.2, 0.01, 0.6), (4.2, 0.01, 0.6), (4.2, 0.01, 9), (-4.2, 0.01, 9)], "#e6e1d8")
    for i in range(0, 85):
        z = 0.8 + i * 0.1
        if z > 9:
            break
        b += c.line((-4.1, 0.015, z), (4.1, 0.015, z), "#cfc9be", max(0.6, 0.012 * c.scale(z)))
    for j in range(-41, 42):
        x = j * 0.1
        b += c.line((x, 0.015, 0.8), (x, 0.015, 9), "#d6d0c5", 0.8)
    # Heizkreise (Schlangen)
    for xs, col in ((-3.8, ACC), (0.2, "#d96a2a")):
        pts = []
        z = 0.9
        dirx = 1
        while z < 8.6:
            a, bx = (xs, xs + 3.4) if dirx > 0 else (xs + 3.4, xs)
            pts += [(a, 0.04, z), (bx, 0.04, z)]
            # Bogen
            for k in range(1, 8):
                t = math.pi * k / 8
                pts.append((bx + dirx * 0.15 * math.sin(t), 0.04, z + 0.15 - 0.15 * math.cos(t)))
            z += 0.3
            dirx *= -1
        for q in range(len(pts) - 1):
            zz = pts[q][2]
            b += c.line(pts[q], pts[q + 1], col, max(2.2, 0.03 * c.scale(zz)))
    # Verteiler an der Rückwand
    b += c.poly([(-0.6, 0.2, 9), (0.6, 0.2, 9), (0.6, 1.0, 9), (-0.6, 1.0, 9)], "#9aa1a6")
    b += c.poly([(-0.55, 0.62, 8.98), (0.55, 0.62, 8.98), (0.55, 0.68, 8.98), (-0.55, 0.68, 8.98)], RED)
    b += c.poly([(-0.55, 0.38, 8.98), (0.55, 0.38, 8.98), (0.55, 0.44, 8.98), (-0.55, 0.44, 8.98)], BLUE)
    # Randdämmstreifen
    b += c.poly([(-4.2, 0, 0.6), (-4.2, 0, 9), (-4.2, 0.12, 9), (-4.2, 0.12, 0.6)], "#f4f2ee")
    return svg(W, H, b, g)


def m_fliess(W, H, look=-0.3, roller=False):
    c = Cam(W, H, look_x=look, hor=0.38)
    b, g = room(c, "warm", W, H)
    # glänzende Fläche
    b += c.poly([(-4.2, 0.01, 0.6), (4.2, 0.01, 0.6), (4.2, 0.01, 8), (-4.2, 0.01, 7.4)], "#d9cfc2", 'opacity=".9"')
    # Spiegelung des Fensters
    b += c.poly([(-4.0, 0.012, 4.2), (-1.6, 0.012, 5.6), (-1.0, 0.012, 7.6), (-3.6, 0.012, 7)], "#fff7ea", 'opacity=".55"')
    # Wellenfront
    pts = [(x / 10, 0.02, 7.4 + 0.6 * (x / 84) + 0.12 * math.sin(x / 6)) for x in range(-42, 43)]
    b += c.path(pts, "#fffaf2", 5, 'opacity=".8"')
    b += floor_sheen(c, 1.4, 5.2, 2.6, .7)
    if roller:
        # Stachelwalze mit Stiel
        rx, rz = 1.2, 3.4
        a = c.p(rx - .3, .06, rz); bb = c.p(rx + .3, .06, rz)
        s = c.scale(rz)
        b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s"/>' % (a[0], a[1] - .06 * s, bb[0] - a[0], .12 * s, .05 * s, INK3)
        for k in range(14):
            xx = a[0] + (bb[0] - a[0]) * k / 13
            b += '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2"/>' % (xx, a[1] - .1 * s, xx, a[1] + .1 * s, ACC)
        b += c.line((rx, .06, rz), (rx + .5, 1.5, rz - 1.2), "#8d9296", max(3, .03 * s))
    else:
        # Schlauch, der von rechts hereinkommt
        hose = [(4.4, 0.3, 2.4), (3.2, 0.08, 3.6), (2.3, 0.05, 5.2), (1.8, 0.05, 6.4)]
        b += c.path(hose, "#1b1f23", 26)
        b += c.path(hose, "#3b434b", 18)
        sx, sy = c.p(1.8, 0.05, 6.4)
        b += '<ellipse cx="%.1f" cy="%.1f" rx="70" ry="16" fill="#fffaf2" opacity=".75" filter="url(#blur)"/>' % (sx - 20, sy + 6)
        b += '<rect x="%.1f" y="%.1f" width="24" height="16" rx="4" fill="%s"/>' % (sx - 12, sy - 8, ACC)
    return svg(W, H, b, g)


def m_zement(W, H, look=-0.2):
    c = Cam(W, H, look_x=look, hor=0.42)
    b, g = room(c, "hell", W, H, window="right")
    rnd = random.Random(7)
    # erdfeuchter Estrich: körnige Fläche
    b += c.poly([(-4.2, 0.01, 0.6), (4.2, 0.01, 0.6), (4.2, 0.01, 7), (-4.2, 0.01, 6)], "#b7b0a5")
    for _ in range(900):
        x, z = rnd.uniform(-4, 4), rnd.uniform(0.8, 6.5)
        sx, sy = c.p(x, 0.012, z)
        r = rnd.uniform(.006, .02) * c.scale(z)
        b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" opacity=".5"/>' % (sx, sy, r, rnd.choice(["#8e877c", "#d4cec4", "#a29a8e"]))
    # Haufen
    hx, hy = c.p(-1.5, 0, 6.6)
    s = c.scale(6.6)
    b += '<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f Z" fill="#a39b8f"/>' % (hx - 1.6 * s, hy, hx, hy - 1.0 * s, hx + 1.6 * s, hy)
    # Estrichpumpe (Mischer)
    mx, my = c.p(2.4, 0, 6.2)
    s = c.scale(6.2)
    b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#000" opacity=".25" filter="url(#blur)"/>' % (mx, my, 1.3 * s, .2 * s)
    b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s"/>' % (mx - s, my - .95 * s, 2 * s, .75 * s, .08 * s, ACC)
    b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (mx - s, my - .45 * s, 2 * s, .08 * s, ACCD)
    b += '<path d="M%.1f %.1f l%.1f %.1f l%.1f 0 l%.1f %.1f z" fill="#5b6166"/>' % (mx - .7 * s, my - .95 * s, .15 * s, -.45 * s, 1.1 * s, .15 * s, .45 * s)
    for wx in (-.7, .7):
        b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#1b1f23"/><circle cx="%.1f" cy="%.1f" r="%.1f" fill="#6b7279"/>' % (mx + wx * s, my - .18 * s, .2 * s, mx + wx * s, my - .18 * s, .08 * s)
    hose = [(1.4, 0.2, 6.2), (0.4, 0.05, 5), (-0.6, 0.05, 3.4), (-2.4, 0.05, 2.6)]
    b += c.path(hose, INK, 22)
    b += c.path(hose, INK3, 14)
    b += bucket(c, -3.2, 4.2, "#b9b3a9")
    return svg(W, H, b, g)


def m_glaetter(W, H, look=-0.2):
    c = Cam(W, H, look_x=look, hor=0.4)
    b, g = room(c, "hell", W, H)
    b += screed_lines(c, -4, 4, 1, 11, 20, op=.05)
    # Kreisspuren
    for k, (x, z) in enumerate([(-2.6, 3.2), (-1.2, 4.6), (0.1, 3.4), (2.6, 5.6), (-2.9, 6.6)]):
        pts = [(x + 0.8 * math.cos(t / 20 * math.pi * 2), 0.006, z + 0.8 * math.sin(t / 20 * math.pi * 2)) for t in range(21)]
        b += c.path(pts, "#fff", 3, 'opacity=".22"')
    b += floor_sheen(c, 1.0, 4.4, 2.6, .5)
    # Flügelglätter
    x, z = 1.3, 3.9
    pts = [(x + 0.62 * math.cos(t / 30 * math.pi * 2), 0.06, z + 0.62 * math.sin(t / 30 * math.pi * 2)) for t in range(31)]
    b += c.poly([(p[0], 0, p[2] + .05) for p in pts], "#000", 'opacity=".22" filter="url(#blur)"')
    b += c.poly(pts, "#8a8f93")
    b += c.poly([(p[0], 0.2, p[2]) for p in pts], "#b7bbbe")
    for a in range(4):
        t = a * math.pi / 2 + .4
        b += c.line((x, .21, z), (x + .58 * math.cos(t), .21, z + .58 * math.sin(t)), "#5b6166", 6)
    b += c.poly([(x - .22, .2, z - .2), (x + .22, .2, z - .2), (x + .22, .55, z), (x - .22, .55, z)], ACC)
    b += c.line((x, .5, z), (x - .5, 1.15, z - 1.4), "#5b6166", 9)
    b += c.line((x - .75, 1.15, z - 1.4), (x - .25, 1.15, z - 1.4), INK3, 12)
    return svg(W, H, b, g)


def m_trocken(W, H, look=-0.1):
    c = Cam(W, H, eye=(0, 1.6, 0), look_x=look, hor=0.34, tilt=0.12)
    b, g = room(c, "hell", W, H, depth=9)
    # Elemente-Raster (versetzt), teilweise verlegt
    for r in range(0, 14):
        z1 = 0.8 + r * 0.6
        off = 0.6 if r % 2 else 0
        for k in range(-5, 5):
            x1 = k * 1.2 + off
            if r > 9 and x1 > 0.5:
                continue
            col = "#d8cbb8" if (k + r) % 3 else "#d2c4b0"
            b += c.poly([(x1, 0.025, z1), (x1 + 1.18, 0.025, z1), (x1 + 1.18, 0.025, z1 + 0.58), (x1, 0.025, z1 + 0.58)], col)
            for sx_, sz_ in ((0.1, 0.1), (1.08, 0.1), (0.1, 0.48), (1.08, 0.48)):
                px, py = c.p(x1 + sx_, 0.027, z1 + sz_)
                b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#7b7468"/>' % (px, py, max(1, 0.012 * c.scale(z1)))
    # Stapel Platten + Akkuschrauber
    sx, sy = c.p(2.6, 0, 6.8)
    s = c.scale(6.8)
    for i in range(6):
        b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" stroke="#b5a88f" stroke-width="1"/>' % (sx - .7 * s, sy - (i + 1) * .045 * s, 1.4 * s, .045 * s, "#dccfbb")
    dx, dy = c.p(-0.4, 0.03, 2.4)
    s = c.scale(2.4)
    b += '<g transform="translate(%.1f %.1f) rotate(-18)"><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s"/><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s"/><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#1b1f23"/><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#9aa0a5"/></g>' % (
        dx, dy, -.15 * s, -.07 * s, .3 * s, .1 * s, .03 * s, ACC, -.05 * s, -.0 * s, .07 * s, .14 * s, .02 * s, INK2, -.07 * s, .13 * s, .11 * s, .06 * s, .01 * s, .15 * s, -.04 * s, .12 * s, .015 * s)
    return svg(W, H, b, g)


def m_halle(W, H, mood="dunkel", look=-0.25, drain=True):
    c = Cam(W, H, eye=(0, 1.7, 0), look_x=look, hor=0.45)
    m = MOODS[mood]
    g = {"fl": ("0", "0", "0", "1", [(0, m["floor"][0], 1), (1, m["floor"][1], 1)]),
         "bk": ("0", "0", "0", "1", [(0, m["back"], 1), (1, m["wall"], 1)]),
         "sky": ("0", "0", "0", "1", [(0, m["sky"], 1), (1, m["light"], 1)]),
         "beam": ("0", "0", "1", "1", [(0, m["light"], .5), (1, m["light"], 0)])}
    b = '<rect width="%d" height="%d" fill="%s"/>' % (W, H, m["ceil"])
    D, X, Hh = 40, 14, 7
    b += c.poly([(-X, 0, D), (X, 0, D), (X, Hh, D), (-X, Hh, D)], "url(#bk)")
    for k in range(-5, 6):  # Oberlichter
        b += c.poly([(k * 2.4 - .8, Hh, D - .1), (k * 2.4 + .8, Hh, D - .1), (k * 2.4 + .8, Hh - 2.2, D - .1), (k * 2.4 - .8, Hh - 2.2, D - .1)], "url(#sky)", 'opacity=".9"')
    b += c.poly([(-X, 0, 0.8), (X, 0, 0.8), (X, 0, D), (-X, 0, D)], "url(#fl)")
    for z in range(4, 40, 6):  # Stützen
        for x in (-6, 6):
            b += c.poly([(x - .2, 0, z), (x + .2, 0, z), (x + .2, Hh, z), (x - .2, Hh, z)], "#20252a" if mood == "dunkel" else "#9aa1a6")
    for z in range(2, 40, 3):  # Fugen
        b += c.line((-X, 0.01, z), (X, 0.01, z), "#000", 1.2, 'opacity=".25"')
    for x in range(-12, 13, 3):
        b += c.line((x, 0.01, 0.8), (x, 0.01, D), "#000", 1.2, 'opacity=".25"')
    b += c.poly([(-4, 0.005, 18), (4, 0.005, 18), (7, 0.005, 4), (-7, 0.005, 4)], "url(#beam)", 'opacity=".5"')
    if drain:
        # Gefälle-Linien zur Rinne
        for k in range(1, 6):
            r = k * .55
            pts = [(1.6 + r * math.cos(t / 24 * math.pi * 2), 0.01, 4.5 + r * .7 * math.sin(t / 24 * math.pi * 2)) for t in range(25)]
            b += c.path(pts, ACC, 1.6, 'opacity="%.2f"' % (.55 - k * .08))
        b += c.poly([(1.1, 0.012, 4.2), (2.1, 0.012, 4.2), (2.1, 0.012, 4.8), (1.1, 0.012, 4.8)], "#15191c")
        for k in range(7):
            xx = 1.15 + k * .14
            b += c.line((xx, 0.014, 4.25), (xx, 0.014, 4.75), "#8d9296", 2)
    return svg(W, H, b, g)


def m_risse(W, H, look=-0.2, mood="hell"):
    c = Cam(W, H, eye=(0, 1.6, 0), look_x=look, hor=0.28, tilt=0.22)
    b, g = room(c, mood, W, H, depth=8)
    rnd = random.Random(11)
    b += c.poly([(-4.2, 0.005, 0.6), (4.2, 0.005, 0.6), (4.2, 0.005, 8), (-4.2, 0.005, 8)], "#9c958a", 'opacity=".55"')
    for _ in range(26):  # Flecken
        x, z = rnd.uniform(-3.8, 3.8), rnd.uniform(1, 7.5)
        sx, sy = c.p(x, 0.01, z)
        r = rnd.uniform(.2, .7) * c.scale(z)
        b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="%s" opacity=".35" filter="url(#blur)"/>' % (sx, sy, r, r * .3, rnd.choice(["#6a645b", "#857e73", "#5b564f"]))
    for _ in range(9):  # Risse
        x, z = rnd.uniform(-3.5, 3.5), rnd.uniform(1, 7)
        pts = [(x, 0.012, z)]
        ang = rnd.uniform(0, math.pi * 2)
        for k in range(rnd.randint(8, 16)):
            ang += rnd.uniform(-.7, .7)
            x += .22 * math.cos(ang); z += .22 * math.sin(ang)
            pts.append((x, 0.012, z))
        b += c.path(pts, "#2a2622", 3.2, 'opacity=".85"')
        b += c.path(pts, "#e8e2d8", 1, 'opacity=".35" transform="translate(1.5 1.5)"')
    # ausgebrochene Stelle
    hx, hy = c.p(1.4, 0.01, 3)
    s = c.scale(3)
    b += '<path d="M%.1f %.1f l%.1f %.1f l%.1f %.1f l%.1f %.1f l%.1f %.1f z" fill="#4a453f"/>' % (hx, hy, .5 * s, -.06 * s, .2 * s, .12 * s, -.3 * s, .1 * s, -.45 * s, -.04 * s)
    return svg(W, H, b, g)


def m_planken(W, H, look=-0.1, hands=True):
    c = Cam(W, H, eye=(0, 1.5, 0), look_x=look, hor=0.3, tilt=0.2)
    b, g = room(c, "warm", W, H, depth=8)
    rnd = random.Random(5)
    woods = ["#c9a985", "#bf9c76", "#d3b693", "#b8936b", "#c5a27c"]
    row = 0
    z = 0.7
    while z < 8:
        off = rnd.uniform(0, 1.2)
        x = -4.2 - off
        limit = 4.2 if z > 3.2 else rnd.uniform(-1.5, 1.5) + (z - 0.7) * 1.4
        while x < limit:
            L = rnd.uniform(1.1, 1.3)
            col = rnd.choice(woods)
            x2 = min(x + L, 4.2)
            b += c.poly([(max(x, -4.2), 0.02, z), (x2, 0.02, z), (x2, 0.02, z + .2), (max(x, -4.2), 0.02, z + .2)], col)
            for k in range(3):
                zz = z + .05 + k * .05
                b += c.line((max(x, -4.2) + .05, 0.021, zz), (x2 - .05, 0.021, zz + rnd.uniform(-.01, .01)), "#8b6a48", 1, 'opacity=".25"')
            b += c.line((x2, 0.021, z), (x2, 0.021, z + .2), "#6f5235", 1.2, 'opacity=".5"')
            x += L
        b += c.line((-4.2, 0.021, z), (4.2, 0.021, z), "#6f5235", 1.1, 'opacity=".45"')
        z += .2
        row += 1
    b += floor_sheen(c, -1, 5.5, 3, .3)
    if hands:
        # lose Planke + Andrückrolle + Hände (angeschnitten)
        b += c.poly([(0.2, 0.035, 1.6), (1.5, 0.035, 1.5), (1.5, 0.035, 1.7), (0.2, 0.035, 1.8)], "#d3b693")
        hx, hy = c.p(0.9, 0.05, 1.65)
        s = c.scale(1.65)
        b += '<path d="M%.1f %.1f q%.1f %.1f %.1f %.1f l%.1f %.1f q%.1f %.1f %.1f %.1f z" fill="#c08d6a"/>' % (hx - .1 * s, hy - .02 * s, .1 * s, -.07 * s, .25 * s, -.03 * s, .2 * s, .5 * s, -.1 * s, .05 * s, -.35 * s, -.03 * s)
        b += '<path d="M%.1f %.1f l%.1f %.1f l%.1f %.1f l%.1f %.1f z" fill="%s"/>' % (hx + .05 * s, hy + .3 * s, .3 * s, .4 * s, .28 * s, -.05 * s, -.25 * s, -.38 * s, INK2)
    return svg(W, H, b, g)


def m_rohr_spirale(W, H):
    g = {"bg": ("0", "0", "1", "1", [(0, "#d5dbe2", 1), (1, "#9aa6b4", 1)]),
         "pipe": ("0", "0", "0", "1", [(0, "#e8ecf0", 1), (.5, "#b7c0ca", 1), (1, "#7d8894", 1)])}
    b = '<rect width="%d" height="%d" fill="url(#bg)"/>' % (W, H)
    cy = H * .55
    # Rohr (Schnitt) quer
    b += '<rect x="0" y="%.1f" width="%d" height="%.1f" fill="url(#pipe)"/>' % (cy - H * .2, W, H * .4)
    b += '<rect x="0" y="%.1f" width="%d" height="%.1f" fill="#3b434b" opacity=".85"/>' % (cy - H * .16, W, H * .32)
    # Ablagerung
    b += '<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f L%.1f %.1f Z" fill="#6b5a45"/>' % (W * .62, cy + H * .16, W * .72, cy - H * .1, W * .86, cy + H * .16, W * .62, cy + H * .16)
    # Spirale
    pts = []
    for i in range(0, 400):
        t = i / 400
        x = -20 + t * W * .74
        y = cy + math.sin(t * 60) * H * .07
        pts.append("%.1f %.1f" % (x, y))
    b += '<path d="M%s" fill="none" stroke="%s" stroke-width="%.1f" stroke-linecap="round"/>' % (" L".join(pts), "#c7cdd3", H * .022)
    b += '<path d="M%s" fill="none" stroke="%s" stroke-width="%.1f" opacity=".6"/>' % (" L".join(pts), "#ffffff", H * .006)
    # Kopf der Spirale
    hx = W * .72
    b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (hx, cy, H * .06, BLUE)
    for a in range(8):
        t = a * math.pi / 4
        b += '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#dfe6ee" stroke-width="%.1f" stroke-linecap="round"/>' % (hx, cy, hx + math.cos(t) * H * .1, cy + math.sin(t) * H * .1, H * .012)
    b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="url(#glowB)"/>' % (hx, cy, W * .18, H * .2)
    # Handschuh
    b += '<path d="M%.1f %.1f q%.1f %.1f %.1f %.1f l%.1f %.1f q%.1f %.1f %.1f %.1f z" fill="%s"/>' % (W * .06, cy - H * .38, W * .05, -H * .03, W * .12, H * .02, -W * .02, H * .18, -W * .06, H * .02, -W * .12, -H * .02, BLUED)
    return svg(W, H, b, g)


def m_kanal(W, H):
    g = {}
    b = '<rect width="%d" height="%d" fill="#0d1116"/>' % (W, H)
    cx, cy = W * .56, H * .5
    for i in range(30, 0, -1):
        r = (i / 30) ** 2.2 * max(W, H) * .75
        shade = int(18 + (30 - i) * 2.2)
        col = "#%02x%02x%02x" % (min(shade + 10, 90), min(shade + 22, 110), min(shade + 40, 150))
        b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (cx, cy, r, col)
        if i % 3 == 0:  # Muffen
            b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="#9cc3f5" stroke-opacity=".18" stroke-width="%.1f"/>' % (cx, cy, r, max(1, r * .02))
    # Wasserrinne unten
    b += '<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f L%.1f %.1f Q%.1f %.1f %.1f %.1f Z" fill="%s" opacity=".55"/>' % (
        cx - W * .5, H, cx, H * .78, cx + W * .5, H, cx + W * .02, cy + 12, cx, cy + 8, cx - W * .02, cy + 12, BLUED)
    b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="url(#glowB)"/>' % (cx, cy, W * .5, H * .5)
    # Wurzeleinwuchs / Ablagerung
    b += '<path d="M%.1f %.1f q%.1f %.1f %.1f %.1f q%.1f %.1f %.1f %.1f" stroke="#8a7257" stroke-width="5" fill="none" opacity=".8"/>' % (cx + 60, cy - 70, 20, 30, 10, 60, -10, 20, 25, 40)
    # Monitor-Rahmen (ohne Schrift)
    b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#e6effb" stroke-opacity=".35" stroke-width="3"/>' % (W * .04, H * .06, W * .92, H * .88)
    for (x, y) in ((W * .04, H * .06), (W * .96, H * .06), (W * .04, H * .94), (W * .96, H * .94)):
        pass
    b += '<circle cx="%.1f" cy="%.1f" r="10" fill="%s"/>' % (W * .08, H * .11, RED)
    b += '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e6effb" stroke-opacity=".5" stroke-width="2"/><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e6effb" stroke-opacity=".5" stroke-width="2"/>' % (cx - 30, cy, cx + 30, cy, cx, cy - 30, cx, cy + 30)
    return svg(W, H, b, g)


def m_schacht(W, H, mood="dunkel", person_on=True, look=-0.4):
    c = Cam(W, H, eye=(0, 1.6, 0), look_x=look, hor=0.48)
    m = MOODS[mood]
    g = {"sky": ("0", "0", "0", "1", [(0, "#1b2a40" if mood == "dunkel" else "#9fb6d0", 1), (.7, "#36557d" if mood == "dunkel" else "#d5dfea", 1), (1, "#5b7aa3" if mood == "dunkel" else "#e6effb", 1)]),
         "road": ("0", "0", "0", "1", [(0, "#3b434b", 1), (1, "#15191c", 1)])}
    b = '<rect width="%d" height="%.1f" fill="url(#sky)"/>' % (W, H * .5)
    # Häuser-Silhouetten
    rnd = random.Random(2)
    x = 0
    while x < W:
        w = rnd.uniform(.08, .16) * W
        h = rnd.uniform(.08, .2) * H
        b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (x, H * .48 - h, w, h + 2, "#1d2731" if mood == "dunkel" else "#8d9cad")
        b += '<path d="M%.1f %.1f l%.1f %.1f l%.1f %.1f z" fill="%s"/>' % (x, H * .48 - h, w / 2, -h * .35, w / 2, h * .35, "#1d2731" if mood == "dunkel" else "#8d9cad")
        if mood == "dunkel" and rnd.random() > .4:
            b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#f3b878" opacity=".75"/>' % (x + w * .3, H * .48 - h * .6, w * .15, h * .18)
        x += w + rnd.uniform(4, 30)
    b += c.poly([(-30, 0, 1), (30, 0, 1), (30, 0, 60), (-30, 0, 60)], "url(#road)")
    b += c.line((-0.1, 0.005, 2), (-0.1, 0.005, 60), "#e9e4da", 6, 'stroke-dasharray="60 60" opacity=".6"')
    # Schacht
    sx, sz = 1.6, 4.2
    pts = [(sx + .45 * math.cos(t / 30 * math.pi * 2), 0.01, sz + .45 * math.sin(t / 30 * math.pi * 2)) for t in range(31)]
    b += c.poly(pts, "#6b7279")
    pts2 = [(sx + .36 * math.cos(t / 30 * math.pi * 2), 0.012, sz + .36 * math.sin(t / 30 * math.pi * 2)) for t in range(31)]
    b += c.poly(pts2, "#06080a")
    px, py = c.p(sx, 0, sz)
    b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="url(#glowB)" opacity=".9"/>' % (px, py, 120, 40)
    # Deckel daneben
    pts3 = [(sx + 1.0 + .4 * math.cos(t / 30 * math.pi * 2), 0.02, sz - .5 + .4 * math.sin(t / 30 * math.pi * 2)) for t in range(31)]
    b += c.poly(pts3, "#4a5056")
    # Schlauch/Spirale vom Schacht
    hose = [(sx, 0.05, sz), (sx + .8, 0.05, sz - 1.2), (sx + 2.4, 0.05, sz - 1.6), (sx + 3.4, 0.3, sz - 1.4)]
    b += c.path(hose, BLUE, 12)
    # Warnleuchte
    lx, ly = c.p(sx - 1.1, 0, sz + .4)
    s = c.scale(sz + .4)
    b += '<path d="M%.1f %.1f l%.1f %.1f l%.1f 0 z" fill="%s"/>' % (lx - .15 * s, ly, .15 * s, -.5 * s, .15 * s, "#d0d4d8")
    b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="url(#glowR)"/>' % (lx, ly - .55 * s, .35 * s)
    if person_on:
        b += person(c, sx + .75, sz - .2, tone="#1e2833", accent=BLUE, pose="schacht", rim="#9cc3f5")
    return svg(W, H, b, g)


def m_keller(W, H):
    c = Cam(W, H, look_x=-0.3, hor=0.45)
    b, g = room(c, "nacht", W, H, depth=7, xw=3, ch=2.3, window="back")
    # Rohre an der Wand
    for y, col in ((1.9, "#596370"), (1.7, "#4c5560")):
        b += c.line((-3, y, 6.9), (3, y, 6.9), col, 14)
    b += c.line((2.2, 0, 6.9), (2.2, 1.9, 6.9), "#596370", 16)
    # Wasserlache
    b += c.poly([(-0.5, 0.005, 3.5), (2.5, 0.005, 3), (2.8, 0.005, 5.5), (0, 0.005, 6)], "#3a6aa8", 'opacity=".35"')
    # Stirnlampen-Kegel
    a = c.p(-0.6, 1.5, 1.6)
    b += '<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="url(#glowB)" opacity=".9"/>' % (a[0], a[1], W * .95, H * .55, W * .7, H * .95)
    b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="url(#glowB)"/>' % (W * .78, H * .7, W * .22, H * .12)
    # Werkzeugkoffer
    kx, ky = c.p(1.4, 0, 3.2)
    s = c.scale(3.2)
    b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s"/>' % (kx - .35 * s, ky - .3 * s, .7 * s, .3 * s, .03 * s, BLUED)
    b += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="none" stroke="#9cc3f5" stroke-width="3"/>' % (kx - .1 * s, ky - .38 * s, .2 * s, .1 * s, .03 * s)
    # rote Warnleuchte klein
    rx, ry = c.p(-2.4, 0.3, 5.8)
    b += '<circle cx="%.1f" cy="%.1f" r="40" fill="url(#glowR)"/><circle cx="%.1f" cy="%.1f" r="7" fill="%s"/>' % (rx, ry, rx, ry, RED)
    b += person(c, -0.8, 2.6, tone="#1e2833", accent=BLUE, pose="knien", rim="#9cc3f5")
    return svg(W, H, b, g)


def m_hebeanlage(W, H):
    c = Cam(W, H, look_x=-0.2, hor=0.45)
    b, g = room(c, "blau", W, H, depth=7, xw=3.2, ch=2.6, window="right")
    # Tank
    tx, tz = 0.9, 4.2
    pts = [(tx - .8, 0, tz), (tx + .8, 0, tz), (tx + .8, 1.1, tz), (tx - .8, 1.1, tz)]
    b += c.poly([(p[0] + .1, 0, p[2] + .3) for p in pts[:2]] + [(tx + .9, 0, tz + .6), (tx - .7, 0, tz + .6)], "#000", 'opacity=".2" filter="url(#blur)"')
    b += c.poly(pts, "#e8ecf0")
    b += c.poly([(tx - .8, 1.1, tz), (tx + .8, 1.1, tz), (tx + .8, 1.1, tz + .8), (tx - .8, 1.1, tz + .8)], "#f4f6f8")
    b += c.poly([(tx + .8, 0, tz), (tx + .8, 0, tz + .8), (tx + .8, 1.1, tz + .8), (tx + .8, 1.1, tz)], "#c9d0d8")
    b += c.poly([(tx - .2, 1.1, tz + .2), (tx + .4, 1.1, tz + .2), (tx + .4, 1.45, tz + .2), (tx - .2, 1.45, tz + .2)], BLUE)
    # Rohre
    b += c.line((tx + .2, 1.45, tz + .4), (tx + .2, 2.3, tz + .4), "#6b7279", 16)
    b += c.line((tx + .2, 2.3, tz + .4), (3.2, 2.3, tz + .4), "#6b7279", 16)
    b += c.line((-3.2, .5, tz + .4), (tx - .8, .5, tz + .4), "#8d9296", 18)
    # Schaltkasten
    b += c.poly([(-2.6, 1.2, 6.98), (-1.8, 1.2, 6.98), (-1.8, 1.9, 6.98), (-2.6, 1.9, 6.98)], "#f4f6f8")
    lx, ly = c.p(-2.2, 1.6, 6.97)
    b += '<circle cx="%.1f" cy="%.1f" r="5" fill="#1f9d55"/>' % (lx, ly)
    # Revisionsschacht im Boden
    b += c.poly([(-1.8, 0.01, 2.2), (-0.8, 0.01, 2.2), (-0.8, 0.01, 3.0), (-1.8, 0.01, 3.0)], "#7b858f")
    for k in range(6):
        b += c.line((-1.75 + k * .18, 0.012, 2.25), (-1.75 + k * .18, 0.012, 2.95), "#4c5560", 2)
    return svg(W, H, b, g)


def tisch(W, H, kind):
    """Werkzeug-Stillleben von oben auf Estrich."""
    base = "#d6d1c8" if kind != "rohr" else "#c9d0d8"
    g = {"tb": ("0", "0", "1", "1", [(0, "#ece8e1" if kind != "rohr" else "#e1e6ec", 1), (1, base, 1)])}
    b = '<rect width="%d" height="%d" fill="url(#tb)"/>' % (W, H)
    rnd = random.Random(9)
    for _ in range(500):
        b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#8d877d" opacity=".12"/>' % (rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(1, 3))
    sh = 'filter="url(#blur)" opacity=".28"'

    def rect(x, y, w, h, col, rot=0, rx=6):
        return ('<g transform="rotate(%s %.1f %.1f)"><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%s" fill="#000" %s transform="translate(14 18)"/>'
                '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%s" fill="%s"/></g>') % (rot, x + w / 2, y + h / 2, x, y, w, h, rx, sh, x, y, w, h, rx, col)
    if kind == "estrich":
        b += rect(W * .12, H * .18, W * .76, H * .07, ACC, -12, 10)            # Wasserwaage
        b += rect(W * .2, H * .2, W * .1, H * .035, "#9ad1a8", -12, 8)
        b += rect(W * .62, H * .2, W * .1, H * .035, "#9ad1a8", -12, 8)
        b += rect(W * .24, H * .46, W * .44, H * .2, "#c3c7ca", 18, 14)      # Glättkelle
        b += rect(W * .4, H * .52, W * .2, H * .06, INK2, 18, 18)
        b += rect(W * .1, H * .76, W * .7, H * .05, "#f1d35b".replace("f1d35b", "e9c46a"), 6, 3)  # Zollstock
        for k in range(10):
            b += '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#7a6a3a" stroke-width="2" transform="rotate(6 %.1f %.1f)"/>' % (W * .1 + k * W * .07, H * .76, W * .1 + k * W * .07, H * .81, W * .45, H * .785)
    elif kind == "boden":
        cols = ["#c9a985", "#b8936b", "#d3b693", "#a7845f"]
        for i, col in enumerate(cols):
            b += rect(W * .1 + i * 18, H * .14 + i * H * .1, W * .62, H * .09, col, -8 + i * 3, 4)
        b += rect(W * .6, H * .58, W * .1, H * .26, INK2, 24, 10)          # Andrückrolle Griff
        b += rect(W * .5, H * .78, W * .3, H * .07, ACC, 24, 20)
        b += rect(W * .14, H * .66, W * .3, H * .05, ACC, -30, 8)          # Cutter
        b += rect(W * .14, H * .66, W * .08, H * .05, "#c3c7ca", -30, 4)
    else:
        # Spirale aufgerollt
        cx, cy = W * .42, H * .42
        for k in range(9):
            r = W * (.08 + k * .025)
            b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="#aeb6be" stroke-width="%.1f"/>' % (cx, cy, r, W * .012)
            b += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>' % (cx, cy, r)
        b += rect(W * .6, H * .62, W * .28, H * .12, BLUED, -20, 30)         # Handschuh
        b += rect(W * .58, H * .6, W * .1, H * .08, BLUE, -20, 20)
        b += rect(W * .1, H * .78, W * .4, H * .07, INK2, 8, 12)             # Taschenlampe
        b += rect(W * .44, H * .775, W * .08, H * .08, "#c3c7ca", 8, 8)
        b += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="url(#glowB)"/>' % (W * .64, H * .86, W * .2, H * .08)
    return svg(W, H, b, g)


def m_meister(W, H):
    c = Cam(W, H, eye=(0, 1.5, 0), look_x=-0.05, hor=0.38)
    b, g = room(c, "warm", W, H, window="left")
    b += screed_lines(c, -4, 4, 1, 11, 22, op=.05)
    b += floor_sheen(c, 0, 6, 3, .4)
    b += bucket(c, -2.4, 6.5)
    b += person(c, 0.15, 2.6, pose="wasserwaage", rim="#ffd29b")
    return svg(W, H, b, g)


JOBS = {
    # name: (W, H, function)
    "hero-start":        (2400, 1350, lambda W, H: m_estrich_person(W, H, "dunkel", "latte", -0.45, 1.6, 4.4)),
    "hero-estrich":      (2400, 1350, lambda W, H: m_raum(W, H, "dunkel", -0.4, "right")),
    "hero-boden":        (2400, 1350, lambda W, H: m_planken(W, H, -0.25, hands=False)),
    "hero-rohr":         (2400, 1350, lambda W, H: m_schacht(W, H, "dunkel", True, -0.45)),
    "hero-kontakt":      (2400, 1350, lambda W, H: m_raum(W, H, "dunkel", -0.35, "back")),
    "estrich-verteilen": (1600, 1000, lambda W, H: m_estrich_person(W, H, "warm", "latte", -0.1, 0.6, 3.6)),
    "heizestrich":       (1600, 1000, lambda W, H: m_heiz(W, H)),
    "fliessestrich":     (1600, 1000, lambda W, H: m_fliess(W, H, -0.1)),
    "zementestrich":     (1600, 1000, lambda W, H: m_zement(W, H, 0)),
    "schnellestrich":    (1600, 1000, lambda W, H: m_glaetter(W, H, -0.05)),
    "trockenestrich":    (1600, 1000, lambda W, H: m_trocken(W, H)),
    "industrie":         (1600, 1000, lambda W, H: m_halle(W, H, "dunkel", -0.1)),
    "sanierung-vorher":  (1200, 1200, lambda W, H: m_risse(W, H, 0, "hell")),
    "sanierung-nachher": (1200, 1200, lambda W, H: m_raum(W, H, "warm", 0, "left")),
    "bodenverlegung":    (1600, 1000, lambda W, H: m_planken(W, H, 0, True)),
    "ausgleichsmasse":   (1600, 1000, lambda W, H: m_fliess(W, H, -0.05, roller=True)),
    "rohrreinigung":     (1600, 1000, lambda W, H: m_rohr_spirale(W, H)),
    "notdienst":         (1600, 1000, lambda W, H: m_keller(W, H)),
    "kanal-tv":          (1600, 1000, lambda W, H: m_kanal(W, H)),
    "wartung":           (1600, 1000, lambda W, H: m_hebeanlage(W, H)),
    "werkzeug-estrich":  (1200, 1300, lambda W, H: tisch(W, H, "estrich")),
    "werkzeug-boden":    (1200, 1300, lambda W, H: tisch(W, H, "boden")),
    "werkzeug-rohr":     (1200, 1300, lambda W, H: tisch(W, H, "rohr")),
    "meister":           (1200, 1300, lambda W, H: m_meister(W, H)),
    "ref-neubau":        (1200, 900, lambda W, H: m_heiz(W, H, 0.05)),
    "ref-sanierung":     (1200, 900, lambda W, H: m_risse(W, H, 0.1, "warm")),
    "ref-gewerbe":       (1200, 900, lambda W, H: m_halle(W, H, "dunkel", 0.05, False)),
    "ref-boden":         (1200, 900, lambda W, H: m_planken(W, H, 0.1, False)),
    "ref-rohr":          (1200, 900, lambda W, H: m_schacht(W, H, "hell", True, -0.1)),
}

only = sys.argv[2:] or list(JOBS)
meta = {}
for name in only:
    W, H, fn = JOBS[name]
    with open(os.path.join(OUT, name + ".svg"), "w") as f:
        f.write(fn(W, H))
    meta[name] = (W, H)
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"))
print(len(meta), "SVGs")
