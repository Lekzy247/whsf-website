from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "whsf-website"
DOWNLOADS = SITE / "assets" / "downloads"
OUTPUT = ROOT / "output" / "pdf"
DOWNLOADS.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)

PDF_NAME = "whsf-corporate-sponsorship-proposal.pdf"
SITE_PDF = DOWNLOADS / PDF_NAME
OUTPUT_PDF = OUTPUT / PDF_NAME

LOGO = SITE / "assets" / "whsf-logo.jpg"
COVER_IMAGE = SITE / "assets" / "home" / "girls-in-ai-africa-live.jpg"
STEM_IMAGE = SITE / "assets" / "home" / "stem-education-underserved-web.jpg"
AGRI_IMAGE = SITE / "assets" / "home" / "ai-for-agriculture-web.jpg"

WINE = colors.HexColor("#8f1f24")
WINE_DARK = colors.HexColor("#4b0d17")
GOLD = colors.HexColor("#e5b957")
INK = colors.HexColor("#1c1f2a")
MUTED = colors.HexColor("#5f6575")
SOFT = colors.HexColor("#fff7f8")
LINE = colors.HexColor("#ead0d3")


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=31,
    leading=35,
    textColor=WINE_DARK,
    alignment=TA_LEFT,
    spaceAfter=12,
))
styles.add(ParagraphStyle(
    name="SectionTitle",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=19,
    leading=23,
    textColor=WINE_DARK,
    spaceBefore=8,
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="SubTitle",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=13,
    leading=16,
    textColor=WINE,
    spaceBefore=6,
    spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="Body",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9.7,
    leading=14,
    textColor=INK,
    spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="Small",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=8.2,
    leading=11,
    textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="White",
    parent=styles["BodyText"],
    fontName="Helvetica-Bold",
    fontSize=10,
    leading=13,
    textColor=colors.white,
))
styles.add(ParagraphStyle(
    name="Eyebrow",
    parent=styles["BodyText"],
    fontName="Helvetica-Bold",
    fontSize=8.5,
    leading=10,
    textColor=WINE,
    uppercase=True,
    spaceAfter=5,
))


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullet(text):
    return Paragraph(f"- {text}", styles["Body"])


def image(path, width, height):
    if not path.exists():
        return Spacer(1, 0.01)
    img = Image(str(path))
    img._restrictSize(width, height)
    return img


