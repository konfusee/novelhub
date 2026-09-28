"""Generate the NovelHub Moderator use-case diagram in Drawio and PNG formats."""
from pathlib import Path
import xml.etree.ElementTree as ET

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, Rectangle

OUT = Path(__file__).parent
W, H = 1900, 1200
BOUNDARY = (430, 80, 1000, 1000)
INK = "#1F2937"
BLUE = "#1F4E79"
TEAL = "#0F766E"
GRAY = "#4B5563"
PALE_BLUE = "#EAF2F8"
PALE_GRAY = "#F3F4F6"
PALE_YELLOW = "#FFF2CC"

USE_CASES = {
    "uc-queue": (570, 135, 720, 88, "UC-MOD-01\nManage moderation queue"),
    "uc-review": (570, 245, 720, 88, "UC-MOD-02\nReview publication submission"),
    "uc-decide": (570, 355, 720, 88, "UC-MOD-03\nDecide publication submission"),
    "uc-reported": (570, 465, 720, 88, "UC-MOD-04\nReview reported content"),
    "uc-resolve": (570, 575, 720, 88, "UC-MOD-05\nResolve content report"),
    "uc-history": (570, 685, 720, 88, "UC-MOD-06\nView moderation history"),
}
SUPPORTING = {
    "actor-llm": (1540, 155, 280, 90, "OpenAI LLM\nService"),
    "actor-embedding": (1540, 305, 280, 90, "OpenAI Embedding\nService"),
    "actor-storage": (1540, 455, 280, 90, "VPSTTT Object\nStorage"),
    "actor-smtp": (1540, 605, 280, 90, "Gmail SMTP\nService"),
}


def add_vertex(root, ident, value, x, y, w, h, style):
    cell = ET.SubElement(root, "mxCell", id=ident, value=value, style=style, vertex="1", parent="1")
    ET.SubElement(cell, "mxGeometry", x=str(x), y=str(y), width=str(w), height=str(h), **{"as": "geometry"})


def add_edge(root, ident, source, target, style, label=""):
    cell = ET.SubElement(root, "mxCell", id=ident, value=label, style=style, edge="1", parent="1", source=source, target=target)
    ET.SubElement(cell, "mxGeometry", relative="1", **{"as": "geometry"})


def build_drawio():
    mx = ET.Element("mxfile", host="app.diagrams.net", type="device")
    diagram = ET.SubElement(mx, "diagram", name="NovelHub Moderator Use Cases", id="novelhub-moderator-use-cases")
    model = ET.SubElement(
        diagram,
        "mxGraphModel",
        dx="1400",
        dy="900",
        grid="1",
        gridSize="10",
        guides="1",
        tooltips="1",
        connect="1",
        arrows="1",
        fold="1",
        page="1",
        pageScale="1",
        pageWidth="1900",
        pageHeight="1200",
        math="0",
        shadow="0",
    )
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", id="0")
    ET.SubElement(root, "mxCell", id="1", parent="0")

    add_vertex(
        root,
        "system-boundary",
        "NovelHub — Moderation Boundary",
        *BOUNDARY,
        "rounded=0;whiteSpace=wrap;html=1;strokeColor=#1F4E79;strokeWidth=2;fillColor=#FFFFFF;verticalAlign=top;align=left;spacingTop=18;spacingLeft=22;fontSize=22;fontStyle=1;fontColor=#1F4E79;",
    )
    add_vertex(
        root,
        "moderator",
        "Moderator",
        90,
        415,
        220,
        150,
        "shape=umlActor;html=1;verticalLabelPosition=bottom;verticalAlign=top;align=center;fontSize=20;fontStyle=1;fontColor=#1F4E79;strokeColor=#1F4E79;fillColor=#EAF2F8;",
    )

    for ident, (x, y, w, h, label) in USE_CASES.items():
        add_vertex(
            root,
            ident,
            label,
            x,
            y,
            w,
            h,
            "ellipse;whiteSpace=wrap;html=1;strokeColor=#0F766E;strokeWidth=1.8;fillColor=#FFFFFF;fontSize=17;fontColor=#0F766E;align=center;verticalAlign=middle;",
        )

    for ident, (x, y, w, h, label) in SUPPORTING.items():
        add_vertex(
            root,
            ident,
            label,
            x,
            y,
            w,
            h,
            "rounded=1;arcSize=12;whiteSpace=wrap;html=1;strokeColor=#4B5563;strokeWidth=1.4;fillColor=#F3F4F6;fontSize=16;fontColor=#374151;align=center;verticalAlign=middle;",
        )

    association = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;strokeColor=#1F2937;strokeWidth=1.3;"
    support_association = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;dashed=1;strokeColor=#6B7280;strokeWidth=1.2;"
    for index, ident in enumerate(USE_CASES, 1):
        add_edge(root, f"moderator-association-{index}", "moderator", ident, association)

    add_edge(root, "support-llm", "actor-llm", "uc-review", support_association, "pre-generated review evidence")
    add_edge(root, "support-embedding", "actor-embedding", "uc-review", support_association, "similarity evidence")
    add_edge(root, "support-storage-review", "actor-storage", "uc-review", support_association, "retrieve permitted media")
    add_edge(root, "support-storage-report", "actor-storage", "uc-reported", support_association, "retrieve reported content")
    add_edge(root, "support-smtp-decide", "actor-smtp", "uc-decide", support_association, "decision notification")
    add_edge(root, "support-smtp-resolve", "actor-smtp", "uc-resolve", support_association, "resolution notification")

    add_vertex(
        root,
        "note-ai",
        "AI review starts automatically when Author content is submitted.\nModerator does not trigger or delegate the final decision to AI.",
        555,
        825,
        790,
        75,
        "shape=note;whiteSpace=wrap;html=1;strokeColor=#B7791F;fillColor=#FFF2CC;fontSize=16;fontColor=#5B4636;align=center;verticalAlign=middle;",
    )
    add_vertex(
        root,
        "note-scope",
        "Similarity and rights data are review evidence, not legal verdicts.\nAdmin owns account, role and finance governance.",
        555,
        920,
        790,
        75,
        "shape=note;whiteSpace=wrap;html=1;strokeColor=#B7791F;fillColor=#FFF2CC;fontSize=16;fontColor=#5B4636;align=center;verticalAlign=middle;",
    )

    ET.indent(mx)
    ET.ElementTree(mx).write(OUT / "novelhub_moderator_use_case.drawio", encoding="utf-8", xml_declaration=True)


