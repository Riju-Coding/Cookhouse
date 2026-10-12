import os
import sys
import argparse
import io
import fitz # PyMuPDF
import qrcode
import qrcode.image.svg

def get_qr_svg_path(url, width=320, height=320):
    """Generate SVG path elements for the QR code"""
    factory = qrcode.image.svg.SvgPathImage
    qr = qrcode.QRCode(
        box_size=10,
        border=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(image_factory=factory)
    
    # img is an SvgPathImage. Let's get the svg XML
    stream = io.BytesIO()
    img.save(stream)
    svg_str = stream.getvalue().decode("utf-8")
    
    # Extract path
    start_path = svg_str.find("<path")
    end_path = svg_str.rfind("/>")
    if start_path != -1 and end_path != -1:
        path_tag = svg_str[start_path:end_path+2]
        # Modify path fill to #0f172a
        path_tag = path_tag.replace('fill="#000000"', 'fill="#0f172a"').replace('fill="black"', 'fill="#0f172a"')
        
        # Get viewBox
        vb_start = svg_str.find('viewBox="')
        if vb_start != -1:
            vb_end = svg_str.find('"', vb_start + 9)
            vb = svg_str[vb_start + 9:vb_end]
        else:
            vb = "0 0 100 100"
            
        return f'<svg viewBox="{vb}" width="{width}" height="{height}">{path_tag}</svg>'
    return ""

def load_cookhouse_logo(logo_path):
    if not os.path.exists(logo_path):
        # Fallback SVG logo
        return """
        <g>
          <text x="0" y="45" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#0f172a">cookhouse</text>
        </g>
        """, """
        <g>
          <text x="0" y="45" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#ffffff">cookhouse</text>
        </g>
        """
    with open(logo_path, "r", encoding="utf-8") as f:
        logo_content = f.read()
    start_g = logo_content.find('<g inkscape:groupmode="layer"')
    end_g = logo_content.rfind('</svg>')
    inner_logo = logo_content[start_g:end_g] if start_g != -1 else ""
    inner_logo_white = inner_logo.replace('fill="#231f20"', 'fill="#ffffff"')
    return inner_logo, inner_logo_white

def generate_criss_cross_standee_svg(url, company, building, cafe, logo_path):
    inner_logo, inner_logo_white = load_cookhouse_logo(logo_path)
    qr_svg_small = get_qr_svg_path(url, width=130, height=130)
    qr_svg_hero = get_qr_svg_path(url, width=370, height=370)

    site_badge = f"{company.upper()} • {building.upper()} • {cafe.upper()}"
    
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="2160" height="5184" viewBox="0 0 2160 5184">
  <defs>
    <!-- Gradients -->
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="12%" stop-color="#f8fafc" />
      <stop offset="35%" stop-color="#f0fdf4" />
      <stop offset="70%" stop-color="#f8fafc" />
      <stop offset="90%" stop-color="#eff6ff" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>

    <linearGradient id="header-accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="35%" stop-color="#10b981" />
      <stop offset="70%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>

    <linearGradient id="step1-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>

    <linearGradient id="step2-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#4f46e5" />
    </linearGradient>

    <linearGradient id="step3-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#c2410c" />
    </linearGradient>

    <linearGradient id="step4-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>

    <linearGradient id="step5-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>

    <linearGradient id="footer-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>

    <filter id="shadow-card" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#0f172a" flood-opacity="0.08" />
    </filter>

    <filter id="shadow-glow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="15" flood-color="#059669" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- BACKGROUND CANVAS (6x2.5 ft @ 72pt/in = 2160x5184) -->
  <rect width="2160" height="5184" fill="#f8fafc" />

  <!-- Ambient Grid -->
  <g opacity="0.04" stroke="#0f172a" stroke-width="2">
    <line x1="180" y1="0" x2="180" y2="5184" />
    <line x1="540" y1="0" x2="540" y2="5184" />
    <line x1="1080" y1="0" x2="1080" y2="5184" />
    <line x1="1620" y1="0" x2="1620" y2="5184" />
    <line x1="1980" y1="0" x2="1980" y2="5184" />
    <line x1="0" y1="800" x2="2160" y2="800" />
    <line x1="0" y1="1600" x2="2160" y2="1600" />
    <line x1="0" y1="2400" x2="2160" y2="2400" />
    <line x1="0" y1="3200" x2="2160" y2="3200" />
    <line x1="0" y1="4000" x2="2160" y2="4000" />
  </g>

  <!-- Top Accent Bar -->
  <rect x="0" y="0" width="2160" height="24" fill="#059669" />

  <!-- ============================================== -->
  <!-- HEADER & HERO BANNER (y: 60 - 820) -->
  <!-- ============================================== -->
  <g transform="translate(628, 90) scale(3.2)">
    {inner_logo}
  </g>

  <!-- Location / Building Pill Badge -->
  <rect x="440" y="380" width="1280" height="64" rx="32" fill="#ecfdf5" stroke="#10b981" stroke-width="3" />
  <text x="1080" y="423" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#047857" text-anchor="middle" letter-spacing="3">
    📍 {site_badge}
  </text>

  <!-- Main Headline -->
  <text x="1080" y="530" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="-1">
    CLOSED-LOOP DINING EXPERIENCE
  </text>

  <!-- Subtitle -->
  <text x="1080" y="615" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="800" fill="#059669" text-anchor="middle">
    Your Feedback. Instant Action. Guaranteed Resolution.
  </text>

  <!-- Description paragraph -->
  <text x="1080" y="685" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500" fill="#475569" text-anchor="middle">
    Scan the QR code at your table to rate today's dishes, request housekeeping, or report facility issues.
  </text>
  <text x="1080" y="730" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#1e293b" text-anchor="middle">
    Our operations team resolves complaints on-ground with mandatory photo proof in real time.
  </text>

  <line x1="360" y1="785" x2="1800" y2="785" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" />

  <!-- ============================================== -->
  <!-- CRISS-CROSS ZIGZAG CONNECTING PATHWAY -->
  <!-- ============================================== -->
  <path d="M 440 1200
           C 440 1480, 1720 1520, 1720 1850
           C 1720 2180, 440 2220, 440 2550
           C 440 2880, 1720 2920, 1720 3250
           C 1720 3580, 440 3620, 440 3950"
        fill="none" stroke="#cbd5e1" stroke-width="12" stroke-dasharray="24 16" />

  <path d="M 440 1200
           C 440 1480, 1720 1520, 1720 1850
           C 1720 2180, 440 2220, 440 2550
           C 440 2880, 1720 2920, 1720 3250
           C 1720 3580, 440 3620, 440 3950"
        fill="none" stroke="#10b981" stroke-width="4" opacity="0.7" />

  <!-- ============================================== -->
  <!-- STEP 1: LEFT CARD (y: 870 - 1510) -->
  <!-- ============================================== -->
  <circle cx="440" cy="1200" r="48" fill="#059669" filter="url(#shadow-glow)" />
  <circle cx="440" cy="1200" r="32" fill="#ffffff" />
  <text x="440" y="1212" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#047857" text-anchor="middle">1</text>

  <g filter="url(#shadow-card)">
    <rect x="220" y="870" width="1440" height="590" rx="36" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" />
    <rect x="220" y="870" width="28" height="590" rx="14" fill="#059669" />
  </g>

  <g transform="translate(280, 920)">
    <rect x="0" y="0" width="320" height="46" rx="23" fill="#ecfdf5" stroke="#10b981" stroke-width="2.5" />
    <text x="160" y="32" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#047857" text-anchor="middle" letter-spacing="2">
      STEP 01 • AT YOUR TABLE
    </text>

    <text x="0" y="105" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#0f172a">
      Scan Tabletop QR Code
    </text>
    <text x="0" y="150" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#059669">
      Instant Camera Scan • Zero App Download • Zero Login
    </text>

    <text x="0" y="210" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="500" fill="#334155">
      Every dining table features an acrylic QR standee linked directly to {cafe} in {building}.
    </text>

    <g transform="translate(0, 245)">
      <circle cx="20" cy="24" r="14" fill="#dcfce7" />
      <text x="20" y="31" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#047857" text-anchor="middle">✓</text>
      <text x="50" y="32" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Point smartphone camera at standee to launch feedback page</text>

      <circle cx="20" cy="74" r="14" fill="#dcfce7" />
      <text x="20" y="81" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#047857" text-anchor="middle">✓</text>
      <text x="50" y="82" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Auto-identifies {company} • {building} • {cafe}</text>

      <circle cx="20" cy="124" r="14" fill="#dcfce7" />
      <text x="20" y="131" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#047857" text-anchor="middle">✓</text>
      <text x="50" y="132" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Loads today's live meal menu and dish feedback in under 2 seconds</text>
    </g>

    <!-- Visual Mockup Graphic Box with REAL LIVE QR CODE -->
    <g transform="translate(860, 20)">
      <rect x="0" y="0" width="460" height="440" rx="28" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3" />
      
      <!-- Standee Graphic with live QR -->
      <rect x="140" y="35" width="180" height="235" rx="18" fill="#ffffff" stroke="#0f172a" stroke-width="5" />
      <g transform="translate(165, 55)">
        {qr_svg_small}
      </g>
      <text x="230" y="225" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" fill="#047857" text-anchor="middle">TABLE STAND</text>
      
      <!-- Phone scanning overlay -->
      <rect x="60" y="160" width="340" height="220" rx="24" fill="#0f172a" stroke="#334155" stroke-width="4" filter="url(#shadow-glow)" />
      <line x1="80" y1="260" x2="380" y2="260" stroke="#34d399" stroke-width="6" stroke-linecap="round" />
      <rect x="90" y="180" width="280" height="50" rx="14" fill="#1e293b" />
      <text x="230" y="212" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" fill="#34d399" text-anchor="middle">
        {url[:36]}...
      </text>
      <text x="230" y="340" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">
        CAMERA SCANNING...
      </text>
    </g>
  </g>

  <!-- ============================================== -->
  <!-- STEP 2: RIGHT CARD (y: 1570 - 2210) -->
  <!-- ============================================== -->
  <circle cx="1720" cy="1850" r="48" fill="#7c3aed" filter="url(#shadow-glow)" />
  <circle cx="1720" cy="1850" r="32" fill="#ffffff" />
  <text x="1720" y="1862" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#6d28d9" text-anchor="middle">2</text>

  <g filter="url(#shadow-card)">
    <rect x="500" y="1570" width="1440" height="590" rx="36" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" />
    <rect x="1912" y="1570" width="28" height="590" rx="14" fill="#7c3aed" />
  </g>

  <g transform="translate(560, 1620)">
    <g transform="translate(0, 20)">
      <rect x="0" y="0" width="460" height="440" rx="28" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3" />
      <g transform="translate(25, 30)">
        <rect x="0" y="0" width="410" height="90" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
        <text x="20" y="42" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#0f172a">1. Dal Makhani</text>
        <rect x="230" y="20" width="160" height="48" rx="24" fill="#fdf2f8" stroke="#f472b6" stroke-width="2" />
        <text x="310" y="52" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#db2777" text-anchor="middle">😍 Loved it</text>

        <rect x="0" y="105" width="410" height="90" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
        <text x="20" y="147" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#0f172a">2. Paneer Butter Masala</text>
        <rect x="250" y="125" width="140" height="48" rx="24" fill="#ecfdf5" stroke="#34d399" stroke-width="2" />
        <text x="320" y="157" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#059669" text-anchor="middle">😊 Good</text>

        <rect x="0" y="210" width="410" height="95" rx="16" fill="#fff1f2" stroke="#fecdd3" stroke-width="2.5" />
        <text x="20" y="248" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#9f1239">3. Tomato Soup</text>
        <rect x="220" y="230" width="170" height="48" rx="24" fill="#ffe4e6" stroke="#f43f5e" stroke-width="2" />
        <text x="305" y="262" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#e11d48" text-anchor="middle">👎 Needs Imp</text>
        <text x="20" y="285" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#e11d48">Remark: "Lukewarm at counter"</text>

        <g transform="translate(0, 320)">
          <rect x="0" y="0" width="200" height="46" rx="23" fill="#e0f2fe" stroke="#38bdf8" stroke-width="2" />
          <text x="100" y="30" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" fill="#0369a1" text-anchor="middle">🧼 Sanitization ✓</text>

          <rect x="210" y="0" width="200" height="46" rx="23" fill="#fef3c7" stroke="#f59e0b" stroke-width="2" />
          <text x="310" y="30" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" fill="#b45309" text-anchor="middle">🛠️ Water Cooler ✓</text>
        </g>
      </g>
    </g>

    <g transform="translate(500, 0)">
      <rect x="0" y="0" width="410" height="46" rx="23" fill="#f5f3ff" stroke="#8b5cf6" stroke-width="2.5" />
      <text x="205" y="32" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#6d28d9" text-anchor="middle" letter-spacing="2">
        STEP 02 • MULTI-AREA FEEDBACK
      </text>

      <text x="0" y="105" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#0f172a">
        Rate Food &amp; Facility
      </text>
      <text x="0" y="150" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#7c3aed">
        Dish-Level Ratings • Cleaning • Facility Maintenance
      </text>

      <text x="0" y="210" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="500" fill="#334155">
        Give comprehensive feedback on your meal and environment in a single screen.
      </text>

      <g transform="translate(0, 245)">
        <circle cx="20" cy="24" r="14" fill="#ede9fe" />
        <text x="20" y="31" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#7c3aed" text-anchor="middle">✓</text>
        <text x="50" y="32" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Rate individual dishes (Loved it, Good, Needs Improvement)</text>

        <circle cx="20" cy="74" r="14" fill="#ede9fe" />
        <text x="20" y="81" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#7c3aed" text-anchor="middle">✓</text>
        <text x="50" y="82" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Request immediate table surface sanitization or spill clearing</text>

        <circle cx="20" cy="124" r="14" fill="#ede9fe" />
        <text x="20" y="131" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#7c3aed" text-anchor="middle">✓</text>
        <text x="50" y="132" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Report maintenance issues (Water cooler temperature, AC, etc.)</text>
      </g>
    </g>
  </g>

  <!-- ============================================== -->
  <!-- STEP 3: LEFT CARD (y: 2270 - 2910) -->
  <!-- ============================================== -->
  <circle cx="440" cy="2550" r="48" fill="#ea580c" filter="url(#shadow-glow)" />
  <circle cx="440" cy="2550" r="32" fill="#ffffff" />
  <text x="440" y="2562" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#c2410c" text-anchor="middle">3</text>

  <g filter="url(#shadow-card)">
    <rect x="220" y="2270" width="1440" height="590" rx="36" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" />
    <rect x="220" y="2270" width="28" height="590" rx="14" fill="#ea580c" />
  </g>

  <g transform="translate(280, 2320)">
    <rect x="0" y="0" width="370" height="46" rx="23" fill="#fff7ed" stroke="#f97316" stroke-width="2.5" />
    <text x="185" y="32" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#c2410c" text-anchor="middle" letter-spacing="2">
      STEP 03 • INSTANT CLOUD STREAM
    </text>

    <text x="0" y="105" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#0f172a">
      Live CookHouse Dispatch
    </text>
    <text x="0" y="150" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#ea580c">
      Real-Time Admin Dashboard • Auto-Routed To Supervisors
    </text>

    <text x="0" y="210" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="500" fill="#334155">
      The moment you tap submit, your ticket streams directly into CookHouseAdmin.
    </text>

    <g transform="translate(0, 245)">
      <circle cx="20" cy="24" r="14" fill="#ffedd5" />
      <text x="20" y="31" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#ea580c" text-anchor="middle">✓</text>
      <text x="50" y="32" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Automatic ticket creation with SLA countdown timer</text>

      <circle cx="20" cy="74" r="14" fill="#ffedd5" />
      <text x="20" y="81" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#ea580c" text-anchor="middle">✓</text>
      <text x="50" y="82" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Separates tickets into Kitchen, Housekeeping &amp; Engineering queues</text>

      <circle cx="20" cy="124" r="14" fill="#ffedd5" />
      <text x="20" y="131" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#ea580c" text-anchor="middle">✓</text>
      <text x="50" y="132" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Shoots live push notifications directly to on-ground staff phones</text>
    </g>

    <!-- Visual Mockup Graphic Box with SPECIFIC LOCATION -->
    <g transform="translate(860, 20)">
      <rect x="0" y="0" width="460" height="440" rx="28" fill="#0f172a" stroke="#334155" stroke-width="3" />
      <rect x="0" y="0" width="460" height="50" rx="14" fill="#1e293b" />
      <circle cx="24" cy="25" r="7" fill="#ef4444" />
      <circle cx="48" cy="25" r="7" fill="#f59e0b" />
      <circle cx="72" cy="25" r="7" fill="#10b981" />
      <text x="230" y="32" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#94a3b8" text-anchor="middle">
        admin.cookhouse.com/ticketing
      </text>

      <rect x="25" y="70" width="410" height="75" rx="16" fill="#ffffff" stroke="#ef4444" stroke-width="2.5" />
      <text x="45" y="100" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#991b1b">🚨 NEW FEEDBACK ALERT • {cafe[:18].upper()}</text>
      <text x="45" y="128" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="#475569">Food: Tomato Soup | Housekeeping: Clean Table</text>

      <g transform="translate(25, 165)">
        <rect x="0" y="0" width="410" height="120" rx="18" fill="#1e293b" stroke="#f59e0b" stroke-width="2.5" />
        <text x="20" y="35" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#ffffff">#TK-9281 • Food Quality</text>
        <rect x="280" y="15" width="110" height="32" rx="12" fill="#fef3c7" />
        <text x="335" y="37" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" fill="#92400e" text-anchor="middle">OPEN</text>

        <text x="20" y="70" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="600" fill="#94a3b8">{company} • {building} • {cafe}</text>
        <text x="20" y="100" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#f59e0b">⏱️ SLA: 29m:40s remaining</text>
      </g>

      <rect x="25" y="310" width="410" height="100" rx="18" fill="#047857" opacity="0.25" stroke="#10b981" stroke-width="2" />
      <text x="230" y="348" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#34d399" text-anchor="middle">
        📱 PUSH SENT TO ON-GROUND SUPERVISOR
      </text>
      <text x="230" y="385" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">
        Assigned to: Floor Team at {building}
      </text>
    </g>
  </g>

  <!-- ============================================== -->
  <!-- STEP 4: RIGHT CARD (y: 2970 - 3610) -->
  <!-- ============================================== -->
  <circle cx="1720" cy="3250" r="48" fill="#0284c7" filter="url(#shadow-glow)" />
  <circle cx="1720" cy="3250" r="32" fill="#ffffff" />
  <text x="1720" y="3262" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#0369a1" text-anchor="middle">4</text>

  <g filter="url(#shadow-card)">
    <rect x="500" y="2970" width="1440" height="590" rx="36" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" />
    <rect x="1912" y="2970" width="28" height="590" rx="14" fill="#0284c7" />
  </g>

  <g transform="translate(560, 3020)">
    <g transform="translate(0, 20)">
      <rect x="0" y="0" width="460" height="440" rx="28" fill="#0f172a" stroke="#334155" stroke-width="3" />
      <rect x="25" y="25" width="410" height="60" rx="16" fill="#1e293b" />
      <text x="230" y="62" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" fill="#38bdf8" text-anchor="middle">
        📸 MANDATORY PHOTO EVIDENCE
      </text>

      <g transform="translate(25, 105)">
        <rect x="0" y="0" width="410" height="200" rx="20" fill="#1e293b" stroke="#10b981" stroke-width="3" />
        <text x="205" y="65" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#34d399" text-anchor="middle">
          🍲 🌡️ 78.2°C
        </text>
        <text x="205" y="110" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">
          Fresh Hot Batch Replenished
        </text>
        <text x="205" y="145" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="600" fill="#94a3b8" text-anchor="middle">
          {cafe} Sanitized &amp; Rechecked
        </text>
        <rect x="90" y="160" width="230" height="30" rx="12" fill="#064e3b" />
        <text x="205" y="181" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" fill="#34d399" text-anchor="middle">
          ✓ PHOTO PROOF VALIDATED
        </text>
      </g>

      <rect x="25" y="330" width="410" height="80" rx="18" fill="#ecfdf5" stroke="#10b981" stroke-width="2.5" />
      <text x="230" y="365" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#047857" text-anchor="middle">
        ✓ VERIFIED AUDIT PROOF ATTACHED
      </text>
      <text x="230" y="395" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#065f46" text-anchor="middle">
        Cannot be closed without valid camera proof
      </text>
    </g>

    <g transform="translate(500, 0)">
      <rect x="0" y="0" width="440" height="46" rx="23" fill="#f0f9ff" stroke="#38bdf8" stroke-width="2.5" />
      <text x="220" y="32" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#0369a1" text-anchor="middle" letter-spacing="2">
        STEP 04 • ON-GROUND RESOLUTION
      </text>

      <text x="0" y="105" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#0f172a">
        Employee Action &amp; Photo Proof
      </text>
      <text x="0" y="150" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#0284c7">
        Immediate Inspection • Fresh Batch • Temperature Calibrated
      </text>

      <text x="0" y="210" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="500" fill="#334155">
        Staff take immediate corrective action on-ground to fix every concern reported.
      </text>

      <g transform="translate(0, 245)">
        <circle cx="20" cy="24" r="14" fill="#e0f2fe" />
        <text x="20" y="31" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#0284c7" text-anchor="middle">✓</text>
        <text x="50" y="32" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Chef replenishes fresh hot food batch and probes temperature</text>

        <circle cx="20" cy="74" r="14" fill="#e0f2fe" />
        <text x="20" y="81" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#0284c7" text-anchor="middle">✓</text>
        <text x="50" y="82" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Housekeeping staff immediately cleans &amp; sanitizes table surface</text>

        <circle cx="20" cy="124" r="14" fill="#e0f2fe" />
        <text x="20" y="131" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#0284c7" text-anchor="middle">✓</text>
        <text x="50" y="132" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Mandatory live camera photo proof required to resolve ticket</text>
      </g>
    </g>
  </g>

  <!-- ============================================== -->
  <!-- STEP 5: LEFT CARD (y: 3670 - 4310) -->
  <!-- ============================================== -->
  <circle cx="440" cy="3950" r="48" fill="#10b981" filter="url(#shadow-glow)" />
  <circle cx="440" cy="3950" r="32" fill="#ffffff" />
  <text x="440" y="3962" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#047857" text-anchor="middle">5</text>

  <g filter="url(#shadow-card)">
    <rect x="220" y="3670" width="1440" height="590" rx="36" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" />
    <rect x="220" y="3670" width="28" height="590" rx="14" fill="#10b981" />
  </g>

  <g transform="translate(280, 3720)">
    <rect x="0" y="0" width="370" height="46" rx="23" fill="#ecfdf5" stroke="#10b981" stroke-width="2.5" />
    <text x="185" y="32" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#047857" text-anchor="middle" letter-spacing="2">
      STEP 05 • CLOSED LOOP ASSURANCE
    </text>

    <text x="0" y="105" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#0f172a">
      100% Verified Compliance
    </text>
    <text x="0" y="150" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#059669">
      Web Records Sync • Audit Trail Logged • Compliance Score 99.2%
    </text>

    <text x="0" y="210" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="500" fill="#334155">
      The loop is closed: customer issue fixed, proof verified, and compliance score synchronized.
    </text>

    <g transform="translate(0, 245)">
      <circle cx="20" cy="24" r="14" fill="#dcfce7" />
      <text x="20" y="31" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#047857" text-anchor="middle">✓</text>
      <text x="50" y="32" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Ticket status flips to RESOLVED in CookHouseAdmin</text>

      <circle cx="20" cy="74" r="14" fill="#dcfce7" />
      <text x="20" y="81" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#047857" text-anchor="middle">✓</text>
      <text x="50" y="82" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Full photo audit log stored permanently for FSSAI &amp; ISO compliance</text>

      <circle cx="20" cy="124" r="14" fill="#dcfce7" />
      <text x="20" y="131" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#047857" text-anchor="middle">✓</text>
      <text x="50" y="132" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#1e293b">Smart Compliance Hub score reaches 99.2% Audit Ready</text>
    </g>

    <g transform="translate(860, 20)">
      <rect x="0" y="0" width="460" height="440" rx="28" fill="#0b1329" stroke="#10b981" stroke-width="3" />
      <circle cx="230" cy="150" r="100" fill="none" stroke="#1e293b" stroke-width="16" />
      <circle cx="230" cy="150" r="100" fill="none" stroke="#10b981" stroke-width="16" stroke-dasharray="628" stroke-dashoffset="30" stroke-linecap="round" />
      
      <text x="230" y="145" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="900" fill="#34d399" text-anchor="middle">
        99.2%
      </text>
      <text x="230" y="185" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="800" fill="#a7f3d0" text-anchor="middle" letter-spacing="2">
        SMART AUDIT SCORE
      </text>

      <g transform="translate(30, 280)">
        <rect x="0" y="0" width="190" height="50" rx="14" fill="#064e3b" stroke="#10b981" stroke-width="2" />
        <text x="95" y="32" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" fill="#34d399" text-anchor="middle">
          ✓ FSSAI COMPLIANT
        </text>

        <rect x="210" y="0" width="190" height="50" rx="14" fill="#0c4a6e" stroke="#38bdf8" stroke-width="2" />
        <text x="305" y="32" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" fill="#38bdf8" text-anchor="middle">
          ✓ ZERO BREACHES
        </text>

        <rect x="0" y="65" width="400" height="50" rx="14" fill="#1e293b" stroke="#cbd5e1" stroke-width="2" />
        <text x="200" y="97" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle">
          ✓ 100% RESOLVED WITH PHOTO PROOF
        </text>
      </g>
    </g>
  </g>

  <!-- ============================================== -->
  <!-- HERO QR SCAN BOX (y: 4370 - 4850) -->
  <!-- ============================================== -->
  <g filter="url(#shadow-card)" transform="translate(180, 4370)">
    <rect x="0" y="0" width="1800" height="470" rx="36" fill="#ffffff" stroke="#10b981" stroke-width="5" />
    <rect x="0" y="0" width="1800" height="20" rx="10" fill="#059669" />

    <!-- Big Real QR Code for THIS specific scanner -->
    <g transform="translate(60, 50)">
      <rect x="0" y="0" width="370" height="370" rx="24" fill="#ffffff" stroke="#0f172a" stroke-width="6" />
      <g transform="translate(15, 15)">
        {qr_svg_hero}
      </g>
    </g>

    <!-- Call To Action Text -->
    <g transform="translate(480, 70)">
      <rect x="0" y="0" width="400" height="42" rx="21" fill="#ecfdf5" stroke="#10b981" stroke-width="2" />
      <text x="200" y="28" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#047857" text-anchor="middle" letter-spacing="2">
        ⚡ SCAN FOR {cafe[:22].upper()}
      </text>

      <text x="0" y="100" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="900" fill="#0f172a">
        Rate Today's Food at {building}!
      </text>
      <text x="0" y="145" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600" fill="#475569">
        Point your phone camera here to access live menu items, submit housekeeping, or report issues.
      </text>

      <g transform="translate(0, 185)">
        <rect x="0" y="0" width="300" height="65" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
        <text x="20" y="40" font-family="Arial, Helvetica, sans-serif" font-size="22">🌡️</text>
        <text x="60" y="32" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#0f172a">&gt;75°C Safe Food Temp</text>
        <text x="60" y="52" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" fill="#64748b">Digital Probe Verified</text>

        <rect x="320" y="0" width="300" height="65" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
        <text x="340" y="40" font-family="Arial, Helvetica, sans-serif" font-size="22">🧼</text>
        <text x="380" y="32" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#0f172a">100% Sanitized Stations</text>
        <text x="380" y="52" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" fill="#64748b">Housekeeping Checklist</text>

        <rect x="640" y="0" width="300" height="65" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
        <text x="660" y="40" font-family="Arial, Helvetica, sans-serif" font-size="22">🛡️</text>
        <text x="700" y="32" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#0f172a">FSSAI &amp; ISO Standards</text>
        <text x="700" y="52" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" fill="#64748b">Audit-Ready Logs</text>

        <rect x="960" y="0" width="300" height="65" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
        <text x="980" y="40" font-family="Arial, Helvetica, sans-serif" font-size="22">⏱️</text>
        <text x="1020" y="32" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#0f172a">&lt; 15 Min SLA Closure</text>
        <text x="1020" y="52" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" fill="#64748b">Instant Ground Dispatch</text>
      </g>
    </g>
  </g>

  <!-- ============================================== -->
  <!-- FOOTER (y: 4890 - 5184) -->
  <!-- ============================================== -->
  <rect x="0" y="4890" width="2160" height="294" fill="#0f172a" />
  <rect x="0" y="4890" width="2160" height="12" fill="#059669" />

  <g transform="translate(180, 4970) scale(2.6)">
    {inner_logo_white}
  </g>

  <g transform="translate(1100, 4980)">
    <text x="880" y="35" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900" fill="#ffffff" text-anchor="end">
      Enterprise Food Service Operations &amp; Facility Management
    </text>
    <text x="880" y="75" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600" fill="#94a3b8" text-anchor="end">
      {company} • {building} • {cafe}
    </text>
    <text x="880" y="115" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#34d399" text-anchor="end">
      Continuous Food Safety • Real-Time Traceability • Quality Assurance
    </text>
  </g>

</svg>"""

def generate_diner_standee_svg(url, company, building, cafe, logo_path):
    inner_logo, inner_logo_white = load_cookhouse_logo(logo_path)
    qr_svg_hero = get_qr_svg_path(url, width=640, height=640)

    site_badge = f"{company.upper()} • {building.upper()} • {cafe.upper()}"
    
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="2160" height="5184" viewBox="0 0 2160 5184">
  <defs>
    <!-- Background & Accents -->
    <linearGradient id="adv-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="15%" stop-color="#f0fdf4" />
      <stop offset="50%" stop-color="#ffffff" />
      <stop offset="85%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>

    <linearGradient id="adv-accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="30%" stop-color="#10b981" />
      <stop offset="60%" stop-color="#f59e0b" />
      <stop offset="85%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>

    <linearGradient id="qr-frame-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="50%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#0d9488" />
    </linearGradient>

    <linearGradient id="hero-card-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>

    <linearGradient id="footer-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>

    <filter id="shadow-card" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#0f172a" flood-opacity="0.10" />
    </filter>

    <filter id="shadow-glow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#10b981" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- CANVAS 6x2.5 ft @ 72pt/in = 2160x5184 -->
  <rect width="2160" height="5184" fill="#f8fafc" />

  <!-- Ambient Blobs -->
  <circle cx="200" cy="900" r="450" fill="#ecfdf5" opacity="0.6" />
  <circle cx="1960" cy="1100" r="500" fill="#fff7ed" opacity="0.5" />
  <circle cx="150" cy="4200" r="400" fill="#eff6ff" opacity="0.6" />
  <circle cx="1980" cy="4100" r="450" fill="#f0fdf4" opacity="0.6" />

  <rect x="0" y="0" width="2160" height="28" fill="#059669" />

  <!-- ============================================== -->
  <!-- TOP BRANDING & LOGO (y: 80 - 450) -->
  <!-- ============================================== -->
  <g transform="translate(628, 110) scale(3.2)">
    {inner_logo}
  </g>

  <!-- Location Pill -->
  <rect x="440" y="420" width="1280" height="68" rx="34" fill="#ecfdf5" stroke="#10b981" stroke-width="3.5" />
  <circle cx="480" cy="454" r="14" fill="#10b981" />
  <circle cx="1680" cy="454" r="14" fill="#10b981" />
  <text x="1080" y="465" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#047857" text-anchor="middle" letter-spacing="3">
    📍 {site_badge}
  </text>

  <!-- ============================================== -->
  <!-- HERO HEADLINE & INVITATION (y: 520 - 1000) -->
  <!-- ============================================== -->
  <text x="1080" y="600" font-family="Arial, Helvetica, sans-serif" font-size="94" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="-1">
    YOUR FEEDBACK MATTERS!
  </text>

  <text x="1080" y="690" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" fill="#059669" text-anchor="middle">
    Help Us Improve Every Single Meal You Enjoy
  </text>

  <text x="1080" y="770" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="#475569" text-anchor="middle">
    Tasted something delicious? Have a suggestion on food taste, cleanliness, or hygiene?
  </text>
  <text x="1080" y="820" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="#1e293b" text-anchor="middle">
    Scan the tabletop QR code below &amp; tell us in under 30 seconds!
  </text>

  <!-- Three Quick Feature Badges -->
  <g transform="translate(360, 880)">
    <rect x="0" y="0" width="420" height="66" rx="33" fill="#ffffff" stroke="#cbd5e1" stroke-width="2.5" />
    <text x="50" y="43" font-family="Arial, Helvetica, sans-serif" font-size="26">🍲</text>
    <text x="90" y="42" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#0f172a">Food &amp; Taste</text>
    <circle cx="370" cy="33" r="8" fill="#10b981" />

    <rect x="460" y="0" width="460" height="66" rx="33" fill="#ffffff" stroke="#cbd5e1" stroke-width="2.5" />
    <text x="505" y="43" font-family="Arial, Helvetica, sans-serif" font-size="26">✨</text>
    <text x="545" y="42" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#0f172a">Hygiene &amp; Cleanliness</text>
    <circle cx="870" cy="33" r="8" fill="#3b82f6" />

    <rect x="960" y="0" width="460" height="66" rx="33" fill="#ffffff" stroke="#cbd5e1" stroke-width="2.5" />
    <text x="1005" y="43" font-family="Arial, Helvetica, sans-serif" font-size="26">⚡</text>
    <text x="1045" y="42" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#0f172a">Service &amp; Speed</text>
    <circle cx="1370" cy="33" r="8" fill="#f59e0b" />
  </g>

  <!-- ============================================== -->
  <!-- CALL TO SCAN POINTER (y: 1600 - 1700) -->
  <!-- ============================================== -->
  <rect x="740" y="1620" width="680" height="70" rx="35" fill="#0f172a" />
  <text x="1080" y="1664" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="3">
    👇 POINT PHONE CAMERA HERE 👇
  </text>

  <!-- ============================================== -->
  <!-- GIANT HERO QR SCANNER CARD (y: 1740 - 3550) -->
  <!-- ============================================== -->
  <g filter="url(#shadow-card)" transform="translate(260, 1740)">
    <rect x="0" y="0" width="1640" height="1750" rx="54" fill="#ffffff" stroke="#10b981" stroke-width="6" />

    <!-- Top Card Header -->
    <rect x="0" y="0" width="1640" height="160" rx="48" fill="#0f172a" />
    <rect x="470" y="35" width="700" height="54" rx="27" fill="#1e293b" stroke="#334155" stroke-width="2" />
    <circle cx="510" cy="62" r="9" fill="#10b981" />
    <text x="820" y="70" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" fill="#f8fafc" text-anchor="middle" letter-spacing="3">
      OFFICIAL DINER FEEDBACK QR
    </text>

    <!-- Scan Call to Action -->
    <text x="820" y="260" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#0f172a" text-anchor="middle">
      SCAN TO RATE TODAY'S FOOD
    </text>
    <text x="820" y="315" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#475569" text-anchor="middle">
      Works with iPhone, Android &amp; Any QR Scanner App • Zero Download Required
    </text>

    <!-- QR Code Center Container -->
    <g transform="translate(370, 390)">
      <rect x="0" y="0" width="900" height="900" rx="40" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" filter="url(#shadow-glow)" />

      <!-- Corner Framing Reticles -->
      <path d="M 40 100 L 40 40 L 100 40" fill="none" stroke="#059669" stroke-width="14" stroke-linecap="round" />
      <path d="M 860 100 L 860 40 L 800 40" fill="none" stroke="#059669" stroke-width="14" stroke-linecap="round" />
      <path d="M 40 800 L 40 860 L 100 860" fill="none" stroke="#059669" stroke-width="14" stroke-linecap="round" />
      <path d="M 860 800 L 860 860 L 800 860" fill="none" stroke="#059669" stroke-width="14" stroke-linecap="round" />

      <!-- Actual High Resolution Vector QR Code for this Scanner -->
      <g transform="translate(130, 130)">
        {qr_svg_hero}
      </g>

      <!-- Laser Line Animation Illusion -->
      <line x1="80" y1="450" x2="820" y2="450" stroke="#10b981" stroke-width="8" stroke-linecap="round" opacity="0.75" />
    </g>

    <!-- 3 Value Chips Under QR -->
    <g transform="translate(180, 1360)">
      <rect x="0" y="0" width="380" height="90" rx="24" fill="#ecfdf5" stroke="#10b981" stroke-width="2.5" />
      <text x="40" y="55" font-family="Arial, Helvetica, sans-serif" font-size="34">🍲</text>
      <text x="95" y="44" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#047857">Food Taste</text>
      <text x="95" y="70" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#065f46">Rate Menu &amp; Spice</text>

      <rect x="440" y="0" width="380" height="90" rx="24" fill="#eff6ff" stroke="#3b82f6" stroke-width="2.5" />
      <text x="480" y="55" font-family="Arial, Helvetica, sans-serif" font-size="34">🧼</text>
      <text x="535" y="44" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#1d4ed8">Cleanliness</text>
      <text x="535" y="70" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#1e40af">Tables &amp; Trays</text>

      <rect x="880" y="0" width="380" height="90" rx="24" fill="#fff7ed" stroke="#f97316" stroke-width="2.5" />
      <text x="920" y="55" font-family="Arial, Helvetica, sans-serif" font-size="34">⏱️</text>
      <text x="975" y="44" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#c2410c">5-Min Action</text>
      <text x="975" y="70" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#9a3412">Manager On Floor</text>
    </g>

    <!-- URL Pill -->
    <rect x="100" y="1500" width="1440" height="74" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
    <text x="140" y="1547" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#64748b">
      🔗 Direct URL:
    </text>
    <text x="310" y="1547" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#0284c7">
      {url}
    </text>
    <rect x="1350" y="1515" width="160" height="44" rx="12" fill="#047857" />
    <text x="1430" y="1544" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" fill="#ffffff" text-anchor="middle">
      VERIFIED
    </text>
  </g>

  <!-- ============================================== -->
  <!-- 3-STEP FLOW EXPLANATION (y: 3630 - 4500) -->
  <!-- ============================================== -->
  <text x="1080" y="3710" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#0f172a" text-anchor="middle">
    HOW YOUR FEEDBACK WORKS IN 3 SIMPLE STEPS
  </text>
  <text x="1080" y="3765" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#475569" text-anchor="middle">
    Every rating goes directly to the floor supervisor &amp; central culinary team
  </text>

  <g transform="translate(200, 3840)">
    <!-- Step 1 Card -->
    <g filter="url(#shadow-card)">
      <rect x="0" y="0" width="530" height="520" rx="36" fill="#ffffff" stroke="#e2e8f0" stroke-width="3" />
      <rect x="0" y="0" width="530" height="14" rx="7" fill="#059669" />
    </g>
    <circle cx="80" cy="70" r="38" fill="#059669" />
    <text x="80" y="80" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle">1</text>
    <circle cx="265" cy="180" r="70" fill="#ecfdf5" />
    <text x="265" y="198" font-family="Arial, Helvetica, sans-serif" font-size="56" text-anchor="middle">📱</text>
    <text x="265" y="300" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" fill="#0f172a" text-anchor="middle">
      Scan The QR
    </text>
    <text x="265" y="360" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="#475569" text-anchor="middle">
      Point phone camera at
    </text>
    <text x="265" y="395" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="#475569" text-anchor="middle">
      the tabletop stand or poster.
    </text>
    <text x="265" y="445" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#059669" text-anchor="middle">
      Zero app download needed.
    </text>

    <!-- Step 2 Card -->
    <g filter="url(#shadow-card)" transform="translate(600, 0)">
      <rect x="0" y="0" width="530" height="520" rx="36" fill="#ffffff" stroke="#e2e8f0" stroke-width="3" />
      <rect x="0" y="0" width="530" height="14" rx="7" fill="#ea580c" />
      <circle cx="80" cy="70" r="38" fill="#ea580c" />
      <text x="80" y="80" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle">2</text>
      <circle cx="265" cy="180" r="70" fill="#fff7ed" />
      <text x="265" y="198" font-family="Arial, Helvetica, sans-serif" font-size="56" text-anchor="middle">✍️</text>
      <text x="265" y="300" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" fill="#0f172a" text-anchor="middle">
        Submit Feedback
      </text>
      <text x="265" y="360" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="#475569" text-anchor="middle">
        Rate today's food dishes,
      </text>
      <text x="265" y="395" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="#475569" text-anchor="middle">
        request housekeeping, or
      </text>
      <text x="265" y="445" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#ea580c" text-anchor="middle">
        report any cafeteria issue.
      </text>
    </g>

    <!-- Step 3 Card -->
    <g filter="url(#shadow-card)" transform="translate(1200, 0)">
      <rect x="0" y="0" width="530" height="520" rx="36" fill="#ffffff" stroke="#e2e8f0" stroke-width="3" />
      <rect x="0" y="0" width="530" height="14" rx="7" fill="#0284c7" />
      <circle cx="80" cy="70" r="38" fill="#0284c7" />
      <text x="80" y="80" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle">3</text>
      <circle cx="265" cy="180" r="70" fill="#f0f9ff" />
      <text x="265" y="198" font-family="Arial, Helvetica, sans-serif" font-size="56" text-anchor="middle">🚀</text>
      <text x="265" y="300" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" fill="#0f172a" text-anchor="middle">
        Help Us Improve
      </text>
      <text x="265" y="360" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="#475569" text-anchor="middle">
        Floor supervisor gets alert
      </text>
      <text x="265" y="395" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="#475569" text-anchor="middle">
        and resolves the request
      </text>
      <text x="265" y="445" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#0284c7" text-anchor="middle">
        with live verified action!
      </text>
    </g>
  </g>

  <!-- Bottom Promise Ribbon -->
  <rect x="360" y="4490" width="1440" height="80" rx="40" fill="#ffffff" stroke="#cbd5e1" stroke-width="2.5" />
  <text x="1080" y="4540" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#0f172a" text-anchor="middle">
    🛡️ 100% Chef Reviewed  •  ⏱️ 5-Minute Floor Response  •  🔒 Completely Anonymous Option
  </text>

  <!-- ============================================== -->
  <!-- FOOTER (y: 4720 - 5184) -->
  <!-- ============================================== -->
  <rect x="0" y="4720" width="2160" height="464" fill="#0f172a" />
  <rect x="0" y="4720" width="2160" height="16" fill="#059669" />

  <g transform="translate(680, 4830) scale(2.8)">
    {inner_logo_white}
  </g>

  <text x="1080" y="5000" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">
    COOKHOUSE • EXCELLENCE IN CORPORATE DINING &amp; COMPLIANCE
  </text>
  <text x="1080" y="5045" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" fill="#94a3b8" text-anchor="middle">
    {company} • {building} • {cafe}
  </text>
  <text x="1080" y="5085" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#34d399" text-anchor="middle">
    Tabletop QR Feedback System • Real-Time Floor Response • Certified FSSAI Standards
  </text>

</svg>"""

def build_standee_pdf(url, company, building, cafe, style="criss_cross", logo_path="public/cookhouse_logo.svg", output_pdf="standee.pdf"):
    if style == "diner":
        svg_code = generate_diner_standee_svg(url, company, building, cafe, logo_path)
    else:
        svg_code = generate_criss_cross_standee_svg(url, company, building, cafe, logo_path)

    svg_doc = fitz.open(stream=svg_code.encode("utf-8"), filetype="svg")
    pdf_bytes = svg_doc.convert_to_pdf()
    pdf_doc = fitz.open("pdf", pdf_bytes)
    pdf_doc.save(output_pdf)
    print(f"Generated Vector PDF at: {output_pdf}")
    print(f"Dimensions: {pdf_doc[0].rect.width / 72:.1f} in x {pdf_doc[0].rect.height / 72:.1f} in")
    return output_pdf

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate 6x2.5 ft Standee PDF for a QR Scanner")
    parser.add_argument("--url", required=True, help="QR code target URL")
    parser.add_argument("--company", default="Company", help="Company Name")
    parser.add_argument("--building", default="Building", help="Building Name")
    parser.add_argument("--cafe", default="Cafeteria", help="Cafe Name")
    parser.add_argument("--style", default="criss_cross", choices=["criss_cross", "diner"], help="Standee Style")
    parser.add_argument("--logo", default="public/cookhouse_logo.svg", help="Path to Cookhouse vector logo SVG")
    parser.add_argument("--output", default="standee.pdf", help="Output PDF file path")

    args = parser.parse_args()
    build_standee_pdf(
        url=args.url,
        company=args.company,
        building=args.building,
        cafe=args.cafe,
        style=args.style,
        logo_path=args.logo,
        output_pdf=args.output
    )