def section_card(title, text):
    return Table(
        [[p(title, "SubTitle")], [p(text, "Body")]],
        colWidths=[2.45 * inch],
        style=[
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.8, LINE),
            ("ROUNDEDCORNERS", (0, 0), (-1, -1), 10),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ],
    )


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(WINE_DARK)
    canvas.rect(0, A4[1] - 26, A4[0], 26, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(doc.leftMargin, A4[1] - 17, "World Humanitarian Support Foundation")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(A4[0] - doc.rightMargin, A4[1] - 17, "Corporate Sponsorship Proposal")
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, 34, A4[0] - doc.rightMargin, 34)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(doc.leftMargin, 22, "www.worldhsfoundation.org | info@worldhsfoundation.org")
    canvas.drawRightString(A4[0] - doc.rightMargin, 22, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    story = []

    # Cover
    logo_img = image(LOGO, 0.85 * inch, 0.85 * inch)
    cover_img = image(COVER_IMAGE, 3.0 * inch, 2.15 * inch)
    cover_table = Table(
        [[logo_img, p("WORLD HUMANITARIAN SUPPORT FOUNDATION", "Eyebrow")]],
        colWidths=[0.95 * inch, 5.4 * inch],
        style=[
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )
    story += [
        cover_table,
        Spacer(1, 0.35 * inch),
        p("Corporate Sponsorship Proposal", "CoverTitle"),
        p("Partnering with WHSF to expand Artificial Intelligence, digital inclusion, STEM education and responsible technology for sustainable development.", "Body"),
        Spacer(1, 0.18 * inch),
        Table(
            [[
                [
                    p("Why this matters", "SubTitle"),
                    p("WHSF connects underserved learners, girls, young women, schools and communities to practical technology skills, e-learning, mentorship, device access and verifiable certificates.", "Body"),
                    p("Your sponsorship helps turn technology into access, confidence, employability and community resilience.", "Body"),
                ],
                cover_img,
            ]],
            colWidths=[3.0 * inch, 3.1 * inch],
            style=[
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (0, 0), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ],
        ),
        Spacer(1, 0.25 * inch),
        Table(
            [[
                p("7,500+<br/>girls impacted", "White"),
                p("550+<br/>young women empowered", "White"),
                p("120<br/>scholarship awards supported", "White"),
            ]],
            colWidths=[2.05 * inch, 2.05 * inch, 2.05 * inch],
            style=[
                ("BACKGROUND", (0, 0), (-1, -1), WINE),
                ("BOX", (0, 0), (-1, -1), 0, WINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#b95459")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ],
        ),
        Spacer(1, 0.25 * inch),
        p("Prepared for companies, donors, universities, foundations and institutional partners.", "Small"),
        PageBreak(),
    ]

    story += [
        p("1. Partnership Opportunity", "SectionTitle"),
        p("WHSF is building a practical technology ecosystem that supports learners through access, training, mentorship, digital tools and verified achievement. Corporate and institutional sponsors can help WHSF scale programmes that are measurable, inclusive and community-centered.", "Body"),
        Table(
            [[
                section_card("Education access", "Support e-learning, digital literacy, certificates, learning materials and classroom technology."),
                section_card("Future-ready skills", "Sponsor AI, robotics, cybersecurity, drones, data, cloud, STEM and climate-smart technology training."),
                section_card("Community resilience", "Strengthen rural outreach, women empowerment, digital inclusion and technology-for-good projects."),
            ]],
            colWidths=[2.05 * inch, 2.05 * inch, 2.05 * inch],
            style=[("VALIGN", (0, 0), (-1, -1), "TOP")],
        ),
        Spacer(1, 0.14 * inch),
        p("Ideal partners include technology companies, universities, foundations, CSR teams, employee giving programmes, innovation hubs, donor agencies, device manufacturers, cloud providers, telecoms, professional associations and local businesses.", "Body"),
        p("2. Sponsor Priorities", "SectionTitle"),
    ]

    priorities = [
        ["Sponsor area", "What sponsorship supports", "Example outcome"],
        ["Sponsor a learner", "E-learning access, course materials, mentor review and certificate readiness.", "Learners can build practical skills and show verified progress."],
        ["Sponsor a classroom", "Computers, tablets, internet support, projectors, learning materials and setup support.", "A school or hub gains practical digital learning capacity."],
        ["Sponsor a bootcamp", "AI/STEM bootcamp delivery, facilitator support, lesson materials and learner projects.", "A cohort receives structured hands-on training."],
        ["Sponsor certificates", "Certificate preparation, QR verification and learner recognition.", "Learners receive trusted evidence of achievement."],
        ["Sponsor outreach", "Rural/community visits, awareness activities, materials and local coordination.", "More learners and families are reached with safe technology education."],
    ]
    story += [
        Table(
            [[p(cell, "Body") for cell in row] for row in priorities],
            colWidths=[1.65 * inch, 2.5 * inch, 2.0 * inch],
            repeatRows=1,
            style=[
                ("BACKGROUND", (0, 0), (-1, 0), WINE_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ],
        ),
        PageBreak(),
        p("3. Sponsorship Levels", "SectionTitle"),
        p("WHSF can structure sponsorships to fit the partner's goals, from one-off support to strategic programme collaboration.", "Body"),
    ]

    levels = [
        ["Level", "Best for", "Visibility and reporting"],
        ["Bronze", "Small businesses, individuals and first-time sponsors.", "Recognition on WHSF updates and a short impact summary."],
        ["Silver", "Digital inclusion partners supporting devices, e-learning or classroom access.", "Logo recognition where appropriate and activity photos or summary."],
        ["Gold", "Programme sponsors supporting a full cohort, bootcamp or learning pathway.", "Programme-level recognition and a focused impact report."],
        ["Strategic", "Universities, foundations, technology companies and institutions.", "Custom partnership roadmap, joint visibility and long-term measurement."],
    ]
    story += [
        Table(
            [[p(cell, "Body") for cell in row] for row in levels],
            colWidths=[1.15 * inch, 2.55 * inch, 2.45 * inch],
            repeatRows=1,
            style=[
                ("BACKGROUND", (0, 0), (-1, 0), WINE_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ],
        ),
        Spacer(1, 0.18 * inch),
        Table(
            [[
                image(STEM_IMAGE, 2.9 * inch, 1.65 * inch),
                [
                    p("What sponsors receive", "SubTitle"),
                    bullet("Clear discussion of sponsor goals and programme fit."),
                    bullet("Impact summary or report based on sponsorship level."),
                    bullet("Recognition where suitable and aligned with WHSF values."),
                    bullet("A responsible partnership process focused on education, inclusion and community benefit."),
                ],
            ]],
            colWidths=[3.0 * inch, 3.15 * inch],
            style=[
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                ("BACKGROUND", (1, 0), (1, 0), SOFT),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ],
        ),
        PageBreak(),
        p("4. Estimated Impact Guide", "SectionTitle"),
        p("The estimates below help sponsors begin a practical conversation. Final budgets depend on country, location, delivery model, equipment type, training duration and partner requirements.", "Body"),
    ]

    impact = [
        ["Support", "Planning assumption", "Estimated impact"],
        ["$500", "$50 per learner planning guide.", "About 10 learners supported with access, materials or certificate readiness."],
        ["10 devices", "Each device may support multiple learners over time.", "About 30 learners can benefit through classroom or hub rotation."],
        ["$2,500", "Digital classroom or bootcamp planning guide.", "One classroom or one AI/STEM bootcamp for about 30-40 learners."],
        ["$5,000+", "Expanded cohort, devices or outreach package.", "Larger learner reach, stronger reporting and deeper programme visibility."],
    ]
    story += [
        Table(
            [[p(cell, "Body") for cell in row] for row in impact],
            colWidths=[1.4 * inch, 2.35 * inch, 2.4 * inch],
            repeatRows=1,
            style=[
                ("BACKGROUND", (0, 0), (-1, 0), WINE_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ],
        ),
        Spacer(1, 0.2 * inch),
        Table(
            [[
                [
                    p("Device donation", "SubTitle"),
                    p("WHSF welcomes conversations about safe, usable laptops, desktops, tablets, phones, projectors, routers, robotics kits, sensors, assistive technology and classroom technology tools.", "Body"),
                ],
                image(AGRI_IMAGE, 2.6 * inch, 1.5 * inch),
            ]],
            colWidths=[3.45 * inch, 2.7 * inch],
            style=[
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                ("BACKGROUND", (0, 0), (0, 0), SOFT),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ],
        ),
        PageBreak(),
        p("5. Accountability and Next Steps", "SectionTitle"),
        p("WHSF aims to build partnerships that are clear, respectful, measurable and aligned with community needs. Sponsorship should create visible benefit for learners while supporting responsible technology, inclusion and human dignity.", "Body"),
        p("How to begin", "SubTitle"),
        bullet("Review the sponsorship opportunities and choose the area that best matches your goals."),
        bullet("Use the Sponsor Impact Calculator on the WHSF website to estimate possible reach."),
        bullet("Submit a Partner Enquiry form or email WHSF directly."),
        bullet("WHSF will respond with the appropriate next step, budget discussion or partnership pathway."),
        Spacer(1, 0.18 * inch),
        Table(
            [[
                p("Contact WHSF", "White"),
                p("Website: www.worldhsfoundation.org<br/>Email: info@worldhsfoundation.org<br/>Donate securely: paypal.com/us/fundraiser/charity/1450337", "White"),
            ]],
            colWidths=[1.65 * inch, 4.5 * inch],
            style=[
                ("BACKGROUND", (0, 0), (-1, -1), WINE_DARK),
                ("BOX", (0, 0), (-1, -1), 0, WINE_DARK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ],
        ),
        Spacer(1, 0.16 * inch),
        p("This proposal is a public-facing partnership overview. It is not a binding contract, grant agreement or final budget. WHSF will confirm programme details, delivery scope and recognition terms with each partner.", "Small"),
    ]

    return story


def main():
    doc = SimpleDocTemplate(
        str(SITE_PDF),
        pagesize=A4,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.62 * inch,
        bottomMargin=0.55 * inch,
        title="WHSF Corporate Sponsorship Proposal",
        author="World Humanitarian Support Foundation",
        subject="Corporate sponsorship and partnership proposal",
    )
    doc.build(build_story(), onFirstPage=header_footer, onLaterPages=header_footer)
    OUTPUT_PDF.write_bytes(SITE_PDF.read_bytes())
    print(SITE_PDF)
    print(OUTPUT_PDF)


if __name__ == "__main__":
    main()