def actor(ax, x, y, label):
    ax.plot([x, x], [y + 22, y + 72], color=BLUE, linewidth=2)
    ax.plot([x - 22, x + 22], [y + 42, y + 42], color=BLUE, linewidth=2)
    ax.plot([x, x - 20], [y + 72, y + 105], color=BLUE, linewidth=2)
    ax.plot([x, x + 20], [y + 72, y + 105], color=BLUE, linewidth=2)
    ax.add_patch(plt.Circle((x, y + 10), 12, fill=False, color=BLUE, linewidth=2))
    ax.text(x, y + 130, label, ha="center", va="top", fontsize=15, fontweight="bold", color=BLUE)


def build_preview():
    fig, ax = plt.subplots(figsize=(19, 12), dpi=100, facecolor="white")
    ax.set_xlim(0, W)
    ax.set_ylim(H, 0)
    ax.axis("off")
    x, y, w, h = BOUNDARY
    ax.add_patch(Rectangle((x, y), w, h, facecolor="white", edgecolor=BLUE, linewidth=2.2))
    ax.text(x + 22, y + 32, "NovelHub — Moderation Boundary", ha="left", va="center", fontsize=22, fontweight="bold", color=BLUE)

    actor(ax, 200, 415, "Moderator")
    for ident, (x, y, w, h, label) in USE_CASES.items():
        ax.add_patch(Ellipse((x + w / 2, y + h / 2), w, h, facecolor="white", edgecolor=TEAL, linewidth=1.8))
        ax.text(x + w / 2, y + h / 2, label, ha="center", va="center", fontsize=14, color=TEAL, linespacing=1.25)
    for ident, (x, y, w, h, label) in SUPPORTING.items():
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=12", facecolor=PALE_GRAY, edgecolor=GRAY, linewidth=1.4))
        ax.text(x + w / 2, y + h / 2, label, ha="center", va="center", fontsize=14, color=INK, linespacing=1.25)

    for _, (x, y, w, h, _) in USE_CASES.items():
        ax.plot([310, x], [490, y + h / 2], color=INK, linewidth=1.2)
    for ident, (x, y, w, h, _) in SUPPORTING.items():
        if ident in {"actor-llm", "actor-embedding"}: target = USE_CASES["uc-review"]
        elif ident == "actor-storage": target = USE_CASES["uc-reported"]
        else: target = USE_CASES["uc-decide"]
        ax.plot([x, target[0] + target[2]], [y + h / 2, target[1] + target[3] / 2], color=GRAY, linewidth=1.1, linestyle="--")

    ax.add_patch(FancyBboxPatch((555, 825), 790, 75, boxstyle="round,pad=0.02,rounding_size=4", facecolor=PALE_YELLOW, edgecolor="#B7791F", linewidth=1.2))
    ax.text(950, 862, "AI review starts automatically when Author content is submitted.\nModerator does not trigger or delegate the final decision to AI.", ha="center", va="center", fontsize=14, color="#5B4636", linespacing=1.35)
    ax.add_patch(FancyBboxPatch((555, 920), 790, 75, boxstyle="round,pad=0.02,rounding_size=4", facecolor=PALE_YELLOW, edgecolor="#B7791F", linewidth=1.2))
    ax.text(950, 957, "Similarity and rights data are review evidence, not legal verdicts.\nAdmin owns account, role and finance governance.", ha="center", va="center", fontsize=14, color="#5B4636", linespacing=1.35)
    fig.savefig(OUT / "novelhub_moderator_use_case.png", dpi=140, facecolor="white", bbox_inches="tight", pad_inches=0.12)
    plt.close(fig)


if __name__ == "__main__":
    build_drawio()
    build_preview()
    print("OK: Moderator use-case Drawio and PNG generated.")
